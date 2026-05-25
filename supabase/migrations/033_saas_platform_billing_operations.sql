-- DRAFT: SaaS platform admin billing operations RPC.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE OR REPLACE FUNCTION public.perform_platform_billing_operation(
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
SET search_path = public
AS $$
DECLARE
  effective_at TIMESTAMPTZ := COALESCE(p_effective_at, NOW());
  org_record public.organizations%ROWTYPE;
  subscription_record public.subscriptions%ROWTYPE;
  created_billing_event_id UUID;
  created_audit_log_id UUID;
  next_status TEXT;
  audit_action TEXT;
  event_type TEXT;
  event_status TEXT;
  event_provider_event_id TEXT;
BEGIN
  IF p_operation NOT IN (
    'mark_manual_payment',
    'suspend_org',
    'resume_org',
    'request_refund'
  ) THEN
    RAISE EXCEPTION 'Invalid platform billing operation: %', p_operation;
  END IF;

  SELECT *
  INTO org_record
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found: %', p_org_id;
  END IF;

  SELECT *
  INTO subscription_record
  FROM public.subscriptions
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for organization: %', p_org_id;
  END IF;

  IF p_operation IN ('suspend_org', 'resume_org', 'request_refund')
     AND NULLIF(BTRIM(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'reason is required for %', p_operation;
  END IF;

  IF p_operation IN ('mark_manual_payment', 'request_refund')
     AND (p_amount_twd IS NULL OR p_amount_twd <= 0) THEN
    RAISE EXCEPTION 'amount_twd must be positive for %', p_operation;
  END IF;

  IF p_operation = 'mark_manual_payment' AND p_period_end IS NULL THEN
    RAISE EXCEPTION 'period_end is required for mark_manual_payment';
  END IF;

  IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'period_end must be later than period_start';
  END IF;

  IF p_operation = 'mark_manual_payment' THEN
    next_status := 'active';
    audit_action := 'platform.billing.manual_payment_marked';
    event_type := 'manual.payment_marked';
    event_status := 'processed';
    event_provider_event_id := COALESCE(
      NULLIF(BTRIM(p_idempotency_key), ''),
      'manual-payment-' || p_org_id::text || '-' || EXTRACT(EPOCH FROM effective_at)::BIGINT::text
    );

    UPDATE public.organizations
    SET
      status = next_status,
      suspended_at = NULL,
      updated_at = NOW()
    WHERE id = p_org_id;

    UPDATE public.subscriptions
    SET
      status = next_status,
      provider = 'manual',
      current_period_start = COALESCE(p_period_start, effective_at),
      current_period_end = p_period_end,
      cancel_at_period_end = false,
      canceled_at = NULL,
      updated_at = NOW()
    WHERE id = subscription_record.id;

    INSERT INTO public.billing_events (
      org_id,
      provider,
      provider_event_id,
      event_type,
      status,
      payload,
      processed_at
    )
    VALUES (
      p_org_id,
      'manual',
      event_provider_event_id,
      event_type,
      event_status,
      jsonb_strip_nulls(jsonb_build_object(
        'operation', p_operation,
        'amount_twd', p_amount_twd,
        'period_start', COALESCE(p_period_start, effective_at),
        'period_end', p_period_end,
        'effective_at', effective_at,
        'invoice_id', p_invoice_id,
        'reason', p_reason,
        'metadata', COALESCE(p_metadata, '{}'::jsonb)
      )),
      effective_at
    )
    ON CONFLICT (provider, provider_event_id)
    DO UPDATE SET provider_event_id = EXCLUDED.provider_event_id
    RETURNING id INTO created_billing_event_id;
  ELSIF p_operation = 'suspend_org' THEN
    next_status := 'suspended';
    audit_action := 'platform.billing.org_suspended';

    UPDATE public.organizations
    SET
      status = next_status,
      suspended_at = effective_at,
      updated_at = NOW()
    WHERE id = p_org_id;

    UPDATE public.subscriptions
    SET
      status = next_status,
      updated_at = NOW()
    WHERE id = subscription_record.id;
  ELSIF p_operation = 'resume_org' THEN
    next_status := 'active';
    audit_action := 'platform.billing.org_resumed';

    UPDATE public.organizations
    SET
      status = next_status,
      suspended_at = NULL,
      updated_at = NOW()
    WHERE id = p_org_id;

    UPDATE public.subscriptions
    SET
      status = next_status,
      current_period_end = COALESCE(p_period_end, current_period_end),
      cancel_at_period_end = false,
      canceled_at = NULL,
      updated_at = NOW()
    WHERE id = subscription_record.id;
  ELSE
    next_status := subscription_record.status;
    audit_action := 'platform.billing.refund_requested';
    event_type := 'manual.refund_requested';
    event_status := 'received';
    event_provider_event_id := COALESCE(
      NULLIF(BTRIM(p_idempotency_key), ''),
      'manual-refund-request-' || p_org_id::text || '-' || EXTRACT(EPOCH FROM effective_at)::BIGINT::text
    );

    INSERT INTO public.billing_events (
      org_id,
      provider,
      provider_event_id,
      event_type,
      status,
      payload
    )
    VALUES (
      p_org_id,
      'manual',
      event_provider_event_id,
      event_type,
      event_status,
      jsonb_strip_nulls(jsonb_build_object(
        'operation', p_operation,
        'amount_twd', p_amount_twd,
        'effective_at', effective_at,
        'invoice_id', p_invoice_id,
        'reason', p_reason,
        'metadata', COALESCE(p_metadata, '{}'::jsonb)
      ))
    )
    ON CONFLICT (provider, provider_event_id)
    DO UPDATE SET provider_event_id = EXCLUDED.provider_event_id
    RETURNING id INTO created_billing_event_id;
  END IF;

  INSERT INTO public.audit_logs (
    org_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    p_org_id,
    p_actor_user_id,
    audit_action,
    'subscription',
    subscription_record.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'operation', p_operation,
      'previous_org_status', org_record.status,
      'previous_subscription_status', subscription_record.status,
      'next_status', next_status,
      'reason', p_reason,
      'amount_twd', p_amount_twd,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'effective_at', effective_at,
      'idempotency_key', p_idempotency_key,
      'invoice_id', p_invoice_id,
      'billing_event_id', created_billing_event_id,
      'metadata', COALESCE(p_metadata, '{}'::jsonb)
    ))
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'operation', p_operation,
    'org_id', p_org_id,
    'subscription_id', subscription_record.id,
    'audit_log_id', created_audit_log_id,
    'billing_event_id', created_billing_event_id,
    'invoice_id', p_invoice_id,
    'next_status', next_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.perform_platform_billing_operation(
  TEXT,
  UUID,
  UUID,
  TEXT,
  INTEGER,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  UUID,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.perform_platform_billing_operation(
  TEXT,
  UUID,
  UUID,
  TEXT,
  INTEGER,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  UUID,
  JSONB
) TO service_role;
