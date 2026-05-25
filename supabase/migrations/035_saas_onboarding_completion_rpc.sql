-- DRAFT: SaaS onboarding completion RPC.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE OR REPLACE FUNCTION public.complete_organization_onboarding(
  p_org_id UUID,
  p_actor_user_id UUID,
  p_completed_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_at TIMESTAMPTZ := COALESCE(p_completed_at, NOW());
  org_record public.organizations%ROWTYPE;
  next_completed_at TIMESTAMPTZ;
  created_audit_log_id UUID;
BEGIN
  SELECT *
  INTO org_record
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found: %', p_org_id;
  END IF;

  next_completed_at := COALESCE(org_record.onboarding_completed_at, effective_at);

  UPDATE public.organizations
  SET
    onboarding_completed_at = next_completed_at,
    updated_at = NOW()
  WHERE id = p_org_id;

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
    'org.onboarding_completed',
    'organization',
    p_org_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'previous_onboarding_completed_at', org_record.onboarding_completed_at,
      'onboarding_completed_at', next_completed_at,
      'requested_completed_at', effective_at,
      'metadata', COALESCE(p_metadata, '{}'::jsonb)
    ))
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'onboarding_completed_at', next_completed_at,
    'audit_log_id', created_audit_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_organization_onboarding(
  UUID,
  UUID,
  TIMESTAMPTZ,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_organization_onboarding(
  UUID,
  UUID,
  TIMESTAMPTZ,
  JSONB
) TO service_role;
