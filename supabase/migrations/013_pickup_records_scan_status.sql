-- Add scan status fields for pickup records.
-- Scan status is independent from print and received/inbound workflows.

ALTER TABLE public.pickup_records
ADD COLUMN IF NOT EXISTS is_scanned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.pickup_records
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

UPDATE public.pickup_records
SET is_scanned = FALSE
WHERE is_scanned IS NULL;

CREATE INDEX IF NOT EXISTS idx_pickup_records_is_scanned
ON public.pickup_records(is_scanned);

CREATE INDEX IF NOT EXISTS idx_pickup_records_scanned_at
ON public.pickup_records(scanned_at DESC);
