-- Make platform-admin manual payment retries a true no-op after the first
-- successful write. Apply only to the SaaS Supabase project after explicit
-- rollout approval.

CREATE OR REPLACE FUNCTION public.perform_platform_billing_operation_v2(
  p_operation TEXT,
  p_org_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_amount_twd INTEGER DEFAULT NULL,
  p_period_start TIMESTAMPTZ DEFAULT NULL,
  p_period_end TIMESTAMPTZ DEFAULT NULL,
  p_effective_at TIMESTAMPTZ DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_idempotency_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  expected_payload JSONB;
  subscription_record public.subscriptions%ROWTYPE;
  org_record public.organizations%ROWTYPE;
  existing_event public.billing_events%ROWTYPE;
  existing_audit_log_id UUID;
BEGIN
  IF p_operation IS DISTINCT FROM 'mark_manual_payment' THEN
    RETURN public.perform_platform_billing_operation(
      p_operation,
      p_org_id,
      p_actor_user_id,
      p_reason,
      p_amount_twd,
      p_period_start,
      p_period_end,
      p_effective_at,
      p_idempotency_key,
      p_invoice_id,
      p_metadata
    );
  END IF;

  IF normalized_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'idempotency_key is required for mark_manual_payment';
  END IF;
  IF p_effective_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'effective_at is required for mark_manual_payment';
  END IF;
  IF p_effective_at > transaction_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'effective_at is implausibly in the future';
  END IF;
  IF p_amount_twd IS NULL OR p_amount_twd <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'amount_twd must be positive for mark_manual_payment';
  END IF;
  IF p_period_end IS NULL OR p_period_end <= COALESCE(p_period_start, p_effective_at) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'period_end must be later than the effective period start';
  END IF;

  expected_payload := jsonb_strip_nulls(jsonb_build_object(
    'operation', p_operation,
    'amount_twd', p_amount_twd,
    'period_start', COALESCE(p_period_start, p_effective_at),
    'period_end', p_period_end,
    'effective_at', p_effective_at,
    'invoice_id', p_invoice_id,
    'reason', p_reason,
    'metadata', COALESCE(p_metadata, '{}'::jsonb)
  ));

  IF NOT public.is_valid_manual_payment_event_payload(expected_payload, p_effective_at) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'manual payment payload is invalid';
  END IF;

  -- Preserve the established billing writer lock order before taking the
  -- event idempotency lock: subscription -> organization -> event key.
  SELECT subscription.*
  INTO subscription_record
  FROM public.subscriptions AS subscription
  WHERE subscription.org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for organization: %', p_org_id;
  END IF;

  SELECT organization.*
  INTO org_record
  FROM public.organizations AS organization
  WHERE organization.id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found: %', p_org_id;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('manual:' || normalized_idempotency_key, 0)
  );

  SELECT event.*
  INTO existing_event
  FROM public.billing_events AS event
  WHERE event.provider = 'manual'
    AND event.provider_event_id = normalized_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF ROW(
      existing_event.org_id,
      existing_event.provider,
      existing_event.provider_event_id,
      existing_event.event_type,
      existing_event.status,
      existing_event.payload,
      existing_event.processed_at
    ) IS DISTINCT FROM ROW(
      p_org_id,
      'manual',
      normalized_idempotency_key,
      'manual.payment_marked',
      'processed',
      expected_payload,
      p_effective_at
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'manual payment idempotency key already belongs to different input';
    END IF;

    SELECT audit.id
    INTO existing_audit_log_id
    FROM public.audit_logs AS audit
    WHERE audit.org_id = p_org_id
      AND audit.action = 'platform.billing.manual_payment_marked'
      AND audit.metadata ->> 'billing_event_id' = existing_event.id::TEXT
    ORDER BY audit.created_at ASC, audit.id ASC
    LIMIT 1;

    -- Exact retries return the original ledger identity and current account
    -- status without rewriting the subscription or creating another audit row.
    RETURN jsonb_build_object(
      'operation', p_operation,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'audit_log_id', existing_audit_log_id,
      'billing_event_id', existing_event.id,
      'invoice_id', p_invoice_id,
      'next_status', subscription_record.status
    );
  END IF;

  RETURN public.perform_platform_billing_operation(
    p_operation,
    p_org_id,
    p_actor_user_id,
    p_reason,
    p_amount_twd,
    p_period_start,
    p_period_end,
    p_effective_at,
    normalized_idempotency_key,
    p_invoice_id,
    p_metadata
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.perform_platform_billing_operation(
  TEXT, UUID, UUID, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, UUID, JSONB
) FROM service_role;

REVOKE ALL ON FUNCTION public.perform_platform_billing_operation_v2(
  TEXT, UUID, UUID, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, UUID, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perform_platform_billing_operation_v2(
  TEXT, UUID, UUID, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, UUID, JSONB
) TO service_role;

COMMENT ON FUNCTION public.perform_platform_billing_operation_v2(
  TEXT, UUID, UUID, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, UUID, JSONB
) IS 'Performs guarded platform billing operations and makes exact manual-payment retries read-only no-ops.';
