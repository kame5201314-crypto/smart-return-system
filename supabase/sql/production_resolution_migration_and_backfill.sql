-- Production runbook SQL: resolution_type schema + backfill
-- Paste into Supabase SQL Editor and run once in production.

BEGIN;

ALTER TABLE public.return_items
ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(30);

UPDATE public.return_items
SET resolution_type = 'full'
WHERE resolution_type IS NULL OR btrim(resolution_type) = '';

UPDATE public.return_items
SET resolution_type = 'full'
WHERE resolution_type NOT IN ('full', 'partial', 'exchange', 'round_trip');

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

ALTER TABLE public.return_items
ALTER COLUMN resolution_type SET DEFAULT 'full';

ALTER TABLE public.return_items
ALTER COLUMN resolution_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_return_items_resolution_type
ON public.return_items(resolution_type);

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

COMMIT;

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'return_items'
  AND column_name = 'resolution_type';

SELECT resolution_type, COUNT(*) AS count
FROM public.return_items
GROUP BY resolution_type
ORDER BY resolution_type;

