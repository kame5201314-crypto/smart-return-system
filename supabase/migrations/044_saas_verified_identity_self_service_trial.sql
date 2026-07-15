-- DRAFT: verified email/phone self-service trial provisioning.
-- Not applied to any database as of 2026-07-15.
-- Apply only to SaaS project auyznbwtjvemyamujmgt after explicit owner authorization,
-- backup, provider configuration, and review. Never apply to master/live/internal Supabase.

ALTER TABLE public.saas_self_service_trial_claims
  ADD COLUMN IF NOT EXISTS identity_provider TEXT NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

ALTER TABLE public.saas_self_service_trial_claims
  ALTER COLUMN normalized_email DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saas_self_service_trial_claims_identity_provider_check'
      AND conrelid = 'public.saas_self_service_trial_claims'::regclass
  ) THEN
    ALTER TABLE public.saas_self_service_trial_claims
      ADD CONSTRAINT saas_self_service_trial_claims_identity_provider_check
      CHECK (identity_provider IN ('google', 'email_otp', 'phone_otp'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saas_self_service_trial_claims_verified_contact_check'
      AND conrelid = 'public.saas_self_service_trial_claims'::regclass
  ) THEN
    ALTER TABLE public.saas_self_service_trial_claims
      ADD CONSTRAINT saas_self_service_trial_claims_verified_contact_check
      CHECK (
        (identity_provider IN ('google', 'email_otp') AND normalized_email IS NOT NULL)
        OR (identity_provider = 'phone_otp' AND normalized_phone IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saas_self_service_trial_claims_normalized_contact_check'
      AND conrelid = 'public.saas_self_service_trial_claims'::regclass
  ) THEN
    ALTER TABLE public.saas_self_service_trial_claims
      ADD CONSTRAINT saas_self_service_trial_claims_normalized_contact_check
      CHECK (
        (
          normalized_email IS NULL
          OR (
            normalized_email = lower(BTRIM(normalized_email))
            AND normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          )
        )
        AND (
          normalized_phone IS NULL
          OR normalized_phone ~ '^\+8869[0-9]{8}$'
        )
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_saas_self_service_trial_claims_normalized_phone
ON public.saas_self_service_trial_claims(normalized_phone)
WHERE normalized_phone IS NOT NULL;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_phone TEXT;

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS phone TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_owner_phone_e164_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_owner_phone_e164_check
      CHECK (owner_phone IS NULL OR owner_phone ~ '^\+8869[0-9]{8}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_members_phone_e164_check'
      AND conrelid = 'public.organization_members'::regclass
  ) THEN
    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_phone_e164_check
      CHECK (phone IS NULL OR phone ~ '^\+8869[0-9]{8}$');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_verified_identity_self_service_trial(
  p_owner_user_id UUID,
  p_identity_provider TEXT,
  p_owner_email TEXT,
  p_owner_phone TEXT,
  p_org_name TEXT,
  p_plan TEXT,
  p_terms_version TEXT,
  p_terms_accepted_at TIMESTAMPTZ,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  identity_provider_normalized TEXT := lower(BTRIM(COALESCE(p_identity_provider, '')));
  supplied_email_normalized TEXT := NULLIF(lower(BTRIM(COALESCE(p_owner_email, ''))), '');
  supplied_phone_normalized TEXT := NULLIF(regexp_replace(COALESCE(p_owner_phone, ''), '[^+0-9]', '', 'g'), '');
  normalized_org_name TEXT := BTRIM(COALESCE(p_org_name, ''));
  verified_email TEXT;
  verified_phone TEXT;
  auth_email_confirmed BOOLEAN := false;
  auth_phone_confirmed BOOLEAN := false;
  required_provider TEXT;
  existing_claim public.saas_self_service_trial_claims%ROWTYPE;
  existing_membership_org_id UUID;
  created_org_id UUID;
  created_subscription_id UUID;
  created_owner_membership_id UUID;
  created_audit_log_id UUID;
  created_claim_id UUID;
  created_slug TEXT;
  effective_at TIMESTAMPTZ := NOW();
  trial_end_at TIMESTAMPTZ := NOW() + INTERVAL '3 days';
BEGIN
  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner_user_id is required';
  END IF;

  IF identity_provider_normalized NOT IN ('google', 'email_otp', 'phone_otp') THEN
    RAISE EXCEPTION 'identity_provider must be google, email_otp, or phone_otp';
  END IF;

  IF normalized_org_name = '' OR char_length(normalized_org_name) > 120 THEN
    RAISE EXCEPTION 'org_name must contain 1 to 120 characters';
  END IF;

  IF p_plan NOT IN ('basic', 'growth') THEN
    RAISE EXCEPTION 'plan must be basic or growth';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_terms_version, '')), '') IS NULL THEN
    RAISE EXCEPTION 'terms_version is required';
  END IF;

  IF p_terms_accepted_at IS NULL THEN
    RAISE EXCEPTION 'terms_accepted_at is required';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT
    NULLIF(lower(BTRIM(email)), ''),
    NULLIF(BTRIM(phone), ''),
    email_confirmed_at IS NOT NULL,
    phone_confirmed_at IS NOT NULL
  INTO verified_email, verified_phone, auth_email_confirmed, auth_phone_confirmed
  FROM auth.users
  WHERE id = p_owner_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verified auth user not found';
  END IF;

  IF NOT auth_email_confirmed THEN
    verified_email := NULL;
  END IF;

  IF NOT auth_phone_confirmed THEN
    verified_phone := NULL;
  END IF;

  required_provider := CASE identity_provider_normalized
    WHEN 'google' THEN 'google'
    WHEN 'email_otp' THEN 'email'
    ELSE 'phone'
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.identities
    WHERE user_id = p_owner_user_id
      AND provider = required_provider
  ) THEN
    RAISE EXCEPTION 'verified auth identity provider does not match';
  END IF;

  IF identity_provider_normalized IN ('google', 'email_otp') THEN
    IF NOT auth_email_confirmed OR verified_email IS NULL THEN
      RAISE EXCEPTION 'verified auth email is required';
    END IF;
    IF supplied_email_normalized IS NOT NULL AND supplied_email_normalized <> verified_email THEN
      RAISE EXCEPTION 'verified auth user email does not match owner_email';
    END IF;
  END IF;

  IF identity_provider_normalized = 'phone_otp' THEN
    IF NOT auth_phone_confirmed OR verified_phone IS NULL OR verified_phone !~ '^\+8869[0-9]{8}$' THEN
      RAISE EXCEPTION 'verified Taiwan mobile identity is required';
    END IF;
    IF supplied_phone_normalized IS NOT NULL AND supplied_phone_normalized <> verified_phone THEN
      RAISE EXCEPTION 'verified auth user phone does not match owner_phone';
    END IF;
  END IF;

  -- Only the product's phone signup channel persists a phone contact. Google
  -- and Email identities may have an unrelated international secondary phone.
  IF identity_provider_normalized <> 'phone_otp' THEN
    verified_phone := NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('trial-idempotency:' || BTRIM(p_idempotency_key), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('trial-user:' || p_owner_user_id::text, 0));
  IF verified_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('trial-email:' || verified_email, 0));
  END IF;
  IF verified_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('trial-phone:' || verified_phone, 0));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.saas_self_service_trial_claims AS collision
    WHERE collision.user_id <> p_owner_user_id
      AND (
        (verified_email IS NOT NULL AND collision.normalized_email = verified_email)
        OR (verified_phone IS NOT NULL AND collision.normalized_phone = verified_phone)
        OR collision.idempotency_key = BTRIM(p_idempotency_key)
      )
  ) THEN
    RAISE EXCEPTION 'trial already claimed by another identity';
  END IF;

  SELECT *
  INTO existing_claim
  FROM public.saas_self_service_trial_claims AS claim
  WHERE claim.user_id = p_owner_user_id
     OR (verified_email IS NOT NULL AND claim.normalized_email = verified_email)
     OR (verified_phone IS NOT NULL AND claim.normalized_phone = verified_phone)
     OR claim.idempotency_key = BTRIM(p_idempotency_key)
  ORDER BY claim.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF existing_claim.user_id <> p_owner_user_id THEN
      RAISE EXCEPTION 'trial already claimed by another identity';
    END IF;

    RETURN jsonb_build_object(
      'claim_id', existing_claim.id,
      'org_id', existing_claim.org_id,
      'subscription_id', (
        SELECT id FROM public.subscriptions WHERE org_id = existing_claim.org_id LIMIT 1
      ),
      'owner_membership_id', (
        SELECT id
        FROM public.organization_members
        WHERE org_id = existing_claim.org_id AND user_id = p_owner_user_id
        LIMIT 1
      ),
      'audit_log_id', NULL,
      'trial_end', (
        SELECT trial_end FROM public.subscriptions WHERE org_id = existing_claim.org_id LIMIT 1
      ),
      'reused', true
    );
  END IF;

  SELECT org_id
  INTO existing_membership_org_id
  FROM public.organization_members
  WHERE user_id = p_owner_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF existing_membership_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'user already has organization membership';
  END IF;

  created_slug := regexp_replace(lower(normalized_org_name), '[^a-z0-9]+', '-', 'g');
  created_slug := trim(BOTH '-' FROM created_slug);
  IF created_slug = '' THEN
    created_slug := 'workspace';
  END IF;
  created_slug := left(created_slug, 48) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  INSERT INTO public.organizations (
    name,
    slug,
    plan,
    status,
    owner_email,
    owner_phone,
    billing_email,
    feature_flags,
    member_count
  )
  VALUES (
    normalized_org_name,
    created_slug,
    p_plan,
    'trialing',
    verified_email,
    verified_phone,
    verified_email,
    '{}'::jsonb,
    1
  )
  RETURNING id INTO created_org_id;

  INSERT INTO public.organization_members (
    org_id,
    user_id,
    email,
    phone,
    role,
    status
  )
  VALUES (
    created_org_id,
    p_owner_user_id,
    verified_email,
    verified_phone,
    'owner',
    'active'
  )
  RETURNING id INTO created_owner_membership_id;

  INSERT INTO public.subscriptions (
    org_id,
    plan,
    status,
    provider,
    current_period_start,
    current_period_end,
    trial_end,
    cancel_at_period_end
  )
  VALUES (
    created_org_id,
    p_plan,
    'trialing',
    'manual',
    effective_at,
    trial_end_at,
    trial_end_at,
    false
  )
  RETURNING id INTO created_subscription_id;

  INSERT INTO public.saas_self_service_trial_claims (
    user_id,
    normalized_email,
    normalized_phone,
    identity_provider,
    org_id,
    plan,
    terms_version,
    terms_accepted_at,
    idempotency_key
  )
  VALUES (
    p_owner_user_id,
    verified_email,
    verified_phone,
    identity_provider_normalized,
    created_org_id,
    p_plan,
    BTRIM(p_terms_version),
    p_terms_accepted_at,
    BTRIM(p_idempotency_key)
  )
  RETURNING id INTO created_claim_id;

  INSERT INTO public.audit_logs (
    org_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    created_org_id,
    p_owner_user_id,
    CASE identity_provider_normalized
      WHEN 'google' THEN 'org.google_self_service_trial_created'
      WHEN 'email_otp' THEN 'org.email_otp_self_service_trial_created'
      ELSE 'org.phone_otp_self_service_trial_created'
    END,
    'organization',
    created_org_id::text,
    jsonb_build_object(
      'plan', p_plan,
      'identity_provider', identity_provider_normalized,
      'terms_version', BTRIM(p_terms_version),
      'terms_accepted_at', p_terms_accepted_at,
      'trial_end', trial_end_at,
      'claim_id', created_claim_id
    ) || CASE
      WHEN identity_provider_normalized = 'google'
        THEN jsonb_build_object('owner_email', verified_email)
      ELSE '{}'::jsonb
    END
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'claim_id', created_claim_id,
    'org_id', created_org_id,
    'subscription_id', created_subscription_id,
    'owner_membership_id', created_owner_membership_id,
    'audit_log_id', created_audit_log_id,
    'trial_end', trial_end_at,
    'reused', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_verified_identity_self_service_trial(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_verified_identity_self_service_trial(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) TO service_role;

-- Keep the applied migration 040 RPC signature available during a migration-first rollout.
CREATE OR REPLACE FUNCTION public.create_google_self_service_trial(
  p_owner_user_id UUID,
  p_owner_email TEXT,
  p_org_name TEXT,
  p_plan TEXT,
  p_terms_version TEXT,
  p_terms_accepted_at TIMESTAMPTZ,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_verified_identity_self_service_trial(
    p_owner_user_id,
    'google',
    p_owner_email,
    NULL,
    p_org_name,
    p_plan,
    p_terms_version,
    p_terms_accepted_at,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_google_self_service_trial(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_google_self_service_trial(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) TO service_role;

COMMENT ON FUNCTION public.create_verified_identity_self_service_trial(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) IS
  'Atomically creates one verified Google, email OTP, or phone OTP SaaS trial. Service-role only.';

COMMENT ON FUNCTION public.create_google_self_service_trial(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) IS
  'Backward-compatible Google trial wrapper over verified identity provisioning.';
