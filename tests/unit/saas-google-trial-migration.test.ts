import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/040_saas_google_self_service_trial.sql'
);

describe('Google self-service trial migration', () => {
  const source = fs.readFileSync(migrationPath, 'utf8');

  it('keeps the provisioning RPC service-role only and atomic', () => {
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.create_google_self_service_trial');
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.create_google_self_service_trial');
    expect(source).toContain('TO service_role');
    expect(source).not.toContain('TO authenticated');
    expect(source).not.toContain('TO anon');
  });

  it('records one-time claims, terms acceptance, trial end, and audit evidence', () => {
    expect(source).toContain('UNIQUE (user_id)');
    expect(source).toContain('UNIQUE (normalized_email)');
    expect(source).toContain("NOW() + INTERVAL '14 days'");
    expect(source).toContain('terms_accepted_at');
    expect(source).toContain('org.google_self_service_trial_created');
    expect(source).toContain("p_plan NOT IN ('basic', 'growth')");
  });
});
