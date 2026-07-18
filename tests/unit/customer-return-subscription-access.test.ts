import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveCustomerReturnWorkspaceAccess as resolveAccess } from '@/lib/saas/customer-return-workspace-access';

const now = '2026-07-18T00:00:00.000Z';

describe('customer return workspace access', () => {
  it('allows only matching active or unexpired trial states', () => {
    expect(resolveAccess({
      orgStatus: 'active', subscriptionStatus: 'active', trialEnd: null, now,
    }).canCreate).toBe(true);
    expect(resolveAccess({
      orgStatus: 'trialing',
      subscriptionStatus: 'trialing',
      trialEnd: '2026-07-19T00:00:00.000Z',
      now,
    }).canCreate).toBe(true);
  });

  it('blocks expired or unverifiable trials immediately', () => {
    expect(resolveAccess({
      orgStatus: 'trialing',
      subscriptionStatus: 'trialing',
      trialEnd: '2026-07-17T23:59:59.000Z',
      now,
    })).toMatchObject({ effectiveStatus: 'suspended', canCreate: false });
    for (const trialEnd of [null, undefined, '', 'not-a-date']) {
      expect(resolveAccess({
        orgStatus: 'trialing', subscriptionStatus: 'trialing', trialEnd, now,
      })).toMatchObject({
        effectiveStatus: 'suspended',
        canCreate: false,
        reason: 'trial_expiry_unavailable',
      });
    }
  });

  it('fails closed when organization and subscription states drift', () => {
    for (const [orgStatus, subscriptionStatus] of [
      ['active', 'trialing'],
      ['trialing', 'active'],
      ['active', undefined],
    ]) {
      expect(resolveAccess({ orgStatus, subscriptionStatus, trialEnd: null, now })).toMatchObject({
        effectiveStatus: 'suspended',
        canCreate: false,
        reason: 'subscription_status_mismatch',
      });
    }
  });

  it('checks access before the service-role mutation path', () => {
    const source = readFileSync(join(process.cwd(), 'lib/actions/customer-return.actions.ts'), 'utf8');
    const accessIndex = source.indexOf('const workspaceAccess = resolveCustomerReturnWorkspaceAccess');
    const mutationIndex = source.indexOf('const { data: newCustomer');
    expect(source).toContain(".select('status, subscriptions(status, trial_end)')");
    expect(source).toContain('orgStatus: workspaceAccess.effectiveStatus');
    expect(accessIndex).toBeGreaterThan(-1);
    expect(mutationIndex).toBeGreaterThan(accessIndex);
  });
});
