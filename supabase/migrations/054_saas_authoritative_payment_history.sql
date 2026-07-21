-- Merge provider and manual payments into one authoritative customer history.
--
-- Migration 053 introduced the scrubbed manual-payment read model. This
-- migration adds a globally ordered view so independent query limits cannot
-- hide a newer payment or detach an ECPay order from its purchased period.
-- Apply only to the SaaS Supabase project after explicit rollout approval.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billing_events AS event
    WHERE event.provider = 'manual'
      AND event.event_type = 'manual.payment_marked'
      AND event.status = 'processed'
      AND (
        event.processed_at > transaction_timestamp() + INTERVAL '5 minutes'
        OR NOT public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'existing manual payment events are malformed or contain implausible timestamps; audit them before applying migration 054';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_billing_events_manual_payment_history
ON public.billing_events(org_id, processed_at DESC, created_at DESC, id)
WHERE provider = 'manual'
  AND event_type = 'manual.payment_marked'
  AND status = 'processed';

CREATE OR REPLACE FUNCTION public.list_customer_payment_history(
  p_org_id UUID,
  p_limit INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT := COALESCE(auth.role(), '');
  caller_user_id UUID := auth.uid();
  bounded_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
  history JSONB;
  current_entitlement_period JSONB;
BEGIN
  IF caller_role NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'authenticated access is required';
  END IF;

  IF caller_role = 'authenticated' AND (
    caller_user_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.organization_members AS member
      WHERE member.org_id = p_org_id
        AND member.user_id = caller_user_id
        AND member.role IN ('owner', 'admin')
        AND COALESCE(member.status, 'active') = 'active'
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'active owner or admin membership is required';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      payment.entry
      ORDER BY payment.sort_at DESC, payment.created_at DESC, payment.tie_key ASC
    ),
    '[]'::jsonb
  )
  INTO history
  FROM (
    SELECT combined.entry, combined.sort_at, combined.created_at, combined.tie_key
    FROM (
      SELECT
        jsonb_build_object(
          'id', payment_order.id,
          'plan', payment_order.plan,
          'provider', payment_order.provider,
          'amount_twd', payment_order.amount_twd,
          'status', payment_order.status,
          'paid_at', payment_order.paid_at,
          'period_start', period.period_start,
          'period_end', period.period_end,
          'created_at', payment_order.created_at
        ) AS entry,
        COALESCE(payment_order.paid_at, payment_order.created_at) AS sort_at,
        payment_order.created_at,
        'ecpay:' || payment_order.id::TEXT AS tie_key
      FROM public.payment_orders AS payment_order
      LEFT JOIN public.subscription_periods AS period
        ON period.payment_order_id = payment_order.id
        AND period.org_id = payment_order.org_id
        AND period.org_id = p_org_id
        AND period.subscription_id = payment_order.subscription_id
      WHERE payment_order.org_id = p_org_id

      UNION ALL

      SELECT
        jsonb_build_object(
          'id', 'manual:' || event.id::TEXT,
          'plan', NULL,
          'provider', 'manual',
          'amount_twd', event.payload -> 'amount_twd',
          'status', 'paid',
          'paid_at', event.processed_at,
          'period_start', event.payload ->> 'period_start',
          'period_end', event.payload ->> 'period_end',
          'created_at', event.created_at
        ) AS entry,
        event.processed_at AS sort_at,
        event.created_at,
        'manual:' || event.id::TEXT AS tie_key
      FROM public.billing_events AS event
      WHERE event.org_id = p_org_id
        AND event.provider = 'manual'
        AND event.event_type = 'manual.payment_marked'
        AND event.status = 'processed'
        AND event.processed_at <= transaction_timestamp() + INTERVAL '5 minutes'
        AND public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)
    ) AS combined
    ORDER BY combined.sort_at DESC, combined.created_at DESC, combined.tie_key ASC
    LIMIT bounded_limit
  ) AS payment;

  -- The bounded display history must not decide the current entitlement. A
  -- burst of newer pending/failed orders could otherwise push the still-active
  -- paid period outside the history limit and make an early renewal appear to
  -- start in the future.
  SELECT candidate.entry
  INTO current_entitlement_period
  FROM (
    SELECT
      jsonb_build_object(
        'payment_order_id', period.payment_order_id,
        'period_start', period.period_start,
        'period_end', period.period_end
      ) AS entry,
      period.period_start AS sort_at,
      'ecpay:' || period.payment_order_id::TEXT AS tie_key
    FROM public.subscription_periods AS period
    INNER JOIN public.payment_orders AS payment_order
      ON payment_order.id = period.payment_order_id
      AND payment_order.org_id = period.org_id
      AND payment_order.subscription_id = period.subscription_id
    WHERE period.org_id = p_org_id
      AND payment_order.org_id = p_org_id
      AND period.status = 'active'
      AND payment_order.status = 'paid'
      AND period.period_start <= transaction_timestamp()
      AND period.period_end > transaction_timestamp()

    UNION ALL

    SELECT
      jsonb_build_object(
        'payment_order_id', 'manual:' || event.id::TEXT,
        'period_start', event.payload ->> 'period_start',
        'period_end', event.payload ->> 'period_end'
      ) AS entry,
      (event.payload ->> 'period_start')::TIMESTAMPTZ AS sort_at,
      'manual:' || event.id::TEXT AS tie_key
    FROM public.billing_events AS event
    WHERE event.org_id = p_org_id
      AND event.provider = 'manual'
      AND event.event_type = 'manual.payment_marked'
      AND event.status = 'processed'
      AND event.processed_at <= transaction_timestamp() + INTERVAL '5 minutes'
      AND public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)
      AND (event.payload ->> 'period_start')::TIMESTAMPTZ <= transaction_timestamp()
      AND (event.payload ->> 'period_end')::TIMESTAMPTZ > transaction_timestamp()
  ) AS candidate
  ORDER BY candidate.sort_at DESC, candidate.tie_key ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'history', history,
    'current_entitlement_period', current_entitlement_period
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_customer_payment_history(UUID, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_payment_history(UUID, INTEGER)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_customer_payment_history(UUID, INTEGER) IS
  'Returns globally ordered scrubbed payment history plus the independently resolved current active entitlement period for organization owners/admins or service_role.';
