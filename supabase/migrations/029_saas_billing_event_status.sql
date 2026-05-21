-- DRAFT: SaaS billing event status alignment.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed', 'ignored'));

CREATE INDEX IF NOT EXISTS idx_billing_events_status_created
ON public.billing_events(status, created_at DESC);

UPDATE public.billing_events
SET status = 'processed'
WHERE processed_at IS NOT NULL
  AND status = 'received';
