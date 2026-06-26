-- DRAFT: SaaS team invite status column alignment.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.organization_invites
  ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.organization_invites
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE public.organization_invites
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.organization_invites
  DROP CONSTRAINT IF EXISTS organization_invites_status_check;

ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));

UPDATE public.organization_invites
SET status = 'accepted'
WHERE accepted_at IS NOT NULL
  AND status <> 'accepted';

UPDATE public.organization_invites
SET status = 'expired'
WHERE accepted_at IS NULL
  AND expires_at <= NOW()
  AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_organization_invites_org_status_created
  ON public.organization_invites (org_id, status, created_at DESC);

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

  IF invite_record.status = 'revoked' THEN
    RAISE EXCEPTION 'Invite has been revoked.';
  END IF;

  IF invite_record.status = 'accepted' OR invite_record.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been accepted.';
  END IF;

  IF invite_record.status = 'expired' OR invite_record.expires_at <= p_accepted_at THEN
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
  SET
    accepted_at = p_accepted_at,
    status = 'accepted'
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

  IF invite_record.id IS NOT NULL
    AND (invite_record.status = 'accepted' OR invite_record.accepted_at IS NOT NULL)
  THEN
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
    status,
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
    'pending',
    p_invited_by,
    p_expires_at,
    NULL,
    p_created_at
  )
  ON CONFLICT (org_id, email)
  DO UPDATE SET
    role = EXCLUDED.role,
    token = EXCLUDED.token,
    status = 'pending',
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
