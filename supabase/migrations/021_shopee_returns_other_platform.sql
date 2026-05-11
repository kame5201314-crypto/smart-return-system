-- Allow manually keyed shopee returns to use platform "other".
-- This keeps existing Shopee/Mall data unchanged and only widens validation.

ALTER TABLE public.shopee_returns
ADD COLUMN IF NOT EXISTS platform VARCHAR(20);

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.shopee_returns'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%platform%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.shopee_returns DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.shopee_returns
  ADD CONSTRAINT shopee_returns_platform_check
  CHECK (platform IS NULL OR platform IN ('shopee', 'mall', 'other'));
END
$$;

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  IF to_regclass('public.shopee_scan_events') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.shopee_scan_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%platform%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.shopee_scan_events DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.shopee_scan_events
  ADD CONSTRAINT shopee_scan_events_platform_check
  CHECK (platform IS NULL OR platform IN ('shopee', 'mall', 'other'));
END
$$;
