-- Retention policy for scan observability tables.
-- Keep hot data in main tables, move older rows to archive tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.shopee_scan_events_archive (
  archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id UUID NOT NULL,
  scanned_code TEXT NOT NULL,
  normalized_code TEXT NOT NULL,
  scan_status VARCHAR(20) NOT NULL,
  matched_order_id UUID,
  matched_order_number VARCHAR(100),
  matched_tracking_number VARCHAR(100),
  platform VARCHAR(20),
  matched_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  metadata JSONB,
  scanned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_batch_id UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shopee_scan_events_archive_original_id
ON public.shopee_scan_events_archive(original_id);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_archive_scanned_at
ON public.shopee_scan_events_archive(scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_scan_events_archive_archived_at
ON public.shopee_scan_events_archive(archived_at DESC);

CREATE TABLE IF NOT EXISTS public.shopee_unmatched_scans_archive (
  archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id UUID NOT NULL,
  normalized_code TEXT NOT NULL,
  sample_scanned_code TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL,
  resolved_order_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_batch_id UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shopee_unmatched_scans_archive_original_id
ON public.shopee_unmatched_scans_archive(original_id);

CREATE INDEX IF NOT EXISTS idx_shopee_unmatched_scans_archive_last_seen
ON public.shopee_unmatched_scans_archive(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopee_unmatched_scans_archive_archived_at
ON public.shopee_unmatched_scans_archive(archived_at DESC);

CREATE OR REPLACE FUNCTION public.archive_old_scan_data(
  p_scan_event_retention_days INTEGER DEFAULT 180,
  p_unmatched_retention_days INTEGER DEFAULT 90,
  p_batch_limit INTEGER DEFAULT 5000
)
RETURNS TABLE(
  archived_scan_events INTEGER,
  archived_unmatched_scans INTEGER,
  deleted_scan_events INTEGER,
  deleted_unmatched_scans INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived_scan_events INTEGER := 0;
  v_archived_unmatched_scans INTEGER := 0;
BEGIN
  IF p_scan_event_retention_days < 1 OR p_unmatched_retention_days < 1 OR p_batch_limit < 1 THEN
    RAISE EXCEPTION 'Retention parameters must be positive integers.';
  END IF;

  WITH moved_scan_events AS (
    DELETE FROM public.shopee_scan_events
    WHERE id IN (
      SELECT id
      FROM public.shopee_scan_events
      WHERE scanned_at < NOW() - make_interval(days => p_scan_event_retention_days)
      ORDER BY scanned_at ASC
      LIMIT p_batch_limit
    )
    RETURNING *
  )
  INSERT INTO public.shopee_scan_events_archive (
    original_id,
    scanned_code,
    normalized_code,
    scan_status,
    matched_order_id,
    matched_order_number,
    matched_tracking_number,
    platform,
    matched_count,
    updated_count,
    message,
    metadata,
    scanned_at,
    created_at
  )
  SELECT
    id,
    scanned_code,
    normalized_code,
    scan_status,
    matched_order_id,
    matched_order_number,
    matched_tracking_number,
    platform,
    matched_count,
    updated_count,
    message,
    metadata,
    scanned_at,
    created_at
  FROM moved_scan_events;

  GET DIAGNOSTICS v_archived_scan_events = ROW_COUNT;

  -- Only archive resolved unmatched records to avoid dropping active queue items.
  WITH moved_unmatched_scans AS (
    DELETE FROM public.shopee_unmatched_scans
    WHERE id IN (
      SELECT id
      FROM public.shopee_unmatched_scans
      WHERE status = 'resolved'
        AND COALESCE(resolved_at, last_seen_at, created_at)
          < NOW() - make_interval(days => p_unmatched_retention_days)
      ORDER BY COALESCE(resolved_at, last_seen_at, created_at) ASC
      LIMIT p_batch_limit
    )
    RETURNING *
  )
  INSERT INTO public.shopee_unmatched_scans_archive (
    original_id,
    normalized_code,
    sample_scanned_code,
    first_seen_at,
    last_seen_at,
    hit_count,
    status,
    resolved_order_id,
    resolved_at,
    resolved_by,
    note,
    created_at,
    updated_at
  )
  SELECT
    id,
    normalized_code,
    sample_scanned_code,
    first_seen_at,
    last_seen_at,
    hit_count,
    status,
    resolved_order_id,
    resolved_at,
    resolved_by,
    note,
    created_at,
    updated_at
  FROM moved_unmatched_scans;

  GET DIAGNOSTICS v_archived_unmatched_scans = ROW_COUNT;

  RETURN QUERY
  SELECT
    v_archived_scan_events,
    v_archived_unmatched_scans,
    v_archived_scan_events,
    v_archived_unmatched_scans;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_old_scan_data(INTEGER, INTEGER, INTEGER) TO service_role;
