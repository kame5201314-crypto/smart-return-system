-- DRAFT: SaaS manual Beta organization provisioning RPC.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE OR REPLACE FUNCTION public.create_manual_beta_organization(
  p_org_name TEXT,
  p_slug TEXT,
  p_plan TEXT DEFAULT 'basic',
  p_owner_email TEXT DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL,
  p_billing_email TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_trial_end TIMESTAMPTZ DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_org_id UUID;
  created_subscription_id UUID;
  created_owner_membership_id UUID;
  created_audit_log_id UUID;
BEGIN
  IF p_plan NOT IN ('basic', 'growth', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  INSERT INTO public.organizations (
    name,
    slug,
    plan,
    status,
    owner_email,
    billing_email,
    tax_id,
    feature_flags,
    member_count
  )
  VALUES (
    p_org_name,
    p_slug,
    p_plan,
    'trialing',
    lower(p_owner_email),
    lower(p_billing_email),
    p_tax_id,
    '{}'::jsonb,
    CASE WHEN p_owner_user_id IS NULL THEN 0 ELSE 1 END
  )
  RETURNING id INTO created_org_id;

  IF p_owner_user_id IS NOT NULL THEN
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
      lower(p_owner_email),
      'owner',
      'active'
    )
    RETURNING id INTO created_owner_membership_id;
  END IF;

  INSERT INTO public.subscriptions (
    org_id,
    plan,
    status,
    provider,
    current_period_start,
    current_period_end,
    trial_end
  )
  VALUES (
    created_org_id,
    p_plan,
    'trialing',
    'manual',
    NOW(),
    p_trial_end,
    p_trial_end
  )
  RETURNING id INTO created_subscription_id;

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
    p_actor_user_id,
    'platform.manual_beta_org_created',
    'organization',
    created_org_id::text,
    jsonb_build_object(
      'plan', p_plan,
      'owner_email', lower(p_owner_email),
      'owner_user_id', p_owner_user_id,
      'trial_end', p_trial_end
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'org_id', created_org_id,
    'subscription_id', created_subscription_id,
    'owner_membership_id', created_owner_membership_id,
    'audit_log_id', created_audit_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_beta_organization(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_manual_beta_organization(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  UUID
) TO service_role;
