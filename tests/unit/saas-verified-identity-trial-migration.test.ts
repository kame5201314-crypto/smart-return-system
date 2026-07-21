import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/044_saas_verified_identity_self_service_trial.sql'),
  'utf8'
);

describe('migration 044 verified identity self-service trial', () => {
  it('preserves the immutable SaaS-only migration source and old Google RPC signature', () => {
    expect(source).toContain('Never apply to master/live/internal Supabase');
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.create_google_self_service_trial');
    expect(source).toContain("'google'");
  });

  it('adds provider-aware claim identity and phone-only contact support', () => {
    expect(source).toContain('ALTER COLUMN normalized_email DROP NOT NULL');
    expect(source).toContain('identity_provider TEXT NOT NULL DEFAULT \'google\'');
    expect(source).toContain("identity_provider IN ('google', 'email_otp', 'phone_otp')");
    expect(source).toContain('normalized_phone TEXT');
    expect(source).toContain('uq_saas_self_service_trial_claims_normalized_phone');
    expect(source).toContain('saas_self_service_trial_claims_normalized_contact_check');
    expect(source).toContain('owner_phone TEXT');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS phone TEXT');
  });

  it('verifies auth provider and confirmed contacts inside a service-role-only RPC', () => {
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.create_verified_identity_self_service_trial');
    expect(source).toContain('FROM auth.users');
    expect(source).toContain('FROM auth.identities');
    expect(source).toContain('email_confirmed_at IS NOT NULL');
    expect(source).toContain('phone_confirmed_at IS NOT NULL');
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain("'trial-idempotency:'");
    expect(source).toContain('trial already claimed by another identity');
    expect(source).toContain('user already has organization membership');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.create_verified_identity_self_service_trial');
    expect(source).toContain('FROM PUBLIC, anon, authenticated');
    expect(source).toContain('TO service_role');
  });

  it('atomically creates the same trial resources used by quota and expiry protection', () => {
    expect(source).toContain('effective_at TIMESTAMPTZ := NOW()');
    expect(source).toContain("NOW() + INTERVAL '3 days'");
    expect(source).toContain("trial_end_at TIMESTAMPTZ := NOW() + INTERVAL '3 days'");
    expect(source).toContain('INSERT INTO public.organizations');
    expect(source).toContain('INSERT INTO public.organization_members');
    expect(source).toContain('INSERT INTO public.subscriptions');
    expect(source).toContain('INSERT INTO public.saas_self_service_trial_claims');
    expect(source).toContain('INSERT INTO public.audit_logs');
    expect(source).toContain('org.google_self_service_trial_created');
    expect(source).toContain('org.email_otp_self_service_trial_created');
    expect(source).toContain('org.phone_otp_self_service_trial_created');
    expect(source).toContain('IF NOT auth_email_confirmed THEN');
    expect(source).not.toMatch(/otp[^\n]*(audit|metadata|INSERT)/i);
  });

  it('anchors every new subscription boundary to the same database trial clock', () => {
    expect(source).toContain(
      `VALUES (
    created_org_id,
    p_plan,
    'trialing',
    'manual',
    effective_at,
    trial_end_at,
    trial_end_at,
    false
  )`
    );
  });
});
