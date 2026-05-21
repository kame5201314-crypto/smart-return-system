-- DRAFT: SaaS invite acceptance RPC.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE OR REPLACE FUNCTION public.accept_organization_invite(
  p_invite_id UUID,
  p_org_id UUID,
  p_user_id UUID,
  p_user_email TEXT,
  p_role TEXT,
  p_accepted_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record public.organization_invites%ROWTYPE;
  accepted_membership_id UUID;
  created_audit_log_id UUID;
BEGIN
  IF p_role NOT IN ('admin', 'staff', 'viewer') THEN
    RAISE EXCEPTION 'Invalid invite role: %', p_role;
  END IF;

  SELECT *
  INTO invite_record
  FROM public.organization_invites
  WHERE id = p_invite_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF invite_record.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found.';
  END IF;

  IF lower(invite_record.email) <> lower(p_user_email) THEN
    RAISE EXCEPTION 'Invite email does not match the signed-in user.';
  END IF;

  IF invite_record.role <> p_role THEN
    RAISE EXCEPTION 'Invite role does not match the requested membership role.';
  END IF;

  IF invite_record.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been accepted.';
  END IF;

  IF invite_record.expires_at <= p_accepted_at THEN
    RAISE EXCEPTION 'Invite has expired.';
  END IF;

  INSERT INTO public.organization_members (
    org_id,
    user_id,
    email,
    role,
    status
  )
  VALUES (
    p_org_id,
    p_user_id,
    lower(p_user_email),
    p_role,
    'active'
  )
  ON CONFLICT (org_id, user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE
      WHEN public.organization_members.role = 'owner' THEN public.organization_members.role
      ELSE EXCLUDED.role
    END,
    status = 'active'
  RETURNING id INTO accepted_membership_id;

  UPDATE public.organization_invites
  SET accepted_at = p_accepted_at
  WHERE id = p_invite_id;

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
    p_user_id,
    'member.invite_accepted',
    'organization_invite',
    p_invite_id::text,
    jsonb_build_object(
      'email', lower(p_user_email),
      'role', p_role,
      'membership_id', accepted_membership_id,
      'accepted_at', p_accepted_at
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'membership_id', accepted_membership_id,
    'audit_log_id', created_audit_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_organization_invite(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_organization_invite(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ
) TO service_role;
