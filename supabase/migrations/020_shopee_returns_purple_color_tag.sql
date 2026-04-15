-- Ensure shopee return color tags support purple for "安排收件".

ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS color_tag VARCHAR(20);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shopee_returns_color_tag_check'
      AND conrelid = 'public.shopee_returns'::regclass
  ) THEN
    ALTER TABLE public.shopee_returns
    DROP CONSTRAINT shopee_returns_color_tag_check;
  END IF;

  ALTER TABLE public.shopee_returns
  ADD CONSTRAINT shopee_returns_color_tag_check
  CHECK (color_tag IS NULL OR color_tag IN ('yellow', 'red', 'purple'));
END
$$;
