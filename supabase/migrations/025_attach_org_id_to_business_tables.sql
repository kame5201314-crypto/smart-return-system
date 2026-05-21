-- DRAFT: Attach org_id to business tables for SaaS tenant isolation.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.
--
-- Assumption: fresh SaaS database or separately approved backfill.
-- If applying to a database with existing rows, backfill org_id before setting NOT NULL.

-- ---------------------------------------------------------------------------
-- 1. Attach org_id columns.
-- ---------------------------------------------------------------------------
-- Legacy internal migrations created some org_id columns as VARCHAR and attached
-- RLS policies that compare against public.users.org_id. SaaS uses UUID org ids.
-- This migration is only approved for a fresh SaaS database, so the type
-- conversion is safe before tenant data exists.
DROP POLICY IF EXISTS "orders_select_org" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_org" ON public.orders;
DROP POLICY IF EXISTS "orders_update_org" ON public.orders;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "returns_select_org" ON public.return_requests;
DROP POLICY IF EXISTS "returns_insert_org" ON public.return_requests;
DROP POLICY IF EXISTS "returns_update" ON public.return_requests;
DROP POLICY IF EXISTS "returns_delete_admin" ON public.return_requests;
DROP POLICY IF EXISTS "return_items_select" ON public.return_items;
DROP POLICY IF EXISTS "return_items_insert" ON public.return_items;
DROP POLICY IF EXISTS "return_items_update" ON public.return_items;
DROP POLICY IF EXISTS "return_images_select" ON public.return_images;
DROP POLICY IF EXISTS "return_images_insert" ON public.return_images;
DROP POLICY IF EXISTS "return_images_delete" ON public.return_images;
DROP POLICY IF EXISTS "return_logs_select" ON public.return_logs;
DROP POLICY IF EXISTS "return_logs_insert" ON public.return_logs;
DROP POLICY IF EXISTS "ai_analysis_select" ON public.ai_analysis_results;
DROP POLICY IF EXISTS "ai_analysis_insert" ON public.ai_analysis_results;

ALTER TABLE IF EXISTS public.orders
  ALTER COLUMN org_id DROP NOT NULL,
  ALTER COLUMN org_id TYPE UUID USING NULLIF(org_id, '')::uuid;

ALTER TABLE IF EXISTS public.return_requests
  ALTER COLUMN org_id DROP NOT NULL,
  ALTER COLUMN org_id TYPE UUID USING NULLIF(org_id, '')::uuid;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.customers
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.return_requests
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.return_items
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.return_images
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.order_items
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.activity_logs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.inspection_records
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.ai_analysis_reports
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.ai_usage_events
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shopee_returns
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.pickup_records
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shopee_scan_events
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shopee_unmatched_scans
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.shopee_scan_daily_kpis
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.scan_audit_logs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Make org_id required after fresh-start/backfill review.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.customers ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.return_requests ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.return_items ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.return_images ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.order_items ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.activity_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.inspection_records ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.ai_analysis_reports ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.ai_usage_events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.shopee_returns ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.pickup_records ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.shopee_scan_events ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.shopee_unmatched_scans ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.shopee_scan_daily_kpis ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.scan_audit_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE IF EXISTS public.products ALTER COLUMN org_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Tenant indexes and unique constraints.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_org_phone
ON public.customers(org_id, phone);

CREATE INDEX IF NOT EXISTS idx_orders_org_order_number
ON public.orders(org_id, order_number);

