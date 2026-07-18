-- SaaS tenant write guards for suspended, past-due, cancelled, expired-trial,
-- and disabled-member sessions.
--
-- This migration is intentionally additive. Do not modify or re-run migration
-- 025. Apply only to the SaaS Supabase project after an explicit rollout
-- approval and a disposable-project verification.

CREATE OR REPLACE FUNCTION public.is_writable_organization_member(
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
    JOIN public.organizations AS organization
      ON organization.id = member.org_id
    JOIN public.subscriptions AS subscription
      ON subscription.org_id = member.org_id
    WHERE member.org_id = p_org_id
      AND member.user_id = auth.uid()
      AND COALESCE(member.status, 'active') = 'active'
      AND (
        p_roles IS NULL
        OR member.role = ANY(p_roles)
      )
      AND (
        (
          organization.status = 'active'
          AND subscription.status = 'active'
        )
        OR (
          organization.status = 'trialing'
          AND subscription.status = 'trialing'
          AND subscription.trial_end IS NOT NULL
          AND subscription.trial_end > NOW()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) TO service_role;

COMMENT ON FUNCTION public.is_writable_organization_member(UUID, TEXT[])
  IS 'RLS helper that allows tenant writes only for active members in active paid or unexpired trial workspaces.';

-- Recreate every tenant business-table write policy introduced by migration
-- 025 so a stale browser session cannot bypass application-level suspension.

DROP POLICY IF EXISTS "customers_staff_insert" ON public.customers;
CREATE POLICY "customers_staff_insert"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "orders_staff_insert" ON public.orders;
CREATE POLICY "orders_staff_insert"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "orders_staff_update" ON public.orders;
CREATE POLICY "orders_staff_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "return_requests_staff_insert" ON public.return_requests;
CREATE POLICY "return_requests_staff_insert"
  ON public.return_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "return_requests_staff_update" ON public.return_requests;
CREATE POLICY "return_requests_staff_update"
  ON public.return_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "return_items_staff_insert" ON public.return_items;
CREATE POLICY "return_items_staff_insert"
  ON public.return_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "return_items_staff_update" ON public.return_items;
CREATE POLICY "return_items_staff_update"
  ON public.return_items
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "return_images_staff_insert" ON public.return_images;
CREATE POLICY "return_images_staff_insert"
  ON public.return_images
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "return_images_staff_update" ON public.return_images;
CREATE POLICY "return_images_staff_update"
  ON public.return_images
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "inspection_records_staff_insert" ON public.inspection_records;
CREATE POLICY "inspection_records_staff_insert"
  ON public.inspection_records
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "inspection_records_staff_update" ON public.inspection_records;
CREATE POLICY "inspection_records_staff_update"
  ON public.inspection_records
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "shopee_returns_staff_insert" ON public.shopee_returns;
CREATE POLICY "shopee_returns_staff_insert"
  ON public.shopee_returns
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "shopee_returns_staff_update" ON public.shopee_returns;
CREATE POLICY "shopee_returns_staff_update"
  ON public.shopee_returns
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "pickup_records_staff_insert" ON public.pickup_records;
CREATE POLICY "pickup_records_staff_insert"
  ON public.pickup_records
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "pickup_records_staff_update" ON public.pickup_records;
CREATE POLICY "pickup_records_staff_update"
  ON public.pickup_records
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "shopee_unmatched_scans_staff_insert" ON public.shopee_unmatched_scans;
CREATE POLICY "shopee_unmatched_scans_staff_insert"
  ON public.shopee_unmatched_scans
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "shopee_unmatched_scans_staff_update" ON public.shopee_unmatched_scans;
CREATE POLICY "shopee_unmatched_scans_staff_update"
  ON public.shopee_unmatched_scans
  FOR UPDATE
  TO authenticated
  USING (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.is_writable_organization_member(org_id, ARRAY['owner', 'admin', 'staff']));
