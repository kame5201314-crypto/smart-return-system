-- DRAFT: SaaS commercial v2 foundation.
-- Not applied to any database.
-- Apply to the SaaS Supabase project only after review, credentials, and backup are confirmed.
-- Do not apply to the internal/live production Supabase project.

-- 1. Extend member roles from owner/admin/member to owner/admin/staff/viewer.
DO $$
DECLARE
  role_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO role_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.organization_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%'
  LIMIT 1;

  IF role_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.organization_members DROP CONSTRAINT %I',
      role_constraint_name
    );
  END IF;
END
$$;

UPDATE public.organization_members
SET role = 'staff'
WHERE role = 'member';

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'staff', 'viewer'));

ALTER TABLE public.organization_members
  ALTER COLUMN role SET DEFAULT 'staff';

-- 2. Extend organization and subscription fields for manual Beta and billing.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_carrier TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upgrade_suggested_at TIMESTAMPTZ;

DO $$
DECLARE
  status_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.subscriptions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.subscriptions DROP CONSTRAINT %I',
      status_constraint_name
    );
  END IF;
END
$$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 3. Member invitation flow.
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'viewer')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_organization_invites_org_created
ON public.organization_invites(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_organization_invites_token
ON public.organization_invites(token);

-- 4. Invoice records for ECPay e-invoice integration.
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_twd INTEGER NOT NULL CHECK (amount_twd >= 0),
  status TEXT NOT NULL CHECK (status IN ('issued', 'failed', 'void')),
  provider TEXT NOT NULL,
  provider_invoice_id TEXT,
  invoice_number TEXT,
  issued_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_created
ON public.invoices(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_provider_invoice
ON public.invoices(provider, provider_invoice_id);

-- 5. Audit trail for platform admin, billing, and tenant-sensitive actions.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
ON public.audit_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
ON public.audit_logs(action, created_at DESC);

-- 6. RLS for new SaaS commercial tables.
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_admins_manage_invites" ON public.organization_invites;
CREATE POLICY "org_admins_manage_invites"
  ON public.organization_invites
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "members_select_own_invoices" ON public.invoices;
CREATE POLICY "members_select_own_invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members_select_own_audit_logs" ON public.audit_logs;
CREATE POLICY "members_select_own_audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "service_role_full_organization_invites" ON public.organization_invites;
CREATE POLICY "service_role_full_organization_invites"
  ON public.organization_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_invoices" ON public.invoices;
CREATE POLICY "service_role_full_invoices"
  ON public.invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_audit_logs" ON public.audit_logs;
CREATE POLICY "service_role_full_audit_logs"
  ON public.audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
