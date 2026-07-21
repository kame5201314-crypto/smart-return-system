-- Private, operator-created offers for one organization.
--
-- This migration is repository-only until the SaaS Supabase rollout is
-- explicitly approved. Apply it only after migrations 046 and 048, and never
-- apply it to the protected internal/live Supabase project.

CREATE TABLE IF NOT EXISTS public.custom_plan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (
    CHAR_LENGTH(title) BETWEEN 2 AND 80
    AND POSITION('#' IN title) = 0
    AND title !~ '[[:cntrl:]]'
  ),
  description TEXT CHECK (description IS NULL OR CHAR_LENGTH(description) <= 500),
  amount_twd INTEGER NOT NULL CHECK (amount_twd BETWEEN 5 AND 199999),
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan = 'basic'),
  billing_period_months INTEGER NOT NULL DEFAULT 1 CHECK (billing_period_months = 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
    CHECK (cancellation_reason IS NULL OR CHAR_LENGTH(cancellation_reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at),
  CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL)
    OR
    (status <> 'cancelled' AND cancelled_at IS NULL AND cancellation_reason IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_custom_plan_offers_org_status_expires
ON public.custom_plan_offers(org_id, status, expires_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_orders_custom_offer_lookup
ON public.payment_orders((metadata ->> 'custom_offer_id'), created_at DESC)
WHERE metadata ->> 'pricing_kind' = 'custom_offer';

-- A private offer is a one-shot commercial instrument. Once any payment order
-- has been issued for it, that same offer can never mint another order, even if
-- the first order later fails, expires, is cancelled, or needs manual review.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_custom_offer_single_checkout
ON public.payment_orders((metadata ->> 'custom_offer_id'))
WHERE metadata ->> 'pricing_kind' = 'custom_offer';

CREATE OR REPLACE FUNCTION public.set_custom_plan_offer_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_custom_plan_offer_updated_at
ON public.custom_plan_offers;

CREATE TRIGGER trg_set_custom_plan_offer_updated_at
BEFORE UPDATE ON public.custom_plan_offers
FOR EACH ROW
EXECUTE FUNCTION public.set_custom_plan_offer_updated_at();

ALTER TABLE public.custom_plan_offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_custom_plan_offer_billing_admin(
  p_org_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    WHERE member.org_id = p_org_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin')
      AND member.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_custom_plan_offer_billing_admin(UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_custom_plan_offer_billing_admin(UUID)
TO authenticated, service_role;

DROP POLICY IF EXISTS "org_billing_admins_select_custom_plan_offers"
ON public.custom_plan_offers;
CREATE POLICY "org_billing_admins_select_custom_plan_offers"
  ON public.custom_plan_offers
  FOR SELECT
  TO authenticated
  USING (public.is_active_custom_plan_offer_billing_admin(org_id));

DROP POLICY IF EXISTS "service_role_full_custom_plan_offers"
ON public.custom_plan_offers;
CREATE POLICY "service_role_full_custom_plan_offers"
  ON public.custom_plan_offers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.custom_plan_offers FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  org_id,
  title,
  description,
  amount_twd,
  plan,
  billing_period_months,
  status,
  expires_at,
  payment_order_id,
  created_at,
  updated_at
) ON TABLE public.custom_plan_offers TO authenticated;
GRANT ALL ON TABLE public.custom_plan_offers TO service_role;

CREATE OR REPLACE FUNCTION public.validate_custom_plan_offer_actor_metadata(
  p_actor_user_id UUID,
  p_actor_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  actor_kind TEXT;
  actor_fingerprint_sha256 TEXT;
  platform_role TEXT;
BEGIN
  IF p_actor_metadata IS NULL
     OR jsonb_typeof(p_actor_metadata) <> 'object'
     OR NOT (
       p_actor_metadata ?& ARRAY[
         'actor_kind',
         'actor_fingerprint_sha256',
         'platform_role'
       ]
     )
     OR EXISTS (
       SELECT 1
       FROM jsonb_object_keys(p_actor_metadata) AS actor_key(key_name)
       WHERE actor_key.key_name NOT IN (
         'actor_kind',
         'actor_fingerprint_sha256',
         'platform_role'
       )
     ) THEN
    RAISE EXCEPTION 'actor metadata must contain exactly the approved audit fields';
  END IF;

  actor_kind := p_actor_metadata ->> 'actor_kind';
  actor_fingerprint_sha256 := p_actor_metadata ->> 'actor_fingerprint_sha256';
  platform_role := p_actor_metadata ->> 'platform_role';

  IF actor_kind IS NULL
     OR actor_kind NOT IN ('legacy_admin', 'authenticated_platform_admin')
     OR actor_fingerprint_sha256 IS NULL
     OR actor_fingerprint_sha256 !~ '^[0-9a-f]{64}$'
     OR platform_role IS NULL
     OR platform_role NOT IN ('owner', 'support', 'billing') THEN
    RAISE EXCEPTION 'actor metadata contains an invalid audit value';
  END IF;

  IF (p_actor_user_id IS NULL AND actor_kind IS DISTINCT FROM 'legacy_admin')
     OR (
       p_actor_user_id IS NOT NULL
       AND actor_kind IS DISTINCT FROM 'authenticated_platform_admin'
     ) THEN
    RAISE EXCEPTION 'actor metadata kind does not match actor_user_id';
  END IF;

  RETURN jsonb_build_object(
    'actor_kind', actor_kind,
    'actor_fingerprint_sha256', actor_fingerprint_sha256,
    'platform_role', platform_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_custom_plan_offer(
  p_org_id UUID,
  p_actor_user_id UUID,
  p_actor_metadata JSONB,
  p_title TEXT,
  p_description TEXT,
  p_amount_twd INTEGER,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offer_now TIMESTAMPTZ := NOW();
  normalized_title TEXT := BTRIM(COALESCE(p_title, ''));
  normalized_description TEXT := NULLIF(BTRIM(COALESCE(p_description, '')), '');
  normalized_actor_metadata JSONB;
  created_offer public.custom_plan_offers%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required to create custom plan offers';
  END IF;

  normalized_actor_metadata := public.validate_custom_plan_offer_actor_metadata(
    p_actor_user_id,
    p_actor_metadata
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_org_id
  ) THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  IF CHAR_LENGTH(normalized_title) NOT BETWEEN 2 AND 80
     OR normalized_title ~ '[[:cntrl:]]'
     OR POSITION('#' IN normalized_title) > 0 THEN
    RAISE EXCEPTION 'title must contain 2-80 printable characters without #';
  END IF;

  IF normalized_description IS NOT NULL
     AND (
       CHAR_LENGTH(normalized_description) > 500
       OR normalized_description ~ '[[:cntrl:]]'
     ) THEN
    RAISE EXCEPTION 'description must contain at most 500 printable characters';
  END IF;

  IF p_amount_twd IS NULL OR p_amount_twd NOT BETWEEN 5 AND 199999 THEN
    RAISE EXCEPTION 'amount_twd must be between 5 and 199999';
  END IF;

  IF p_expires_at IS NULL
     OR p_expires_at < offer_now + INTERVAL '1 hour'
     OR p_expires_at > offer_now + INTERVAL '90 days' THEN
    RAISE EXCEPTION 'expires_at must be between 1 hour and 90 days from now';
  END IF;

  INSERT INTO public.custom_plan_offers (
    org_id,
    title,
    description,
    amount_twd,
    plan,
    billing_period_months,
    status,
    expires_at,
    created_by
  )
  VALUES (
    p_org_id,
    normalized_title,
    normalized_description,
    p_amount_twd,
    'basic',
    1,
    'active',
    p_expires_at,
    p_actor_user_id
  )
  RETURNING * INTO created_offer;

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
    'custom_plan.offer_created',
    'custom_plan_offer',
    created_offer.id::text,
    jsonb_build_object(
      'title', created_offer.title,
      'amount_twd', created_offer.amount_twd,
      'plan', created_offer.plan,
      'billing_period_months', created_offer.billing_period_months,
      'expires_at', created_offer.expires_at
    ) || normalized_actor_metadata
  );

  RETURN to_jsonb(created_offer);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_custom_plan_offer(
  p_offer_id UUID,
  p_actor_user_id UUID,
  p_actor_metadata JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_reason TEXT := BTRIM(COALESCE(p_reason, ''));
  normalized_actor_metadata JSONB;
  offer_record public.custom_plan_offers%ROWTYPE;
  cancelled_offer public.custom_plan_offers%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required to cancel custom plan offers';
  END IF;

  normalized_actor_metadata := public.validate_custom_plan_offer_actor_metadata(
    p_actor_user_id,
    p_actor_metadata
  );

  IF CHAR_LENGTH(normalized_reason) NOT BETWEEN 4 AND 500
     OR normalized_reason ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'cancellation reason must contain 4-500 printable characters';
  END IF;

  SELECT *
  INTO offer_record
  FROM public.custom_plan_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'custom plan offer not found';
  END IF;

  IF offer_record.status <> 'active' THEN
    RAISE EXCEPTION 'only an active custom plan offer may be cancelled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_orders AS payment_order
    WHERE payment_order.metadata ->> 'pricing_kind' = 'custom_offer'
      AND payment_order.metadata ->> 'custom_offer_id' = offer_record.id::text
  ) THEN
    RAISE EXCEPTION 'custom plan offer cannot be cancelled after a payment order has been issued';
  END IF;

  UPDATE public.custom_plan_offers
  SET
    status = 'cancelled',
    cancelled_by = p_actor_user_id,
    cancelled_at = NOW(),
    cancellation_reason = normalized_reason
  WHERE id = offer_record.id
  RETURNING * INTO cancelled_offer;

  INSERT INTO public.audit_logs (
    org_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    offer_record.org_id,
    p_actor_user_id,
    'custom_plan.offer_cancelled',
    'custom_plan_offer',
    offer_record.id::text,
    jsonb_build_object(
      'reason', normalized_reason,
      'amount_twd', offer_record.amount_twd,
      'expires_at', offer_record.expires_at
    ) || normalized_actor_metadata
  );

  RETURN to_jsonb(cancelled_offer);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_custom_plan_payment_order(
  p_offer_id UUID,
  p_org_id UUID,
  p_actor_user_id UUID,
  p_provider TEXT,
  p_provider_mode TEXT,
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
  normalized_provider TEXT := LOWER(BTRIM(COALESCE(p_provider, '')));
  normalized_provider_mode TEXT := LOWER(BTRIM(COALESCE(p_provider_mode, '')));
  normalized_merchant_trade_no TEXT := BTRIM(COALESCE(p_merchant_trade_no, ''));
  normalized_merchant_id TEXT := BTRIM(COALESCE(p_metadata ->> 'merchant_id', ''));
  normalized_idempotency_key TEXT := BTRIM(COALESCE(p_idempotency_key, ''));
  checkout_now TIMESTAMPTZ := NOW();
  organization_record public.organizations%ROWTYPE;
  subscription_record public.subscriptions%ROWTYPE;
  offer_record public.custom_plan_offers%ROWTYPE;
  existing_order public.payment_orders%ROWTYPE;
  reusable_order public.payment_orders%ROWTYPE;
  selected_order public.payment_orders%ROWTYPE;
  created_order public.payment_orders%ROWTYPE;
  actor_limit_created_at TIMESTAMPTZ;
  org_limit_created_at TIMESTAMPTZ;
  actor_retry_after_seconds INTEGER := 0;
  org_retry_after_seconds INTEGER := 0;
  retry_after_seconds INTEGER := 0;
  rate_limit_scope TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role is required to create custom plan payment orders';
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

  IF normalized_provider <> 'ecpay' THEN
    RAISE EXCEPTION 'custom offer billing provider must be ecpay';
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

  -- Use the same organization lock and payment -> subscription -> organization
  -- lock order as self-service checkout and provider settlement.
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

  SELECT *
  INTO existing_order
  FROM public.payment_orders
  WHERE org_id = p_org_id
    AND idempotency_key = normalized_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF existing_order.provider IS DISTINCT FROM normalized_provider
       OR existing_order.provider_mode IS DISTINCT FROM normalized_provider_mode
       OR existing_order.merchant_id IS DISTINCT FROM normalized_merchant_id
       OR existing_order.metadata ->> 'pricing_kind' IS DISTINCT FROM 'custom_offer'
       OR existing_order.metadata ->> 'custom_offer_id' IS DISTINCT FROM p_offer_id::text THEN
      RAISE EXCEPTION 'idempotency_key was already used with different checkout parameters';
    END IF;
    selected_order := existing_order;
  ELSE
    -- Find the one permanently associated order regardless of its status or
    -- the provider configuration currently deployed. A terminal or otherwise
    -- non-reusable order closes the offer instead of minting a replacement.
    SELECT *
    INTO reusable_order
    FROM public.payment_orders
    WHERE metadata ->> 'pricing_kind' = 'custom_offer'
      AND metadata ->> 'custom_offer_id' = p_offer_id::text
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

  SELECT *
  INTO offer_record
  FROM public.custom_plan_offers
  WHERE id = p_offer_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'custom plan offer not found';
  END IF;

  IF selected_order.id IS NOT NULL
     AND (
       selected_order.org_id <> offer_record.org_id
       OR selected_order.metadata ->> 'pricing_kind' IS DISTINCT FROM 'custom_offer'
       OR selected_order.metadata ->> 'custom_offer_id' IS DISTINCT FROM offer_record.id::text
       OR selected_order.plan <> offer_record.plan
       OR selected_order.amount_twd <> offer_record.amount_twd
     ) THEN
    RAISE EXCEPTION 'payment order does not match the server-side custom offer';
  END IF;

  IF organization_record.status = 'suspended'
     AND COALESCE(organization_record.suspension_source, 'platform_admin')
       NOT IN ('trial_expired', 'billing') THEN
    RAISE EXCEPTION 'platform-suspended organizations require operator review';
  END IF;

  IF organization_record.plan IN ('growth', 'pro', 'enterprise')
     OR subscription_record.plan IN ('growth', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'custom offer checkout cannot downgrade the current plan';
  END IF;

  -- Only a live pending order issued with the current provider identity can be
  -- re-signed. Every other existing order permanently closes this offer. A
  -- verified late callback may still move that issued order to paid.
  IF selected_order.id IS NOT NULL
     AND NOT (
       selected_order.status = 'pending'
       AND selected_order.expires_at > checkout_now
       AND selected_order.provider = normalized_provider
       AND selected_order.provider_mode = normalized_provider_mode
       AND selected_order.merchant_id = normalized_merchant_id
       AND offer_record.status = 'active'
       AND offer_record.expires_at > checkout_now
     ) THEN
    IF offer_record.status = 'active' THEN
      UPDATE public.custom_plan_offers
      SET status = 'expired'
      WHERE id = offer_record.id;

      INSERT INTO public.audit_logs (
        org_id,
        actor_user_id,
        action,
        target_type,
        target_id,
        metadata
      )
      VALUES (
        offer_record.org_id,
        NULL,
        'custom_plan.offer_checkout_closed',
        'custom_plan_offer',
        offer_record.id::text,
        jsonb_build_object(
          'payment_order_id', selected_order.id,
          'payment_order_status', selected_order.status,
          'offer_expires_at', offer_record.expires_at
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'offer_unavailable',
      'error_code', 'offer_checkout_closed',
      'payment_order_id', selected_order.id
    );
  END IF;

  IF offer_record.status = 'active' AND offer_record.expires_at <= checkout_now THEN
    UPDATE public.custom_plan_offers
    SET status = 'expired'
    WHERE id = offer_record.id;

    INSERT INTO public.audit_logs (
      org_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      offer_record.org_id,
      NULL,
      'custom_plan.offer_expired',
      'custom_plan_offer',
      offer_record.id::text,
      jsonb_build_object('expires_at', offer_record.expires_at)
    );

    RETURN jsonb_build_object(
      'status', 'offer_unavailable',
      'error_code', 'offer_expired'
    );
  END IF;

  IF offer_record.status <> 'active' THEN
    RETURN jsonb_build_object(
      'status', 'offer_unavailable',
      'error_code', 'offer_not_active',
      'offer_status', offer_record.status
    );
  END IF;

  IF selected_order.id IS NOT NULL THEN
    UPDATE public.custom_plan_offers
    SET payment_order_id = selected_order.id
    WHERE id = offer_record.id;

    RETURN to_jsonb(selected_order) || jsonb_build_object(
      'disposition', CASE
        WHEN existing_order.id IS NOT NULL THEN 'idempotent_replay'
        ELSE 'reused_pending'
      END
    );
  END IF;

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
      WHEN actor_retry_after_seconds > 0 AND org_retry_after_seconds > 0
        THEN 'actor_and_org'
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
    offer_record.plan,
    offer_record.amount_twd,
    p_actor_user_id,
    jsonb_build_object(
      'source', 'custom_plan_offer',
      'pricing_kind', 'custom_offer',
      'custom_offer_id', offer_record.id,
      'custom_offer_title', offer_record.title,
      'billing_period_months', offer_record.billing_period_months,
      'merchant_id', normalized_merchant_id,
      'provider_mode', normalized_provider_mode
    )
  )
  RETURNING * INTO created_order;

  UPDATE public.custom_plan_offers
  SET payment_order_id = created_order.id
  WHERE id = offer_record.id;

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
    'custom_plan.checkout_created',
    'custom_plan_offer',
    offer_record.id::text,
    jsonb_build_object(
      'payment_order_id', created_order.id,
      'merchant_trade_no', created_order.merchant_trade_no,
      'amount_twd', created_order.amount_twd,
      'provider_mode', created_order.provider_mode
    )
  );

  RETURN to_jsonb(created_order) || jsonb_build_object(
    'disposition', 'created'
  );
END;
$$;

-- The existing ECPay settlement RPC changes payment_orders to paid in the same
-- transaction that creates a subscription period. This trigger validates the
-- referenced private offer and marks it paid in that transaction too.
CREATE OR REPLACE FUNCTION public.settle_custom_plan_offer_from_payment_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offer_id_text TEXT;
  offer_record public.custom_plan_offers%ROWTYPE;
  effective_paid_at TIMESTAMPTZ;
BEGIN
  IF OLD.status IS DISTINCT FROM 'paid'
     AND NEW.status = 'paid'
     AND OLD.metadata ->> 'pricing_kind' = 'custom_offer' THEN
    offer_id_text := OLD.metadata ->> 'custom_offer_id';

    IF offer_id_text IS NULL
       OR offer_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'custom offer payment order has invalid metadata';
    END IF;

    SELECT *
    INTO offer_record
    FROM public.custom_plan_offers
    WHERE id = offer_id_text::UUID
    FOR UPDATE;

    IF NOT FOUND
       OR offer_record.org_id <> NEW.org_id
       OR offer_record.plan <> NEW.plan
       OR offer_record.amount_twd <> NEW.amount_twd
       OR offer_record.billing_period_months <> 1 THEN
      RAISE EXCEPTION 'custom offer payment order does not match its offer';
    END IF;

    effective_paid_at := COALESCE(NEW.paid_at, NOW());

    IF offer_record.status NOT IN ('active', 'expired')
       OR OLD.created_at > offer_record.expires_at THEN
      RAISE EXCEPTION 'custom plan offer payment order was not issued before offer expiry';
    END IF;

    UPDATE public.custom_plan_offers
    SET
      status = 'paid',
      payment_order_id = NEW.id
    WHERE id = offer_record.id;

    INSERT INTO public.audit_logs (
      org_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      offer_record.org_id,
      NULL,
      'custom_plan.offer_paid',
      'custom_plan_offer',
      offer_record.id::text,
      jsonb_build_object(
        'payment_order_id', NEW.id,
        'amount_twd', NEW.amount_twd,
        'paid_at', effective_paid_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settle_custom_plan_offer_from_payment_order
ON public.payment_orders;

CREATE TRIGGER trg_settle_custom_plan_offer_from_payment_order
BEFORE UPDATE OF status ON public.payment_orders
FOR EACH ROW
EXECUTE FUNCTION public.settle_custom_plan_offer_from_payment_order();

REVOKE ALL ON FUNCTION public.set_custom_plan_offer_updated_at()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_custom_plan_offer_from_payment_order()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_custom_plan_offer_actor_metadata(
  UUID, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_custom_plan_offer_actor_metadata(
  UUID, JSONB
) TO service_role;

REVOKE ALL ON FUNCTION public.create_custom_plan_offer(
  UUID, UUID, JSONB, TEXT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_plan_offer(
  UUID, UUID, JSONB, TEXT, TEXT, INTEGER, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_custom_plan_offer(
  UUID, UUID, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_custom_plan_offer(
  UUID, UUID, JSONB, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.create_custom_plan_payment_order(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_plan_payment_order(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;

COMMENT ON TABLE public.custom_plan_offers
IS 'Private, operator-created one-month Basic offers visible only to owner/admin members of the target organization.';
COMMENT ON COLUMN public.custom_plan_offers.amount_twd
IS 'Server-authoritative TWD amount sent to ECPay; merchants never provide this value during checkout.';
COMMENT ON COLUMN public.custom_plan_offers.payment_order_id
IS 'The offer''s only checkout order; paid state remains authoritative in payment_orders and subscription_periods.';
COMMENT ON FUNCTION public.create_custom_plan_offer(UUID, UUID, JSONB, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
IS 'Service-role-only creation of a private, fixed one-month Basic offer with an auditable operator actor.';
COMMENT ON FUNCTION public.cancel_custom_plan_offer(UUID, UUID, JSONB, TEXT)
IS 'Service-role-only cancellation. An offer cannot be cancelled after any payment order has been issued.';
COMMENT ON FUNCTION public.create_custom_plan_payment_order(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
IS 'Creates or reuses the only custom-offer ECPay order using the server-side offer amount; any non-reusable order permanently closes that offer.';
COMMENT ON FUNCTION public.settle_custom_plan_offer_from_payment_order()
IS 'Atomically validates and marks a private offer paid when the verified ECPay settlement changes its payment order to paid.';
