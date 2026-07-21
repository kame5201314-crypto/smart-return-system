-- Expose a scrubbed customer-facing read model for manually recorded payments.
-- Apply to the SaaS Supabase project only after the rollout plan is approved.

CREATE OR REPLACE FUNCTION public.is_valid_manual_payment_event_payload(
  p_payload JSONB,
  p_processed_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  amount_twd NUMERIC;
  period_start_at TIMESTAMPTZ;
  period_end_at TIMESTAMPTZ;
  effective_at TIMESTAMPTZ;
BEGIN
  IF p_processed_at IS NULL
     OR jsonb_typeof(p_payload -> 'amount_twd') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_payload -> 'period_start') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_payload -> 'period_end') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_payload -> 'effective_at') IS DISTINCT FROM 'string' THEN
    RETURN FALSE;
  END IF;

  amount_twd := (p_payload ->> 'amount_twd')::NUMERIC;
  period_start_at := (p_payload ->> 'period_start')::TIMESTAMPTZ;
  period_end_at := (p_payload ->> 'period_end')::TIMESTAMPTZ;
  effective_at := (p_payload ->> 'effective_at')::TIMESTAMPTZ;

  RETURN amount_twd > 0
    AND amount_twd = TRUNC(amount_twd)
    AND period_end_at > period_start_at
    AND effective_at = p_processed_at;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_manual_payment_event_payload_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_event public.billing_events%ROWTYPE;
BEGIN
  IF NEW.event_type <> 'manual.payment_marked' THEN
    RETURN NEW;
  END IF;

  IF NEW.provider <> 'manual'
     OR NEW.status <> 'processed'
     OR NULLIF(BTRIM(NEW.provider_event_id), '') IS NULL
     OR NOT public.is_valid_manual_payment_event_payload(NEW.payload, NEW.processed_at) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'manual payment event payload is invalid';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.event_type = 'manual.payment_marked'
     AND ROW(
       NEW.org_id,
       NEW.provider,
       NEW.provider_event_id,
       NEW.event_type,
       NEW.status,
       NEW.payload,
       NEW.processed_at
     ) IS DISTINCT FROM ROW(
       OLD.org_id,
       OLD.provider,
       OLD.provider_event_id,
       OLD.event_type,
       OLD.status,
       OLD.payload,
       OLD.processed_at
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'processed manual payment events are immutable';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.provider || ':' || NEW.provider_event_id, 0)
    );

    SELECT event.*
    INTO existing_event
    FROM public.billing_events AS event
    WHERE event.provider = NEW.provider
      AND event.provider_event_id = NEW.provider_event_id
    FOR UPDATE;

    IF FOUND AND ROW(
      existing_event.org_id,
      existing_event.provider,
      existing_event.provider_event_id,
      existing_event.event_type,
      existing_event.status,
      existing_event.payload,
      existing_event.processed_at
    ) IS DISTINCT FROM ROW(
      NEW.org_id,
      NEW.provider,
      NEW.provider_event_id,
      NEW.event_type,
      NEW.status,
      NEW.payload,
      NEW.processed_at
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'manual payment idempotency key already belongs to different input';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billing_events AS event
    WHERE event.event_type = 'manual.payment_marked'
      AND (
        event.provider <> 'manual'
        OR event.status <> 'processed'
        OR NULLIF(BTRIM(event.provider_event_id), '') IS NULL
        OR NOT public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)
      )
  ) THEN
    RAISE EXCEPTION
      'Cannot enable manual payment history: malformed manual payment events exist';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_manual_payment_event_payload_integrity
ON public.billing_events;

CREATE TRIGGER trg_enforce_manual_payment_event_payload_integrity
BEFORE INSERT OR UPDATE OF org_id, provider, provider_event_id, event_type, status, payload, processed_at
ON public.billing_events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_manual_payment_event_payload_integrity();

CREATE OR REPLACE FUNCTION public.list_customer_manual_payment_history(
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
    jsonb_agg(payment.entry ORDER BY payment.paid_at DESC, payment.created_at DESC),
    '[]'::jsonb
  )
  INTO history
  FROM (
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
      event.processed_at AS paid_at,
      event.created_at
    FROM public.billing_events AS event
    WHERE event.org_id = p_org_id
      AND event.provider = 'manual'
      AND event.event_type = 'manual.payment_marked'
      AND event.status = 'processed'
      AND event.processed_at IS NOT NULL
      AND public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)
    ORDER BY event.processed_at DESC, event.created_at DESC
    LIMIT bounded_limit
  ) AS payment;

  RETURN history;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_manual_payment_event_payload(JSONB, TIMESTAMPTZ)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_manual_payment_event_payload(JSONB, TIMESTAMPTZ)
  FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_manual_payment_event_payload_integrity()
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_manual_payment_event_payload_integrity()
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_manual_payment_event_payload(JSONB, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_manual_payment_event_payload_integrity()
  TO service_role;

REVOKE ALL ON FUNCTION public.list_customer_manual_payment_history(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_customer_manual_payment_history(UUID, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_customer_manual_payment_history(UUID, INTEGER)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.list_customer_manual_payment_history(UUID, INTEGER)
  IS 'Returns a scrubbed manual payment history for active org owners/admins or service_role; never exposes billing event payload, metadata, or reasons.';
