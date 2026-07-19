-- Harden self-service checkout creation against duplicate pending orders and
-- checkout-order floods. This migration is intentionally repository-only until
-- the SaaS Supabase migration rollout is explicitly approved. Never apply it to
-- the internal/live Supabase project.

CREATE INDEX IF NOT EXISTS idx_payment_orders_pending_checkout_reuse
ON public.payment_orders(
  org_id,
  provider,
  provider_mode,
  merchant_id,
  plan,
  amount_twd,
  expires_at DESC,
  created_at DESC
)
WHERE status = 'pending';

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
  checkout_now TIMESTAMPTZ := NOW();
  expected_amount_twd INTEGER;
  organization_record public.organizations%ROWTYPE;
  subscription_record public.subscriptions%ROWTYPE;
  existing_order public.payment_orders%ROWTYPE;
  reusable_order public.payment_orders%ROWTYPE;
  selected_order public.payment_orders%ROWTYPE;
  created_order public.payment_orders%ROWTYPE;
  current_plan_rank INTEGER;
  requested_plan_rank INTEGER;
  actor_limit_created_at TIMESTAMPTZ;
  org_limit_created_at TIMESTAMPTZ;
  actor_retry_after_seconds INTEGER := 0;
  org_retry_after_seconds INTEGER := 0;
  retry_after_seconds INTEGER := 0;
  rate_limit_scope TEXT;
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

  -- One transaction-scoped lock per organization makes the lookup, expiry,
  -- rolling-window checks, and insert atomic across all Vercel instances. The
  -- broader organization key also preserves idempotency when two plans race.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('self_service_checkout:' || p_org_id::text, 0)
  );

  UPDATE public.payment_orders
  SET
    status = 'expired',
    updated_at = checkout_now
  WHERE org_id = p_org_id
    AND status = 'pending'
    AND expires_at <= checkout_now;

  -- Lock a payment order before subscription and organization rows so checkout
  -- uses the same row-lock order as provider settlement.
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

    selected_order := existing_order;
  ELSE
    SELECT *
    INTO reusable_order
    FROM public.payment_orders
    WHERE org_id = p_org_id
      AND provider = normalized_provider
      AND provider_mode = normalized_provider_mode
      AND merchant_id = normalized_merchant_id
      AND plan = normalized_plan
      AND amount_twd = expected_amount_twd
      AND status = 'pending'
      AND expires_at > checkout_now
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      selected_order := reusable_order;
    END IF;
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

  -- Exact idempotent retries return their original terminal status so the API
  -- can refuse to sign it again. Different keys reuse only a live pending order.
  IF selected_order.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', selected_order.id,
      'org_id', selected_order.org_id,
      'provider', selected_order.provider,
      'provider_mode', selected_order.provider_mode,
      'plan', selected_order.plan,
      'amount_twd', selected_order.amount_twd,
      'merchant_id', selected_order.merchant_id,
      'merchant_trade_no', selected_order.merchant_trade_no,
      'status', selected_order.status,
      'created_at', selected_order.created_at,
      'expires_at', selected_order.expires_at,
      'disposition', CASE
        WHEN selected_order.id = existing_order.id THEN 'idempotent_replay'
        ELSE 'reused_pending'
      END
    );
  END IF;

  -- Fifth newest actor order still inside 15 minutes means five orders already
  -- exist and the next creation must wait until that row leaves the window.
  SELECT created_at
  INTO actor_limit_created_at
  FROM public.payment_orders
  WHERE org_id = p_org_id
    AND created_by = p_actor_user_id
    AND created_at > checkout_now - INTERVAL '15 minutes'
  ORDER BY created_at DESC
  OFFSET 4
  LIMIT 1;

  IF actor_limit_created_at IS NOT NULL THEN
    actor_retry_after_seconds := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (
        actor_limit_created_at + INTERVAL '15 minutes' - checkout_now
      )))::INTEGER
    );
  END IF;

  -- Tenth newest organization order still inside one hour means the tenant-wide
  -- durable order budget is exhausted, even when several admins alternate.
  SELECT created_at
  INTO org_limit_created_at
  FROM public.payment_orders
  WHERE org_id = p_org_id
    AND created_at > checkout_now - INTERVAL '1 hour'
  ORDER BY created_at DESC
  OFFSET 9
  LIMIT 1;

  IF org_limit_created_at IS NOT NULL THEN
    org_retry_after_seconds := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (
        org_limit_created_at + INTERVAL '1 hour' - checkout_now
      )))::INTEGER
    );
  END IF;

  retry_after_seconds := GREATEST(
    actor_retry_after_seconds,
    org_retry_after_seconds
  );

  IF retry_after_seconds > 0 THEN
    rate_limit_scope := CASE
      WHEN actor_retry_after_seconds > 0 AND org_retry_after_seconds > 0 THEN 'actor_and_org'
      WHEN actor_retry_after_seconds > 0 THEN 'actor'
      ELSE 'org'
    END;

    RETURN jsonb_build_object(
      'status', 'rate_limited',
      'error_code', 'checkout_rate_limited',
      'retry_after_seconds', retry_after_seconds,
      'scope', rate_limit_scope
    );
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
    'created_at', created_order.created_at,
    'expires_at', created_order.expires_at,
    'disposition', 'created'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_self_service_payment_order(
  UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_self_service_payment_order(
  UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION public.create_self_service_payment_order(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB)
IS 'Creates or reuses one pending prepaid ECPay order under a tenant lock, expires stale pending orders, and enforces durable actor and organization checkout limits.';
