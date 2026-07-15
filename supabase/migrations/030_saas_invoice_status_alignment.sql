-- Applied to SaaS project auyznbwtjvemyamujmgt as part of the migration chain through 032.
-- Do not reapply; use a new migration for future schema changes.
-- Do not apply to the internal/live production Supabase project.

DO $$
DECLARE
  status_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.invoices'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.invoices DROP CONSTRAINT %I',
      status_constraint_name
    );
  END IF;
END
$$;

ALTER TABLE public.invoices
  ALTER COLUMN status SET DEFAULT 'draft',
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'issued', 'paid', 'failed', 'void'));

CREATE INDEX IF NOT EXISTS idx_invoices_status_created
ON public.invoices(status, created_at DESC);
