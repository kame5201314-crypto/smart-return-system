-- DRAFT: SaaS self-service billing ledgers and atomic ECPay settlement.
--
-- This migration is intentionally not applied by repository checks. Apply it only to
-- the SaaS Supabase project after the ECPay credentials, backup, and rollout plan are
-- explicitly approved. Never apply it to the internal/live Supabase project.

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ecpay')),
  provider_mode TEXT NOT NULL CHECK (provider_mode IN ('test', 'production')),
  merchant_trade_no TEXT NOT NULL,
  trade_no TEXT,
  merchant_id TEXT NOT NULL,
  provider_event_id TEXT,
  idempotency_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'growth')),
  amount_twd INTEGER NOT NULL CHECK (amount_twd > 0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK (currency = 'TWD'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'manual_review', 'expired', 'cancelled', 'refunded')),
  simulate_paid BOOLEAN NOT NULL DEFAULT false,
  rtn_code INTEGER,
  rtn_message TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_mode, merchant_id, merchant_trade_no),
  UNIQUE (org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_org_created
ON public.payment_orders(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status_expires
ON public.payment_orders(status, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_provider_merchant_trade
ON public.payment_orders(provider, provider_mode, merchant_id, trade_no)
WHERE trade_no IS NOT NULL;

-- Keep billing-expiry suspension distinct from platform risk or policy
-- suspension. Only a billing-origin suspension may be cleared by a verified
-- payment; unknown legacy suspension is intentionally treated as platform
-- suspension and requires an operator.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS suspension_source TEXT;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_suspension_source_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_suspension_source_check
  CHECK (suspension_source IS NULL OR suspension_source IN ('trial_expired', 'billing', 'platform_admin'));

UPDATE public.organizations AS organization
SET suspension_source = COALESCE(
  (
    SELECT CASE audit.action
      WHEN 'lifecycle.trial_expired_suspended' THEN 'trial_expired'
      WHEN 'platform.billing.org_suspended' THEN 'platform_admin'
      ELSE NULL
    END
    FROM public.audit_logs AS audit
    WHERE audit.org_id = organization.id
      AND audit.action IN (
        'lifecycle.trial_expired_suspended',
        'platform.billing.org_suspended'
      )
    ORDER BY audit.created_at DESC
    LIMIT 1
  ),
  'platform_admin'
)
WHERE organization.status = 'suspended'
  AND organization.suspension_source IS NULL;

UPDATE public.organizations
SET suspension_source = NULL
WHERE status <> 'suspended'
  AND suspension_source IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_organization_suspension_source_from_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.action = 'lifecycle.trial_expired_suspended' THEN
    UPDATE public.organizations
    SET suspension_source = 'trial_expired', updated_at = NOW()
    WHERE id = NEW.org_id AND status = 'suspended';
  ELSIF NEW.action = 'platform.billing.org_suspended' THEN
    UPDATE public.organizations
    SET suspension_source = 'platform_admin', updated_at = NOW()
    WHERE id = NEW.org_id AND status = 'suspended';
  ELSIF NEW.action IN (
    'platform.billing.org_resumed',
    'platform.billing.manual_payment_marked'
  ) THEN
    UPDATE public.organizations
    SET suspension_source = NULL, updated_at = NOW()
    WHERE id = NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_organization_suspension_source ON public.audit_logs;
CREATE TRIGGER trg_sync_organization_suspension_source
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_organization_suspension_source_from_audit();

REVOKE ALL ON FUNCTION public.sync_organization_suspension_source_from_audit() FROM PUBLIC;

-- Migration 033 originally locked organizations before subscriptions. All
-- billing writers now use subscription -> organization (with the provider
-- settlement additionally locking its payment order first), preventing a
-- platform operation and an ECPay callback from deadlocking each other.
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
  INTO subscription_record
  FROM public.subscriptions
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for organization: %', p_org_id;
  END IF;

  SELECT *
  INTO org_record
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found: %', p_org_id;
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
      suspension_source = NULL,
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
      suspension_source = 'platform_admin',
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
      suspension_source = NULL,
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
  TEXT, UUID, UUID, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, UUID, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perform_platform_billing_operation(
  TEXT, UUID, UUID, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ,
  TIMESTAMPTZ, TEXT, UUID, JSONB
) TO service_role;

CREATE TABLE IF NOT EXISTS public.subscription_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'growth')),
  provider TEXT NOT NULL CHECK (provider IN ('ecpay')),
  provider_mode TEXT NOT NULL CHECK (provider_mode IN ('test', 'production')),
  merchant_trade_no TEXT NOT NULL,
  trade_no TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  amount_twd INTEGER NOT NULL CHECK (amount_twd > 0),
  currency TEXT NOT NULL DEFAULT 'TWD' CHECK (currency = 'TWD'),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end > period_start),
  UNIQUE (payment_order_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_periods_org_start
ON public.subscription_periods(org_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_periods_subscription_end
ON public.subscription_periods(subscription_id, period_end DESC);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_billing_admins_select_payment_orders" ON public.payment_orders;
CREATE POLICY "org_billing_admins_select_payment_orders"
  ON public.payment_orders
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(org_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "org_billing_admins_select_subscription_periods" ON public.subscription_periods;
CREATE POLICY "org_billing_admins_select_subscription_periods"
  ON public.subscription_periods
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(org_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "service_role_full_payment_orders" ON public.payment_orders;
CREATE POLICY "service_role_full_payment_orders"
  ON public.payment_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_subscription_periods" ON public.subscription_periods;
CREATE POLICY "service_role_full_subscription_periods"
  ON public.subscription_periods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.create_self_service_payment_order(
  p_org_id UUID,
  p_actor_user_id UUID,
  p_provider TEXT,
  p_provider_mode TEXT,
  p_plan TEXT,
  p_amount_twd INTEGER,
  p_merchant_trade_no TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_plan TEXT := LOWER(BTRIM(COALESCE(p_plan, '')));
  normalized_provider TEXT := LOWER(BTRIM(COALESCE(p_provider, '')));
  normalized_provider_mode TEXT := LOWER(BTRIM(COALESCE(p_provider_mode, '')));
  normalized_merchant_trade_no TEXT := BTRIM(COALESCE(p_merchant_trade_no, ''));
  normalized_merchant_id TEXT := BTRIM(COALESCE(p_metadata ->> 'merchant_id', ''));
  normalized_idempotency_key TEXT := BTRIM(COALESCE(p_idempotency_key, ''));
  expected_amount_twd INTEGER;
  organization_record public.organizations%ROWTYPE;
  subscription_record public.subscriptions%ROWTYPE;
  existing_order public.payment_orders%ROWTYPE;
  created_order public.payment_orders%ROWTYPE;
  current_plan_rank INTEGER;
  requested_plan_rank INTEGER;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required to create payment orders';
  END IF;

  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    WHERE member.org_id = p_org_id
      AND member.user_id = p_actor_user_id
      AND member.role IN ('owner', 'admin')
      AND COALESCE(member.status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'active owner or admin membership is required to create a payment order';
  END IF;

  expected_amount_twd := CASE normalized_plan
    WHEN 'basic' THEN 399
    WHEN 'growth' THEN 699
    ELSE NULL
  END;

  IF expected_amount_twd IS NULL THEN
    RAISE EXCEPTION 'self-service plan must be basic or growth';
  END IF;

  IF p_amount_twd IS NULL OR p_amount_twd <> expected_amount_twd THEN
    RAISE EXCEPTION 'amount_twd does not match the server price for plan %', normalized_plan;
  END IF;

  IF normalized_provider <> 'ecpay' THEN
    RAISE EXCEPTION 'self-service billing provider must be ecpay';
  END IF;

  IF normalized_provider_mode NOT IN ('test', 'production') THEN
    RAISE EXCEPTION 'provider_mode must be test or production';
  END IF;

  IF normalized_merchant_trade_no !~ '^[A-Za-z0-9]{1,20}$' THEN
    RAISE EXCEPTION 'merchant_trade_no must be 1-20 ASCII letters or digits';
  END IF;

  IF normalized_merchant_id = '' OR CHAR_LENGTH(normalized_merchant_id) > 64 THEN
    RAISE EXCEPTION 'merchant_id is required and must be at most 64 characters';
  END IF;

  IF CHAR_LENGTH(normalized_idempotency_key) < 16
     OR CHAR_LENGTH(normalized_idempotency_key) > 160 THEN
    RAISE EXCEPTION 'idempotency_key must be between 16 and 160 characters';
  END IF;

  -- Serialize the first insert for the same tenant/idempotency key. Without
  -- this transaction-scoped lock, two first requests can both miss the lookup
  -- and the second would surface a unique-constraint error instead of reusing
  -- the durable order.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || normalized_idempotency_key, 0)
  );

  -- Keep the same lock order as payment settlement: payment order,
  -- subscription, then organization. This prevents checkout retries and the
  -- provider webhook from waiting on each other in reverse order.
  SELECT *
  INTO existing_order
  FROM public.payment_orders
  WHERE org_id = p_org_id
    AND idempotency_key = normalized_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF existing_order.plan <> normalized_plan
       OR existing_order.provider <> normalized_provider
       OR existing_order.provider_mode <> normalized_provider_mode
       OR existing_order.merchant_id <> normalized_merchant_id
       OR existing_order.amount_twd <> expected_amount_twd THEN
      RAISE EXCEPTION 'idempotency_key was already used with different checkout parameters';
    END IF;

    RETURN jsonb_build_object(
      'id', existing_order.id,
      'org_id', existing_order.org_id,
      'provider', existing_order.provider,
      'provider_mode', existing_order.provider_mode,
      'plan', existing_order.plan,
      'amount_twd', existing_order.amount_twd,
      'merchant_id', existing_order.merchant_id,
      'merchant_trade_no', existing_order.merchant_trade_no,
      'status', existing_order.status,
      'created_at', existing_order.created_at
    );
  END IF;

  SELECT *
  INTO subscription_record
  FROM public.subscriptions
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found';
  END IF;

  SELECT *
  INTO organization_record
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  IF organization_record.status = 'suspended'
     AND COALESCE(organization_record.suspension_source, 'platform_admin')
       NOT IN ('trial_expired', 'billing') THEN
    RAISE EXCEPTION 'platform-suspended organizations require operator review';
  END IF;

  current_plan_rank := GREATEST(
    CASE organization_record.plan
      WHEN 'basic' THEN 1
      WHEN 'growth' THEN 2
      WHEN 'pro' THEN 3
      WHEN 'enterprise' THEN 4
      ELSE 0
    END,
    CASE subscription_record.plan
      WHEN 'basic' THEN 1
      WHEN 'growth' THEN 2
      WHEN 'pro' THEN 3
      WHEN 'enterprise' THEN 4
      ELSE 0
    END
  );
  requested_plan_rank := CASE normalized_plan
    WHEN 'basic' THEN 1
    WHEN 'growth' THEN 2
    ELSE 0
  END;

  IF requested_plan_rank < current_plan_rank THEN
    RAISE EXCEPTION 'self-service checkout cannot downgrade the current plan';
  END IF;

  INSERT INTO public.payment_orders (
    org_id,
    subscription_id,
    provider,
    provider_mode,
    merchant_trade_no,
    merchant_id,
    idempotency_key,
    plan,
    amount_twd,
    created_by,
    metadata
  )
  VALUES (
    p_org_id,
    subscription_record.id,
    normalized_provider,
    normalized_provider_mode,
    normalized_merchant_trade_no,
    normalized_merchant_id,
    normalized_idempotency_key,
    normalized_plan,
    expected_amount_twd,
    p_actor_user_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO created_order;

  RETURN jsonb_build_object(
    'id', created_order.id,
    'org_id', created_order.org_id,
    'provider', created_order.provider,
    'provider_mode', created_order.provider_mode,
    'plan', created_order.plan,
    'amount_twd', created_order.amount_twd,
    'merchant_id', created_order.merchant_id,
    'merchant_trade_no', created_order.merchant_trade_no,
    'status', created_order.status,
    'created_at', created_order.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_ecpay_payment_notification(
  p_merchant_trade_no TEXT,
  p_provider_event_id TEXT,
  p_trade_no TEXT,
  p_merchant_id TEXT,
  p_provider_mode TEXT,
  p_trade_amount_twd INTEGER,
  p_rtn_code INTEGER,
  p_rtn_message TEXT,
  p_simulate_paid BOOLEAN,
  p_payment_date TIMESTAMPTZ,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_merchant_trade_no TEXT := BTRIM(COALESCE(p_merchant_trade_no, ''));
  normalized_provider_event_id TEXT := BTRIM(COALESCE(p_provider_event_id, ''));
  normalized_trade_no TEXT := NULLIF(BTRIM(COALESCE(p_trade_no, '')), '');
  normalized_merchant_id TEXT := NULLIF(BTRIM(COALESCE(p_merchant_id, '')), '');
  normalized_provider_mode TEXT := LOWER(BTRIM(COALESCE(p_provider_mode, '')));
  effective_at TIMESTAMPTZ := COALESCE(p_payment_date, NOW());
  payment_order_record public.payment_orders%ROWTYPE;
  subscription_record public.subscriptions%ROWTYPE;
  organization_record public.organizations%ROWTYPE;
  subscription_period_record public.subscription_periods%ROWTYPE;
  existing_event public.billing_events%ROWTYPE;
  created_billing_event_id UUID;
  created_audit_log_id UUID;
  expected_merchant_id TEXT;
  failure_code TEXT;
  failure_status TEXT;
  current_plan_rank INTEGER;
  requested_plan_rank INTEGER;
  period_start TIMESTAMPTZ;
  period_end TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required to process payment notifications';
  END IF;

  IF normalized_merchant_trade_no = '' OR normalized_provider_event_id = '' THEN
    RAISE EXCEPTION 'merchant_trade_no and provider_event_id are required';
  END IF;

  IF normalized_provider_mode NOT IN ('test', 'production') THEN
    RAISE EXCEPTION 'provider_mode must be test or production';
  END IF;

  SELECT *
  INTO existing_event
  FROM public.billing_events
  WHERE provider = 'ecpay'
    AND provider_event_id = normalized_provider_event_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'merchant_trade_no', normalized_merchant_trade_no,
      'billing_event_id', existing_event.id
    );
  END IF;

  SELECT *
  INTO payment_order_record
  FROM public.payment_orders
  WHERE provider = 'ecpay'
    AND provider_mode = normalized_provider_mode
    AND merchant_id = normalized_merchant_id
    AND merchant_trade_no = normalized_merchant_trade_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ignored',
      'merchant_trade_no', normalized_merchant_trade_no,
      'reason', 'payment_order_not_found'
    );
  END IF;

  expected_merchant_id := NULLIF(BTRIM(COALESCE(
    payment_order_record.merchant_id,
    payment_order_record.metadata ->> 'merchant_id',
    ''
  )), '');

  -- A callback after a committed success is a pure duplicate. Record the
  -- provider retry for diagnostics, but never calculate or append a new period.
  IF payment_order_record.status IN ('paid', 'manual_review') THEN
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
      payment_order_record.org_id,
      'ecpay',
      normalized_provider_event_id,
      CASE
        WHEN payment_order_record.status = 'manual_review'
          THEN 'ecpay.payment_manual_review_duplicate'
        ELSE 'ecpay.payment_duplicate'
      END,
      'ignored',
      jsonb_build_object(
        'payment_order_id', payment_order_record.id,
        'merchant_trade_no', normalized_merchant_trade_no,
        'trade_no', normalized_trade_no,
        'payload', COALESCE(p_payload, '{}'::jsonb)
      ),
      effective_at
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id INTO created_billing_event_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'payment_order_id', payment_order_record.id,
      'merchant_trade_no', normalized_merchant_trade_no,
      'billing_event_id', created_billing_event_id
    );
  END IF;

  failure_code := CASE
    WHEN COALESCE(p_simulate_paid, false) THEN 'simulate_paid'
    WHEN p_rtn_code IS DISTINCT FROM 1 THEN 'provider_payment_failed'
    WHEN p_trade_amount_twd IS NULL
      OR p_trade_amount_twd <> payment_order_record.amount_twd THEN 'amount_mismatch'
    WHEN normalized_trade_no IS NULL THEN 'trade_no_missing'
    WHEN normalized_merchant_id IS NULL THEN 'merchant_id_missing'
    WHEN expected_merchant_id IS NOT NULL
      AND normalized_merchant_id <> expected_merchant_id THEN 'merchant_id_mismatch'
    ELSE NULL
  END;

  IF failure_code IS NOT NULL THEN
    failure_status := CASE
      WHEN failure_code = 'simulate_paid' THEN 'ignored'
      ELSE 'failed'
    END;

    UPDATE public.payment_orders
    SET
      status = CASE WHEN failure_status = 'failed' THEN 'failed' ELSE status END,
      trade_no = COALESCE(normalized_trade_no, trade_no),
      merchant_id = COALESCE(merchant_id, normalized_merchant_id),
      provider_event_id = normalized_provider_event_id,
      simulate_paid = COALESCE(p_simulate_paid, false),
      rtn_code = p_rtn_code,
      rtn_message = NULLIF(BTRIM(COALESCE(p_rtn_message, '')), ''),
      metadata = metadata || jsonb_build_object(
        'last_notification', COALESCE(p_payload, '{}'::jsonb),
        'failure_code', failure_code
      ),
      updated_at = NOW()
    WHERE id = payment_order_record.id;

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
      payment_order_record.org_id,
      'ecpay',
      normalized_provider_event_id,
      CASE
        WHEN failure_code = 'simulate_paid' THEN 'ecpay.payment_simulated'
        WHEN failure_code = 'amount_mismatch' THEN 'ecpay.payment_amount_mismatch'
        WHEN failure_code = 'merchant_id_mismatch' THEN 'ecpay.payment_merchant_mismatch'
        ELSE 'ecpay.payment_failed'
      END,
      failure_status,
      jsonb_strip_nulls(jsonb_build_object(
        'payment_order_id', payment_order_record.id,
        'merchant_trade_no', normalized_merchant_trade_no,
        'trade_no', normalized_trade_no,
        'merchant_id', normalized_merchant_id,
        'expected_amount_twd', payment_order_record.amount_twd,
        'received_amount_twd', p_trade_amount_twd,
        'rtn_code', p_rtn_code,
        'rtn_message', p_rtn_message,
        'simulate_paid', COALESCE(p_simulate_paid, false),
        'failure_code', failure_code,
        'payload', COALESCE(p_payload, '{}'::jsonb)
      )),
      effective_at
    )
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING id INTO created_billing_event_id;

    IF created_billing_event_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'duplicate',
        'payment_order_id', payment_order_record.id,
        'merchant_trade_no', normalized_merchant_trade_no
      );
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
      payment_order_record.org_id,
      NULL,
      'self_service.billing.payment_rejected',
      'payment_order',
      payment_order_record.id::text,
      jsonb_build_object(
        'provider_event_id', normalized_provider_event_id,
        'billing_event_id', created_billing_event_id,
        'failure_code', failure_code
      )
    )
    RETURNING id INTO created_audit_log_id;

    RETURN jsonb_build_object(
      'status', failure_status,
      'payment_order_id', payment_order_record.id,
      'merchant_trade_no', normalized_merchant_trade_no,
      'reason', failure_code,
      'billing_event_id', created_billing_event_id,
      'audit_log_id', created_audit_log_id
    );
  END IF;

  -- Claim the unique provider event before changing billing state. Concurrent
  -- delivery of the same event can therefore never append a second period.
  INSERT INTO public.billing_events (
    org_id,
    provider,
    provider_event_id,
    event_type,
    status,
    payload
  )
  VALUES (
    payment_order_record.org_id,
    'ecpay',
    normalized_provider_event_id,
    'ecpay.payment_succeeded',
    'received',
    jsonb_strip_nulls(jsonb_build_object(
      'payment_order_id', payment_order_record.id,
      'merchant_trade_no', normalized_merchant_trade_no,
      'trade_no', normalized_trade_no,
      'merchant_id', normalized_merchant_id,
      'amount_twd', p_trade_amount_twd,
      'rtn_code', p_rtn_code,
      'rtn_message', p_rtn_message,
      'simulate_paid', false,
      'payload', COALESCE(p_payload, '{}'::jsonb)
    ))
  )
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING id INTO created_billing_event_id;

  IF created_billing_event_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'payment_order_id', payment_order_record.id,
      'merchant_trade_no', normalized_merchant_trade_no
    );
  END IF;

  SELECT *
  INTO subscription_record
  FROM public.subscriptions
  WHERE id = payment_order_record.subscription_id
    AND org_id = payment_order_record.org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found for payment order';
  END IF;

  SELECT *
  INTO organization_record
  FROM public.organizations
  WHERE id = payment_order_record.org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found for payment order';
  END IF;

  current_plan_rank := GREATEST(
    CASE organization_record.plan
      WHEN 'basic' THEN 1
      WHEN 'growth' THEN 2
      WHEN 'pro' THEN 3
      WHEN 'enterprise' THEN 4
      ELSE 0
    END,
    CASE subscription_record.plan
      WHEN 'basic' THEN 1
      WHEN 'growth' THEN 2
      WHEN 'pro' THEN 3
      WHEN 'enterprise' THEN 4
      ELSE 0
    END
  );
  requested_plan_rank := CASE payment_order_record.plan
    WHEN 'basic' THEN 1
    WHEN 'growth' THEN 2
    ELSE 0
  END;

  failure_code := CASE
    WHEN organization_record.status = 'suspended'
      AND COALESCE(organization_record.suspension_source, 'platform_admin')
        NOT IN ('trial_expired', 'billing')
      THEN 'platform_suspension_requires_review'
    WHEN requested_plan_rank < current_plan_rank
      THEN 'stale_order_downgrade_requires_review'
    ELSE NULL
  END;

  IF failure_code IS NOT NULL THEN
    UPDATE public.payment_orders
    SET
      status = 'manual_review',
      trade_no = normalized_trade_no,
      merchant_id = normalized_merchant_id,
      provider_event_id = normalized_provider_event_id,
      simulate_paid = false,
      rtn_code = p_rtn_code,
      rtn_message = NULLIF(BTRIM(COALESCE(p_rtn_message, '')), ''),
      paid_at = effective_at,
      metadata = metadata || jsonb_build_object(
        'last_notification', COALESCE(p_payload, '{}'::jsonb),
        'manual_review_reason', failure_code
      ),
      updated_at = NOW()
    WHERE id = payment_order_record.id;

    UPDATE public.billing_events
    SET
      event_type = 'ecpay.payment_manual_review',
      status = 'failed',
      processed_at = effective_at,
      payload = payload || jsonb_build_object(
        'manual_review_reason', failure_code,
        'current_org_plan', organization_record.plan,
        'current_subscription_plan', subscription_record.plan,
        'requested_plan', payment_order_record.plan
      )
    WHERE id = created_billing_event_id;

    INSERT INTO public.audit_logs (
      org_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      payment_order_record.org_id,
      NULL,
      'self_service.billing.payment_manual_review',
      'payment_order',
      payment_order_record.id::text,
      jsonb_build_object(
        'provider_event_id', normalized_provider_event_id,
        'billing_event_id', created_billing_event_id,
        'reason', failure_code,
        'current_org_plan', organization_record.plan,
        'current_subscription_plan', subscription_record.plan,
        'requested_plan', payment_order_record.plan
      )
    )
    RETURNING id INTO created_audit_log_id;

    RETURN jsonb_build_object(
      'status', 'failed',
      'payment_order_id', payment_order_record.id,
      'merchant_trade_no', normalized_merchant_trade_no,
      'reason', failure_code,
      'billing_event_id', created_billing_event_id,
      'audit_log_id', created_audit_log_id
    );
  END IF;

  period_start := CASE
    WHEN requested_plan_rank = current_plan_rank
      AND subscription_record.current_period_end IS NOT NULL
      AND subscription_record.current_period_end > effective_at
      THEN subscription_record.current_period_end
    ELSE effective_at
  END;
  period_end := period_start + INTERVAL '1 month';

  INSERT INTO public.subscription_periods (
    org_id,
    subscription_id,
    payment_order_id,
    plan,
    provider,
    provider_mode,
    merchant_trade_no,
    trade_no,
    period_start,
    period_end,
    amount_twd,
    status
  )
  VALUES (
    payment_order_record.org_id,
    subscription_record.id,
    payment_order_record.id,
    payment_order_record.plan,
    'ecpay',
    payment_order_record.provider_mode,
    normalized_merchant_trade_no,
    normalized_trade_no,
    period_start,
    period_end,
    payment_order_record.amount_twd,
    'active'
  )
  RETURNING * INTO subscription_period_record;

  UPDATE public.payment_orders
  SET
    status = 'paid',
    trade_no = normalized_trade_no,
    merchant_id = normalized_merchant_id,
    provider_event_id = normalized_provider_event_id,
    simulate_paid = false,
    rtn_code = p_rtn_code,
    rtn_message = NULLIF(BTRIM(COALESCE(p_rtn_message, '')), ''),
    paid_at = effective_at,
    metadata = metadata || jsonb_build_object(
      'last_notification', COALESCE(p_payload, '{}'::jsonb)
    ),
    updated_at = NOW()
  WHERE id = payment_order_record.id;

  UPDATE public.subscriptions
  SET
    plan = payment_order_record.plan,
    status = 'active',
    provider = 'ecpay',
    current_period_start = period_start,
    current_period_end = period_end,
    cancel_at_period_end = false,
    canceled_at = NULL,
    updated_at = NOW()
  WHERE id = subscription_record.id;

  UPDATE public.organizations
  SET
    plan = payment_order_record.plan,
    status = 'active',
    suspended_at = NULL,
    suspension_source = NULL,
    updated_at = NOW()
  WHERE id = payment_order_record.org_id;

  UPDATE public.billing_events
  SET
    status = 'processed',
    processed_at = effective_at,
    payload = payload || jsonb_build_object(
      'subscription_period_id', subscription_period_record.id,
      'period_start', period_start,
      'period_end', period_end
    )
  WHERE id = created_billing_event_id;

  INSERT INTO public.audit_logs (
    org_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    payment_order_record.org_id,
    NULL,
    'self_service.billing.payment_applied',
    'payment_order',
    payment_order_record.id::text,
    jsonb_build_object(
      'provider_event_id', normalized_provider_event_id,
      'billing_event_id', created_billing_event_id,
      'subscription_period_id', subscription_period_record.id,
      'plan', payment_order_record.plan,
      'amount_twd', payment_order_record.amount_twd,
      'period_start', period_start,
      'period_end', period_end
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'status', 'processed',
    'payment_order_id', payment_order_record.id,
    'subscription_period_id', subscription_period_record.id,
    'merchant_trade_no', normalized_merchant_trade_no,
    'period_start', period_start,
    'period_end', period_end,
    'billing_event_id', created_billing_event_id,
    'audit_log_id', created_audit_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_self_service_payment_order(
  UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_self_service_payment_order(
  UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.process_ecpay_payment_notification(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TIMESTAMPTZ, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_ecpay_payment_notification(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TIMESTAMPTZ, JSONB
) TO service_role;

COMMENT ON TABLE public.payment_orders
  IS 'Server-priced ECPay checkout orders. Provider callbacks settle orders through a service-role-only RPC.';
COMMENT ON TABLE public.subscription_periods
  IS 'Immutable paid subscription period history. One row is created for each successfully settled payment order.';
COMMENT ON FUNCTION public.create_self_service_payment_order(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB)
  IS 'Service-role-only checkout creation. The supplied actor must be an active organization owner/admin and the amount must match the server price.';
COMMENT ON FUNCTION public.process_ecpay_payment_notification(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TIMESTAMPTZ, JSONB)
  IS 'Atomically settles a verified ECPay notification. Failed, mismatched, or SimulatePaid notifications never activate a subscription.';
