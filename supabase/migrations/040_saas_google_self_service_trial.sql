-- DRAFT: Google-authenticated SaaS self-service trial provisioning.
-- Not applied to any database.
-- Apply only to SaaS project auyznbwtjvemyamujmgt after explicit owner authorization.
-- Do not apply to the master/live/internal Supabase project.

CREATE TABLE IF NOT EXISTS public.saas_self_service_trial_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  normalized_email TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'growth')),
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id),
  UNIQUE (normalized_email),
  UNIQUE (org_id),
  UNIQUE (idempotency_key)
);

ALTER TABLE public.saas_self_service_trial_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_saas_self_service_trial_claims"
  ON public.saas_self_service_trial_claims;
CREATE POLICY "service_role_full_saas_self_service_trial_claims"
  ON public.saas_self_service_trial_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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
DECLARE
  owner_email_normalized TEXT := lower(BTRIM(COALESCE(p_owner_email, '')));
  normalized_org_name TEXT := BTRIM(COALESCE(p_org_name, ''));
  verified_email TEXT;
  existing_claim public.saas_self_service_trial_claims%ROWTYPE;
  existing_membership_org_id UUID;
  created_org_id UUID;
  created_subscription_id UUID;
  created_owner_membership_id UUID;
  created_audit_log_id UUID;
  created_claim_id UUID;
  created_slug TEXT;
  effective_at TIMESTAMPTZ := NOW();
  trial_end_at TIMESTAMPTZ := NOW() + INTERVAL '14 days';
BEGIN
  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner_user_id is required';
  END IF;

  IF owner_email_normalized = '' THEN
    RAISE EXCEPTION 'owner_email is required';
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

  SELECT lower(email)
  INTO verified_email
  FROM auth.users
  WHERE id = p_owner_user_id
    AND email_confirmed_at IS NOT NULL;

  IF verified_email IS NULL OR verified_email <> owner_email_normalized THEN
    RAISE EXCEPTION 'verified auth user email does not match owner_email';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(owner_email_normalized, 0));

  SELECT *
  INTO existing_claim
  FROM public.saas_self_service_trial_claims AS claim
  WHERE claim.user_id = p_owner_user_id
     OR claim.normalized_email = owner_email_normalized
     OR claim.idempotency_key = p_idempotency_key
  ORDER BY claim.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF existing_claim.user_id <> p_owner_user_id
       OR existing_claim.normalized_email <> owner_email_normalized THEN
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
    billing_email,
    feature_flags,
    member_count
  )
  VALUES (
    normalized_org_name,
    created_slug,
    p_plan,
    'trialing',
    owner_email_normalized,
    owner_email_normalized,
    '{}'::jsonb,
    1
  )
  RETURNING id INTO created_org_id;

  INSERT INTO public.organization_members (
    org_id,
    user_id,
    email,
    role,
    status
  )
  VALUES (
    created_org_id,
    p_owner_user_id,
    owner_email_normalized,
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
    org_id,
    plan,
    terms_version,
    terms_accepted_at,
    idempotency_key
  )
  VALUES (
    p_owner_user_id,
    owner_email_normalized,
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
    'org.google_self_service_trial_created',
    'organization',
    created_org_id::text,
    jsonb_build_object(
      'plan', p_plan,
      'owner_email', owner_email_normalized,
      'terms_version', BTRIM(p_terms_version),
      'terms_accepted_at', p_terms_accepted_at,
      'trial_end', trial_end_at,
      'claim_id', created_claim_id
    )
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

REVOKE ALL ON FUNCTION public.create_google_self_service_trial(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_google_self_service_trial(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT
) TO service_role;

COMMENT ON TABLE public.saas_self_service_trial_claims IS
  'One-time self-service trial claims. Service-role only; no public direct access.';
COMMENT ON FUNCTION public.create_google_self_service_trial(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) IS
  'Atomically creates one Google-authenticated SaaS trial workspace and records terms acceptance.';
