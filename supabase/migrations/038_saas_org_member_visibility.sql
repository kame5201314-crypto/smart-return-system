-- Team settings member visibility for SaaS organizations.
--
-- The original commercial foundation allows authenticated users to select only
-- their own organization_members row. That is enough for org-context lookup,
-- but it prevents the tenant team page from showing owner/admin users the
-- rest of their organization's members through the normal RLS client.
--
-- Keep writes service-role/API controlled. This migration only adds a safe
-- same-organization SELECT policy, using a SECURITY DEFINER helper to avoid
-- recursive organization_members RLS evaluation.

CREATE OR REPLACE FUNCTION public.is_organization_member(
  p_org_id UUID,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS member
    WHERE member.org_id = p_org_id
      AND member.user_id = auth.uid()
      AND COALESCE(member.status, 'active') <> 'disabled'
      AND (
        p_roles IS NULL
        OR member.role = ANY(p_roles)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_organization_member(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID, TEXT[]) TO service_role;

DROP POLICY IF EXISTS "members_select_org_memberships" ON public.organization_members;
CREATE POLICY "members_select_org_memberships"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(org_id));

COMMENT ON FUNCTION public.is_organization_member(UUID, TEXT[])
  IS 'RLS helper for SaaS tenant membership checks. SECURITY DEFINER avoids recursive organization_members policies.';
