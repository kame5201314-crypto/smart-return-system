-- DRAFT: SaaS platform admin read model alignment.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0
    CHECK (member_count >= 0);

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_organizations_plan_status_created
ON public.organizations(plan, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_email
ON public.organizations(lower(owner_email))
WHERE owner_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_members_org_status_role
ON public.organization_members(org_id, status, role);

CREATE OR REPLACE FUNCTION public.refresh_organization_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org_id UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    target_org_id := OLD.org_id;

    IF target_org_id IS NOT NULL THEN
      UPDATE public.organizations
      SET
        member_count = (
          SELECT COUNT(*)::INTEGER
          FROM public.organization_members
          WHERE org_id = target_org_id
        ),
        updated_at = NOW()
      WHERE id = target_org_id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    target_org_id := NEW.org_id;

    UPDATE public.organizations
    SET
      member_count = (
        SELECT COUNT(*)::INTEGER
        FROM public.organization_members
        WHERE org_id = target_org_id
      ),
      updated_at = NOW()
    WHERE id = target_org_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_organization_member_count_insert
ON public.organization_members;

CREATE TRIGGER trg_refresh_organization_member_count_insert
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.refresh_organization_member_count();

DROP TRIGGER IF EXISTS trg_refresh_organization_member_count_update
ON public.organization_members;

CREATE TRIGGER trg_refresh_organization_member_count_update
AFTER UPDATE OF org_id ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.refresh_organization_member_count();

DROP TRIGGER IF EXISTS trg_refresh_organization_member_count_delete
ON public.organization_members;

CREATE TRIGGER trg_refresh_organization_member_count_delete
AFTER DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.refresh_organization_member_count();

UPDATE public.organizations AS org
SET member_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.organization_members AS member
  WHERE member.org_id = org.id
);
