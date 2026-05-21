-- Scan observability + unmatched queue + normalized lookup indexes
-- 1) shopee_returns normalized keys for faster scan matching
-- 2) shopee_scan_events for full scan audit trail
-- 3) shopee_unmatched_scans queue for manual binding flow

-- ------------------------------------------------------------
-- Normalize helper
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_scan_key(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(coalesce(input_text, '')), '[^A-Z0-9]', '', 'g');
$$;

-- ------------------------------------------------------------
-- Add normalized columns to shopee_returns
-- ------------------------------------------------------------
ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);

ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS order_number_norm TEXT;

ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS tracking_number_norm TEXT;

UPDATE public.shopee_returns
SET
  order_number_norm = public.normalize_scan_key(order_number),
  tracking_number_norm = NULLIF(public.normalize_scan_key(tracking_number), '')
WHERE
  order_number_norm IS NULL
  OR tracking_number_norm IS NULL;

CREATE OR REPLACE FUNCTION public.set_shopee_return_scan_norms()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.order_number_norm := public.normalize_scan_key(NEW.order_number);
  NEW.tracking_number_norm := NULLIF(public.normalize_scan_key(NEW.tracking_number), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_shopee_return_scan_norms ON public.shopee_returns;
CREATE TRIGGER trg_set_shopee_return_scan_norms
BEFORE INSERT OR UPDATE OF order_number, tracking_number
ON public.shopee_returns
FOR EACH ROW
EXECUTE FUNCTION public.set_shopee_return_scan_norms();

ALTER TABLE public.shopee_returns
ALTER COLUMN order_number_norm SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopee_returns_order_number_norm
ON public.shopee_returns(order_number_norm);

CREATE INDEX IF NOT EXISTS idx_shopee_returns_tracking_number_norm
ON public.shopee_returns(tracking_number_norm);

-- ------------------------------------------------------------
-- Scan event log table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopee_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_code TEXT NOT NULL,
  normalized_code TEXT NOT NULL,
  scan_status VARCHAR(20) NOT NULL CHECK (scan_status IN ('matched', 'unmatched', 'duplicate', 'error')),
  matched_order_id UUID REFERENCES public.shopee_returns(id) ON DELETE SET NULL,
  matched_order_number VARCHAR(100),
  matched_tracking_number VARCHAR(100),
  platform VARCHAR(20) CHECK (platform IN ('shopee', 'mall')),
  matched_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  metadata JSONB,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_scanned_at
ON public.shopee_scan_events(scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_normalized_code
ON public.shopee_scan_events(normalized_code);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_status
ON public.shopee_scan_events(scan_status);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_matched_order_id
ON public.shopee_scan_events(matched_order_id);

ALTER TABLE public.shopee_scan_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopee_scan_events'
      AND policyname = 'Allow all for authenticated users on shopee_scan_events'
  ) THEN
    CREATE POLICY "Allow all for authenticated users on shopee_scan_events"
      ON public.shopee_scan_events
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopee_scan_events'
      AND policyname = 'Allow service role full access on shopee_scan_events'
  ) THEN
    CREATE POLICY "Allow service role full access on shopee_scan_events"
      ON public.shopee_scan_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Unmatched scan queue table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopee_unmatched_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_code TEXT NOT NULL,
  sample_scanned_code TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_order_id UUID REFERENCES public.shopee_returns(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shopee_unmatched_scans_open_norm
ON public.shopee_unmatched_scans(normalized_code)
WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_shopee_unmatched_scans_status_last_seen
ON public.shopee_unmatched_scans(status, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_shopee_unmatched_scans_updated_at ON public.shopee_unmatched_scans;
CREATE TRIGGER trg_set_shopee_unmatched_scans_updated_at
BEFORE UPDATE ON public.shopee_unmatched_scans
FOR EACH ROW
EXECUTE FUNCTION public.set_timestamp_updated_at();

ALTER TABLE public.shopee_unmatched_scans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopee_unmatched_scans'
      AND policyname = 'Allow all for authenticated users on shopee_unmatched_scans'
  ) THEN
    CREATE POLICY "Allow all for authenticated users on shopee_unmatched_scans"
      ON public.shopee_unmatched_scans
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shopee_unmatched_scans'
      AND policyname = 'Allow service role full access on shopee_unmatched_scans'
  ) THEN
    CREATE POLICY "Allow service role full access on shopee_unmatched_scans"
      ON public.shopee_unmatched_scans
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
