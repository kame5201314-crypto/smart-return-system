-- DRAFT: Restrict automated trial expiry to Google self-service trial claims.
-- Not applied to any database.
-- Apply only to SaaS project auyznbwtjvemyamujmgt after explicit owner authorization.
-- Do not apply to the master/live/internal Supabase project.

CREATE OR REPLACE FUNCTION public.suspend_expired_trial_organization(
  p_org_id UUID,
  p_effective_at TIMESTAMPTZ DEFAULT NULL
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
  created_audit_log_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.saas_self_service_trial_claims AS claim
    WHERE claim.org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'reason', 'not_self_service_trial'
    );
  END IF;

  SELECT *
  INTO subscription_record
  FROM public.subscriptions
  WHERE org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'reason', 'subscription_not_found'
    );
  END IF;

  IF subscription_record.status <> 'trialing'
     OR subscription_record.trial_end IS NULL
     OR subscription_record.trial_end > effective_at THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'reason', 'not_expired_trial'
    );
  END IF;

  SELECT *
  INTO org_record
  FROM public.organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'changed', false,
      'org_id', p_org_id,
      'subscription_id', subscription_record.id,
      'reason', 'organization_not_found'
    );
  END IF;

  UPDATE public.organizations
  SET
    status = 'suspended',
    suspended_at = effective_at,
    updated_at = NOW()
  WHERE id = p_org_id;

  UPDATE public.subscriptions
  SET
    status = 'suspended',
    updated_at = NOW()
  WHERE id = subscription_record.id;

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
    NULL,
    'lifecycle.trial_expired_suspended',
    'subscription',
    subscription_record.id::text,
    jsonb_build_object(
      'previous_org_status', org_record.status,
      'previous_subscription_status', subscription_record.status,
      'next_status', 'suspended',
      'trial_end', subscription_record.trial_end,
      'effective_at', effective_at,
      'source', 'cron.saas.trial_expiry'
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'changed', true,
    'org_id', p_org_id,
    'subscription_id', subscription_record.id,
    'audit_log_id', created_audit_log_id,
    'next_status', 'suspended',
    'reason', 'trial_expired'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_expired_trial_organization(UUID, TIMESTAMPTZ)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suspend_expired_trial_organization(UUID, TIMESTAMPTZ)
  TO service_role;

COMMENT ON FUNCTION public.suspend_expired_trial_organization(UUID, TIMESTAMPTZ) IS
  'Atomically suspends an expired trial only when the organization has a Google self-service trial claim.';
