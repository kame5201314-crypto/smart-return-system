-- DRAFT: SaaS notification and email queue foundation.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued', 'sent', 'failed', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key
ON public.notifications(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_key TEXT NOT NULL CHECK (
    template_key IN (
      'billing.payment_failed',
      'usage.ai_quota_reached',
      'trial.ending',
      'platform.announcement'
    )
  ),
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'billing_payment_failed',
      'ai_quota_reached',
      'trial_ending',
      'platform_announcement'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  send_after TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_org_created
ON public.email_queue(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_send_after
ON public.email_queue(status, send_after, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_idempotency_key
ON public.email_queue(idempotency_key)
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- email_queue is intentionally service-role only for now.
-- No authenticated policies are added until a worker/audit UI contract is approved.
