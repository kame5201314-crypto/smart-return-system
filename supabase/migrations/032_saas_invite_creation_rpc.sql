-- DRAFT: SaaS invite creation RPC.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE OR REPLACE FUNCTION public.create_organization_invite(
  p_org_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_token TEXT,
  p_invited_by UUID,
  p_expires_at TIMESTAMPTZ,
  p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email TEXT := lower(trim(p_email));
  normalized_role TEXT := trim(p_role);
  normalized_token TEXT := trim(p_token);
  invite_record public.organization_invites%ROWTYPE;
  existing_member_id UUID;
  created_invite_id UUID;
  created_audit_log_id UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required.';
  END IF;

  IF p_invited_by IS NULL THEN
    RAISE EXCEPTION 'Inviting user id is required.';
  END IF;

  IF normalized_email IS NULL
    OR normalized_email = ''
    OR normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Invite email must be valid.';
  END IF;

  IF normalized_role NOT IN ('admin', 'staff', 'viewer') THEN
    RAISE EXCEPTION 'Invalid invite role: %', p_role;
  END IF;

  IF normalized_token IS NULL OR normalized_token = '' THEN
    RAISE EXCEPTION 'Invite token is required.';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= p_created_at THEN
    RAISE EXCEPTION 'Invite expiration must be in the future.';
  END IF;

  SELECT *
  INTO invite_record
  FROM public.organization_invites
  WHERE org_id = p_org_id
    AND lower(email) = normalized_email
  FOR UPDATE;

  IF invite_record.id IS NOT NULL AND invite_record.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been accepted.';
  END IF;

  SELECT id
  INTO existing_member_id
  FROM public.organization_members
  WHERE org_id = p_org_id
    AND lower(email) = normalized_email
    AND COALESCE(status, 'active') <> 'disabled'
  LIMIT 1;

  IF existing_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'A member with this email already exists.';
  END IF;

  INSERT INTO public.organization_invites (
    org_id,
    email,
    role,
    token,
    invited_by,
    expires_at,
    accepted_at,
    created_at
  )
  VALUES (
    p_org_id,
    normalized_email,
    normalized_role,
    normalized_token,
    p_invited_by,
    p_expires_at,
    NULL,
    p_created_at
  )
  ON CONFLICT (org_id, email)
  DO UPDATE SET
    role = EXCLUDED.role,
    token = EXCLUDED.token,
    invited_by = EXCLUDED.invited_by,
    expires_at = EXCLUDED.expires_at,
    accepted_at = NULL,
    created_at = EXCLUDED.created_at
  RETURNING id INTO created_invite_id;

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
    p_invited_by,
    'member.invited',
    'organization_invite',
    created_invite_id::text,
    jsonb_build_object(
      'email', normalized_email,
      'role', normalized_role,
      'expires_at', p_expires_at,
      'created_at', p_created_at
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'invite_id', created_invite_id,
    'token', normalized_token,
    'audit_log_id', created_audit_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_invite(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_organization_invite(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ
) TO service_role;
