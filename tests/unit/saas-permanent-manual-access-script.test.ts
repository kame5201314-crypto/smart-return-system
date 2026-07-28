import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(process.cwd(), 'scripts/saas/grant-permanent-manual-access.mjs'),
  'utf8'
);

describe('permanent manual access maintenance script', () => {
  it('defaults to dry-run and requires an explicit apply flag', () => {
    expect(source).toContain("apply: false");
    expect(source).toContain("argument === '--apply'");
    expect(source).toContain("sanitizedResult(state, 'eligible', false)");
  });

  it('pins the SaaS project and exact account before writing', () => {
    expect(source).toContain('SAAS_SUPABASE_PROJECT_ID');
    expect(source).toContain('findUniqueUserByEmail');
    expect(source).toContain("membership.role !== 'owner'");
  });

  it('rejects self-service, paid, and platform-suspended organizations', () => {
    expect(source).toContain("from('saas_self_service_trial_claims')");
    expect(source).toContain("from('payment_orders')");
    expect(source).toContain("from('subscription_periods')");
    expect(source).toContain("from('billing_events')");
    expect(source).toContain("suspension_source === 'platform_admin'");
  });

  it('records an audit event and supports rollback', () => {
    expect(source).toContain('platform.billing.permanent_manual_access_granted');
    expect(source).toContain("from('audit_logs')");
    expect(source).toContain('restorePreviousState');
  });
});
