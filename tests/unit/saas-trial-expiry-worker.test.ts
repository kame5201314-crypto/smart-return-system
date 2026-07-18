/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  createTrialExpiryRepository,
  runScopedTrialExpiry,
  type TrialExpiryCandidate,
  type TrialExpiryRepository,
} from '@/lib/saas/trial-expiry-worker';

const orgId = '11111111-1111-4111-8111-111111111111';
const subscriptionId = '22222222-2222-4222-8222-222222222222';

function candidate(overrides: Partial<TrialExpiryCandidate> = {}): TrialExpiryCandidate {
  return {
    subscriptionId,
    orgId,
    status: 'trialing',
    trialEnd: '2026-07-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('scoped SaaS trial expiry worker', () => {
  it('suspends only candidates resolved as expired trialing subscriptions', async () => {
    const repository: TrialExpiryRepository = {
      listExpiredTrials: vi.fn(async () => [candidate()]),
      suspendExpiredTrial: vi.fn(async () => ({
        changed: true,
        orgId,
        subscriptionId,
        auditLogId: '33333333-3333-4333-8333-333333333333',
        reason: 'trial_expired',
      })),
    };

    const result = await runScopedTrialExpiry(repository, {
      now: new Date('2026-07-14T00:00:00.000Z'),
    });

    expect(result.summary).toEqual({ scanned: 1, suspended: 1, skipped: 0, failed: 0 });
    expect(repository.suspendExpiredTrial).toHaveBeenCalledWith({
      orgId,
      effectiveAt: '2026-07-14T00:00:00.000Z',
    });
  });

  it('does not call the mutation when an invalid future candidate reaches the worker', async () => {
    const repository: TrialExpiryRepository = {
      listExpiredTrials: vi.fn(async () => [
        candidate({ trialEnd: '2026-07-15T00:00:00.000Z' }),
      ]),
      suspendExpiredTrial: vi.fn(),
    };

    const result = await runScopedTrialExpiry(repository, {
      now: new Date('2026-07-14T00:00:00.000Z'),
    });

    expect(result.summary).toEqual({ scanned: 1, suspended: 0, skipped: 1, failed: 0 });
    expect(repository.suspendExpiredTrial).not.toHaveBeenCalled();
  });

  it('queries only expired trialing rows and uses the scoped RPC', async () => {
    const then = vi.fn((resolve) => Promise.resolve(resolve({
      data: [
        {
          id: subscriptionId,
          org_id: orgId,
          status: 'trialing',
          trial_end: '2026-07-13T00:00:00.000Z',
          self_service_org: {
            self_service_claim: { org_id: orgId },
          },
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          org_id: '55555555-5555-4555-8555-555555555555',
          status: 'trialing',
          trial_end: '2026-06-09T00:00:00.000Z',
        },
      ],
      error: null,
    })));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      then,
    };
    const client = {
      from: vi.fn(() => query),
      rpc: vi.fn(async () => ({
        data: { changed: false, org_id: orgId, subscription_id: subscriptionId, reason: 'not_expired_trial' },
        error: null,
      })),
    };
    const repository = createTrialExpiryRepository(client);

    await expect(repository.listExpiredTrials({
      now: '2026-07-14T00:00:00.000Z',
      limit: 25,
    })).resolves.toEqual([candidate()]);
    await repository.suspendExpiredTrial({ orgId, effectiveAt: '2026-07-14T00:00:00.000Z' });

    expect(query.eq).toHaveBeenCalledWith('status', 'trialing');
    expect(query.lte).toHaveBeenCalledWith('trial_end', '2026-07-14T00:00:00.000Z');
    expect(query.select).toHaveBeenCalledWith(
      'id, org_id, status, trial_end, self_service_org:organizations!inner(self_service_claim:saas_self_service_trial_claims!inner(org_id))'
    );
    expect(client.rpc).toHaveBeenCalledWith('suspend_expired_trial_organization', {
      p_org_id: orgId,
      p_effective_at: '2026-07-14T00:00:00.000Z',
    });
  });
});
