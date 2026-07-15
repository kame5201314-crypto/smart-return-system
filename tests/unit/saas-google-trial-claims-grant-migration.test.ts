import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/043_saas_google_trial_claims_service_role_read.sql'
);

describe('Google self-service trial claims grants', () => {
  const source = fs.readFileSync(migrationPath, 'utf8');

  it('allows only service_role to read trial quota state directly', () => {
    expect(source).toContain(
      'GRANT SELECT ON TABLE public.saas_self_service_trial_claims TO service_role'
    );
    expect(source).toContain(
      'REVOKE ALL ON TABLE public.saas_self_service_trial_claims FROM anon, authenticated'
    );
    expect(source).not.toContain(
      'GRANT SELECT ON TABLE public.saas_self_service_trial_claims TO anon'
    );
    expect(source).not.toContain(
      'GRANT SELECT ON TABLE public.saas_self_service_trial_claims TO authenticated'
    );
  });
});