CREATE INDEX IF NOT EXISTS idx_return_requests_org_status_created
ON public.return_requests(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_return_items_org_request
ON public.return_items(org_id, return_request_id);

CREATE INDEX IF NOT EXISTS idx_return_images_org_request
ON public.return_images(org_id, return_request_id);

CREATE INDEX IF NOT EXISTS idx_order_items_org_order
ON public.order_items(org_id, order_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created
ON public.activity_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspection_records_org_request
ON public.inspection_records(org_id, return_request_id);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_reports_org_period_created
ON public.ai_analysis_reports(org_id, report_period, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_org_feature_period_created
ON public.ai_usage_events(org_id, feature, report_period, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_returns_org_order_sku
ON public.shopee_returns(org_id, order_number, option_sku);

CREATE INDEX IF NOT EXISTS idx_pickup_records_org_process_date
ON public.pickup_records(org_id, process_date DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_org_scanned_at
ON public.shopee_scan_events(org_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_unmatched_scans_org_status_last_seen
ON public.shopee_unmatched_scans(org_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_daily_kpis_org_metric_date
ON public.shopee_scan_daily_kpis(org_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_scan_audit_logs_org_created
ON public.scan_audit_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_org_sku
ON public.products(org_id, sku);

ALTER TABLE IF EXISTS public.shopee_returns
  DROP CONSTRAINT IF EXISTS shopee_returns_order_number_option_sku_key;

ALTER TABLE IF EXISTS public.shopee_returns
  ADD CONSTRAINT shopee_returns_org_order_number_option_sku_key
  UNIQUE (org_id, order_number, option_sku);

DROP INDEX IF EXISTS public.uniq_shopee_unmatched_scans_open_norm;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_shopee_unmatched_scans_org_open_norm
ON public.shopee_unmatched_scans(org_id, normalized_code)
WHERE status = 'open';

ALTER TABLE IF EXISTS public.shopee_scan_daily_kpis
  DROP CONSTRAINT IF EXISTS shopee_scan_daily_kpis_metric_date_key;

ALTER TABLE IF EXISTS public.shopee_scan_daily_kpis
  ADD CONSTRAINT shopee_scan_daily_kpis_org_metric_date_key
  UNIQUE (org_id, metric_date);

-- ---------------------------------------------------------------------------
-- 4. RLS policy reset for SaaS business tables.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inspection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shopee_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pickup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shopee_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shopee_unmatched_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shopee_scan_daily_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

-- Drop known broad authenticated policies from internal/live-era migrations.
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.shopee_returns;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.pickup_records;
DROP POLICY IF EXISTS "Allow all for authenticated users on shopee_scan_events" ON public.shopee_scan_events;
DROP POLICY IF EXISTS "Allow all for authenticated users on shopee_unmatched_scans" ON public.shopee_unmatched_scans;
DROP POLICY IF EXISTS "Allow all for authenticated users on shopee_scan_daily_kpis" ON public.shopee_scan_daily_kpis;
DROP POLICY IF EXISTS "Allow authenticated read on scan_audit_logs" ON public.scan_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read on ai_usage_events" ON public.ai_usage_events;

DROP POLICY IF EXISTS "authenticated_customers_select" ON public.customers;
DROP POLICY IF EXISTS "authenticated_customers_insert" ON public.customers;
DROP POLICY IF EXISTS "authenticated_orders_select" ON public.orders;
DROP POLICY IF EXISTS "authenticated_orders_insert" ON public.orders;
DROP POLICY IF EXISTS "authenticated_orders_update" ON public.orders;
DROP POLICY IF EXISTS "authenticated_return_requests_all" ON public.return_requests;
DROP POLICY IF EXISTS "authenticated_return_items_all" ON public.return_items;
DROP POLICY IF EXISTS "authenticated_return_images_all" ON public.return_images;
DROP POLICY IF EXISTS "authenticated_activity_logs_select" ON public.activity_logs;
DROP POLICY IF EXISTS "authenticated_activity_logs_insert" ON public.activity_logs;
DROP POLICY IF EXISTS "authenticated_inspection_records_all" ON public.inspection_records;
DROP POLICY IF EXISTS "authenticated_ai_analysis_reports_all" ON public.ai_analysis_reports;

-- ---------------------------------------------------------------------------
-- 5. Tenant RLS policies.
-- ---------------------------------------------------------------------------
CREATE POLICY "customers_members_select"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "customers_staff_insert"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "orders_members_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "orders_staff_insert"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "orders_staff_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "return_requests_members_select"
  ON public.return_requests
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "return_requests_staff_insert"
  ON public.return_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "return_requests_staff_update"
  ON public.return_requests
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "return_items_members_select"
  ON public.return_items
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "return_items_staff_insert"
  ON public.return_items
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "return_items_staff_update"
  ON public.return_items
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "return_images_members_select"
  ON public.return_images
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "return_images_staff_insert"
  ON public.return_images
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "return_images_staff_update"
  ON public.return_images
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "inspection_records_members_select"
  ON public.inspection_records
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "inspection_records_staff_insert"
  ON public.inspection_records
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "inspection_records_staff_update"
  ON public.inspection_records
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "shopee_returns_members_select"
  ON public.shopee_returns
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "shopee_returns_staff_insert"
  ON public.shopee_returns
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "shopee_returns_staff_update"
  ON public.shopee_returns
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "pickup_records_members_select"
  ON public.pickup_records
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "pickup_records_staff_insert"
  ON public.pickup_records
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "pickup_records_staff_update"
  ON public.pickup_records
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "ai_analysis_reports_members_select"
  ON public.ai_analysis_reports
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "ai_usage_events_owner_admin_select"
  ON public.ai_usage_events
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "shopee_scan_events_members_select"
  ON public.shopee_scan_events
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "shopee_unmatched_scans_staff_insert"
  ON public.shopee_unmatched_scans
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "shopee_unmatched_scans_staff_update"
  ON public.shopee_unmatched_scans
  FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')))
  WITH CHECK (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')));

CREATE POLICY "shopee_scan_daily_kpis_members_select"
  ON public.shopee_scan_daily_kpis
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "scan_audit_logs_owner_admin_select"
  ON public.scan_audit_logs
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "activity_logs_owner_admin_select"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Service-role full-access policies remain for controlled server-only paths.
-- Runtime code must still pass and filter by org_id explicitly.

-- ---------------------------------------------------------------------------
-- 6. Supabase REST role grants.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
