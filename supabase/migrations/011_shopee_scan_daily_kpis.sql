-- Daily scan KPI snapshots for operations monitoring.
-- This table stores aggregated operational metrics only (no customer data mutation).

CREATE TABLE IF NOT EXISTS public.shopee_scan_daily_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL UNIQUE,
  total_scans INTEGER NOT NULL DEFAULT 0,
  matched_scans INTEGER NOT NULL DEFAULT 0,
  unmatched_scans INTEGER NOT NULL DEFAULT 0,
  duplicate_scans INTEGER NOT NULL DEFAULT 0,
  unmatched_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  duplicate_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  scanned_rows INTEGER NOT NULL DEFAULT 0,
  inbound_rows INTEGER NOT NULL DEFAULT 0,
  not_inbound_rows INTEGER NOT NULL DEFAULT 0,
  stale_unmatched_open INTEGER NOT NULL DEFAULT 0,
  stale_hours_threshold INTEGER NOT NULL DEFAULT 24,
  smoke_passed BOOLEAN NOT NULL DEFAULT TRUE,
  smoke_errors JSONB,
  smoke_warnings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_daily_kpis_metric_date
ON public.shopee_scan_daily_kpis(metric_date DESC);

CREATE OR REPLACE FUNCTION public.set_shopee_scan_daily_kpis_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_shopee_scan_daily_kpis_updated_at
  ON public.shopee_scan_daily_kpis;
CREATE TRIGGER trg_set_shopee_scan_daily_kpis_updated_at
BEFORE UPDATE ON public.shopee_scan_daily_kpis
FOR EACH ROW
EXECUTE FUNCTION public.set_shopee_scan_daily_kpis_updated_at();

ALTER TABLE public.shopee_scan_daily_kpis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopee_scan_daily_kpis'
      AND policyname = 'Allow all for authenticated users on shopee_scan_daily_kpis'
  ) THEN
    CREATE POLICY "Allow all for authenticated users on shopee_scan_daily_kpis"
      ON public.shopee_scan_daily_kpis
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopee_scan_daily_kpis'
      AND policyname = 'Allow service role full access on shopee_scan_daily_kpis'
  ) THEN
    CREATE POLICY "Allow service role full access on shopee_scan_daily_kpis"
      ON public.shopee_scan_daily_kpis
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
