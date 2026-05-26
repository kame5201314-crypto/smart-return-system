-- DRAFT: SaaS platform admin role assignments.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE TABLE IF NOT EXISTS public.platform_admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type TEXT NOT NULL CHECK (principal_type IN ('email', 'user_id')),
  principal TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'support', 'billing')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  note TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (principal_type, principal)
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_roles_status_role
ON public.platform_admin_roles(status, role);

ALTER TABLE public.platform_admin_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_platform_admin_roles"
ON public.platform_admin_roles;

CREATE POLICY "service_role_full_platform_admin_roles"
  ON public.platform_admin_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.manage_platform_admin_role(
  p_operation TEXT,
  p_principal_type TEXT,
  p_principal TEXT,
  p_role TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_operation TEXT := LOWER(BTRIM(COALESCE(p_operation, '')));
  normalized_principal_type TEXT := LOWER(BTRIM(COALESCE(p_principal_type, '')));
  normalized_principal TEXT := LOWER(BTRIM(COALESCE(p_principal, '')));
  normalized_role TEXT := LOWER(BTRIM(COALESCE(p_role, '')));
  next_status TEXT;
  existing_actor_user_id UUID;
  role_row public.platform_admin_roles%ROWTYPE;
  created_audit_log_id UUID;
BEGIN
  IF normalized_operation NOT IN ('upsert', 'disable') THEN
    RAISE EXCEPTION 'Invalid platform admin role operation: %', p_operation;
  END IF;

  IF normalized_principal_type NOT IN ('email', 'user_id') THEN
    RAISE EXCEPTION 'Invalid platform admin role principal type: %', p_principal_type;
  END IF;

  IF normalized_principal = '' THEN
    RAISE EXCEPTION 'principal is required';
  END IF;

  IF normalized_principal_type = 'email'
     AND normalized_principal !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'principal must be a valid email address';
  END IF;

  IF normalized_principal_type = 'user_id'
     AND normalized_principal !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'principal must be a valid user id';
  END IF;

  IF normalized_operation = 'upsert' AND normalized_role NOT IN ('owner', 'support', 'billing') THEN
    RAISE EXCEPTION 'role must be owner, support, or billing';
  END IF;

  IF normalized_operation = 'disable' THEN
    next_status := 'disabled';

    SELECT *
    INTO role_row
    FROM public.platform_admin_roles
    WHERE principal_type = normalized_principal_type
      AND principal = normalized_principal
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Platform admin role assignment not found: %:%',
        normalized_principal_type,
        normalized_principal;
    END IF;

    normalized_role := role_row.role;

    UPDATE public.platform_admin_roles
    SET
      status = next_status,
      note = COALESCE(p_note, note),
      updated_by = p_actor_user_id,
      updated_at = NOW()
    WHERE id = role_row.id
    RETURNING * INTO role_row;
  ELSE
    next_status := 'active';

    INSERT INTO public.platform_admin_roles (
      principal_type,
      principal,
      role,
      status,
      note,
      created_by,
      updated_by
    )
    VALUES (
      normalized_principal_type,
      normalized_principal,
      normalized_role,
      next_status,
      p_note,
      p_actor_user_id,
      p_actor_user_id
    )
    ON CONFLICT (principal_type, principal)
    DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      note = EXCLUDED.note,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING * INTO role_row;
  END IF;

  SELECT p_actor_user_id
  INTO existing_actor_user_id
  WHERE p_actor_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = p_actor_user_id
    );

  INSERT INTO public.audit_logs (
    org_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  VALUES (
    NULL,
    existing_actor_user_id,
    CASE
      WHEN normalized_operation = 'disable' THEN 'platform.admin_role_disabled'
      ELSE 'platform.admin_role_upserted'
    END,
    'platform_admin_role',
    role_row.id::text,
    jsonb_build_object(
      'principal_type', role_row.principal_type,
      'principal', role_row.principal,
      'role', role_row.role,
      'status', role_row.status,
      'requested_by', p_actor_user_id,
      'note', p_note
    )
  )
  RETURNING id INTO created_audit_log_id;

  RETURN jsonb_build_object(
    'operation', normalized_operation,
    'id', role_row.id,
    'principal_type', role_row.principal_type,
    'principal', role_row.principal,
    'role', role_row.role,
    'status', role_row.status,
    'note', role_row.note,
    'created_by', role_row.created_by,
    'updated_by', role_row.updated_by,
    'created_at', role_row.created_at,
    'updated_at', role_row.updated_at,
    'audit_log_id', created_audit_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.manage_platform_admin_role(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.manage_platform_admin_role(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT
) TO service_role;
