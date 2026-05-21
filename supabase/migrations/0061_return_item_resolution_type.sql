-- Add per-item handling mode for return items
ALTER TABLE public.return_items
ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(30) DEFAULT 'full';

UPDATE public.return_items
SET resolution_type = 'full'
WHERE resolution_type IS NULL;

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
ALTER COLUMN resolution_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_return_items_resolution_type
ON public.return_items(resolution_type);
