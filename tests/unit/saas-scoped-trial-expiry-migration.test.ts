/* @vitest-environment node */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/041_saas_scoped_trial_expiry.sql'),
  'utf8'
);
const scopeMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/042_saas_scope_trial_expiry_to_self_service.sql'
  ),
  'utf8'
);

describe('scoped trial expiry migration', () => {
  it('rechecks trialing and trial_end inside the locked transaction', () => {
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("subscription_record.status <> 'trialing'");
    expect(migration).toContain('subscription_record.trial_end > effective_at');
    expect(migration).toContain("status = 'suspended'");
    expect(migration).not.toContain("status = 'cancelled'");
  });

  it('is service-role only and records an audit event without deleting data', () => {
    expect(migration).toContain('TO service_role');
    expect(migration).toContain("'lifecycle.trial_expired_suspended'");
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });

  it('requires a self-service trial claim before the expiry mutation can run', () => {
    expect(scopeMigration).toContain('public.saas_self_service_trial_claims');
    expect(scopeMigration).toContain('claim.org_id = p_org_id');
    expect(scopeMigration).toContain("'not_self_service_trial'");
    expect(scopeMigration).toContain('TO service_role');
    expect(scopeMigration).not.toMatch(/DELETE\s+FROM/i);
  });
});
