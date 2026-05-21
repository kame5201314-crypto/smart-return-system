-- DRAFT: SaaS public signup request persistence.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

CREATE TABLE IF NOT EXISTS public.signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan = 'basic'),
  monthly_return_volume INTEGER CHECK (
    monthly_return_volume IS NULL OR monthly_return_volume >= 0
  ),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  source TEXT NOT NULL DEFAULT 'public_signup'
    CHECK (source IN ('public_signup', 'manual_beta')),
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_requests_status_created
ON public.signup_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signup_requests_email_created
ON public.signup_requests(lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signup_requests_org_created
ON public.signup_requests(org_id, created_at DESC)
WHERE org_id IS NOT NULL;

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_signup_requests" ON public.signup_requests;
CREATE POLICY "service_role_full_signup_requests"
  ON public.signup_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
