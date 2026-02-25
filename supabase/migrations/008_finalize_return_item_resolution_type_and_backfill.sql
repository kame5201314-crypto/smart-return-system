-- Finalize return_items.resolution_type schema and backfill legacy fallback values.
-- This migration is idempotent and safe to run multiple times.

-- 1) Ensure column exists
ALTER TABLE public.return_items
ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(30);

-- 2) Normalize blank/NULL values first
UPDATE public.return_items
SET resolution_type = 'full'
WHERE resolution_type IS NULL OR btrim(resolution_type) = '';

-- 3) Normalize unexpected legacy values to a valid default
UPDATE public.return_items
SET resolution_type = 'full'
WHERE resolution_type NOT IN ('full', 'partial', 'exchange', 'round_trip');

-- 4) Add constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'return_items_resolution_type_check'
  ) THEN
    ALTER TABLE public.return_items
    ADD CONSTRAINT return_items_resolution_type_check
    CHECK (resolution_type IN ('full', 'partial', 'exchange', 'round_trip'));
  END IF;
END
$$;

-- 5) Ensure default and not-null
ALTER TABLE public.return_items
ALTER COLUMN resolution_type SET DEFAULT 'full';

ALTER TABLE public.return_items
ALTER COLUMN resolution_type SET NOT NULL;

-- 6) Ensure index exists
CREATE INDEX IF NOT EXISTS idx_return_items_resolution_type
ON public.return_items(resolution_type);

-- 7) Backfill from fallback field return_requests.refund_method when available
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'return_requests'
      AND column_name = 'refund_method'
  ) THEN
    UPDATE public.return_items ri
    SET resolution_type = CASE
      WHEN rr.refund_method IN ('partial', 'partial_refund', '部分退款') THEN 'partial'
      WHEN rr.refund_method IN ('exchange', '換貨') THEN 'exchange'
      WHEN rr.refund_method IN ('round_trip', '來回件') THEN 'round_trip'
      ELSE ri.resolution_type
    END
    FROM public.return_requests rr
    WHERE rr.id = ri.return_request_id
      AND rr.refund_method IS NOT NULL
      AND btrim(rr.refund_method) <> ''
      AND ri.resolution_type = 'full';
  END IF;
END
$$;

