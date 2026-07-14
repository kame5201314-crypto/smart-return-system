-- Applied to SaaS project auyznbwtjvemyamujmgt on 2026-07-14 after
-- explicit owner authorization. Do not reapply without a repair authorization.
-- This migration extends the already-applied signup_requests table. Do not edit 026.

ALTER TABLE public.signup_requests
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.signup_requests
  ADD COLUMN IF NOT EXISTS line_id TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact_channel TEXT,
  ADD COLUMN IF NOT EXISTS monthly_return_band TEXT,
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ;

UPDATE public.signup_requests
SET preferred_contact_channel = CASE
  WHEN NULLIF(BTRIM(email), '') IS NOT NULL THEN 'email'
  WHEN NULLIF(BTRIM(line_id), '') IS NOT NULL THEN 'line'
  ELSE 'phone'
END
WHERE preferred_contact_channel IS NULL;

ALTER TABLE public.signup_requests
  ALTER COLUMN preferred_contact_channel SET DEFAULT 'email',
  ALTER COLUMN preferred_contact_channel SET NOT NULL;

ALTER TABLE public.signup_requests
  DROP CONSTRAINT IF EXISTS signup_requests_plan_check,
  ADD CONSTRAINT signup_requests_plan_check
    CHECK (plan IN ('basic', 'growth', 'enterprise'));

ALTER TABLE public.signup_requests
  DROP CONSTRAINT IF EXISTS signup_requests_source_check,
  ADD CONSTRAINT signup_requests_source_check
    CHECK (source IN ('public_signup', 'public_lead', 'manual_beta'));

ALTER TABLE public.signup_requests
  DROP CONSTRAINT IF EXISTS signup_requests_preferred_contact_channel_check,
  ADD CONSTRAINT signup_requests_preferred_contact_channel_check
    CHECK (preferred_contact_channel IN ('email', 'line', 'phone'));

ALTER TABLE public.signup_requests
  DROP CONSTRAINT IF EXISTS signup_requests_contact_method_check,
  ADD CONSTRAINT signup_requests_contact_method_check CHECK (
    NULLIF(BTRIM(email), '') IS NOT NULL
    OR NULLIF(BTRIM(line_id), '') IS NOT NULL
    OR NULLIF(BTRIM(phone), '') IS NOT NULL
  );

ALTER TABLE public.signup_requests
  DROP CONSTRAINT IF EXISTS signup_requests_preferred_contact_value_check,
  ADD CONSTRAINT signup_requests_preferred_contact_value_check CHECK (
    (preferred_contact_channel = 'email' AND NULLIF(BTRIM(email), '') IS NOT NULL)
    OR (preferred_contact_channel = 'line' AND NULLIF(BTRIM(line_id), '') IS NOT NULL)
    OR (preferred_contact_channel = 'phone' AND NULLIF(BTRIM(phone), '') IS NOT NULL)
  );

ALTER TABLE public.signup_requests
  DROP CONSTRAINT IF EXISTS signup_requests_monthly_return_band_check,
  ADD CONSTRAINT signup_requests_monthly_return_band_check CHECK (
    monthly_return_band IS NULL
    OR monthly_return_band IN ('under_30', '30_100', '101_300', '301_800', 'over_800')
  );

CREATE INDEX IF NOT EXISTS idx_signup_requests_follow_up
ON public.signup_requests(follow_up_at, created_at)
WHERE status IN ('pending', 'approved');

COMMENT ON COLUMN public.signup_requests.line_id IS
  'Optional LINE identifier supplied by a public lead.';
COMMENT ON COLUMN public.signup_requests.monthly_return_band IS
  'Lead-reported monthly return volume band; monthly_return_volume remains available for exact values.';
COMMENT ON COLUMN public.signup_requests.contacted_at IS
  'First confirmed operator contact time; lead disposition remains in status.';
