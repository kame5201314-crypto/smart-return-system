/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  createTrialExpiryRepository,
  isPaidPeriodExpiryCronEnabled,
  runScopedTrialExpiry,
  type PaidPeriodExpiryCandidate,
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

function paidCandidate(
  overrides: Partial<PaidPeriodExpiryCandidate> = {}
): PaidPeriodExpiryCandidate {
  return {
    subscriptionId,
    orgId,
    status: 'active',
    provider: 'ecpay',
    currentPeriodEnd: '2026-07-13T00:00:00.000Z',
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
      in: vi.fn(() => query),
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

  it('keeps paid-period expiry disabled unless its independent flag is enabled', () => {
    expect(isPaidPeriodExpiryCronEnabled({})).toBe(false);
    expect(isPaidPeriodExpiryCronEnabled({ ENABLE_PAID_PERIOD_EXPIRY_CRON: 'false' })).toBe(false);
    expect(isPaidPeriodExpiryCronEnabled({ ENABLE_PAID_PERIOD_EXPIRY_CRON: 'true' })).toBe(true);
  });

  it('suspends expired ECPay and manual fixed-term periods when explicitly included', async () => {
    const manualSubscriptionId = '44444444-4444-4444-8444-444444444444';
    const manualOrgId = '55555555-5555-4555-8555-555555555555';
    const repository: TrialExpiryRepository = {
      listExpiredTrials: vi.fn(async () => []),
      suspendExpiredTrial: vi.fn(),
      listExpiredPaidSubscriptions: vi.fn(async () => [
        paidCandidate(),
        paidCandidate({
          subscriptionId: manualSubscriptionId,
          orgId: manualOrgId,
          provider: 'manual',
        }),
      ]),
      suspendExpiredPaidSubscription: vi.fn(async ({ orgId: suspendedOrgId }) => ({
        changed: true,
        orgId: suspendedOrgId,
        subscriptionId: suspendedOrgId === orgId ? subscriptionId : manualSubscriptionId,
        auditLogId: null,
        reason: 'prepaid_period_expired',
      })),
    };

    const result = await runScopedTrialExpiry(repository, {
      now: new Date('2026-07-14T00:00:00.000Z'),
      includeTrials: false,
      includePaidPeriods: true,
      paidPeriodLimit: 20,
    });

    expect(result.summary).toEqual({ scanned: 2, suspended: 2, skipped: 0, failed: 0 });
    expect(result.scopeSummary).toEqual({
      trials: { scanned: 0, suspended: 0, skipped: 0, failed: 0 },
      paidPeriods: { scanned: 2, suspended: 2, skipped: 0, failed: 0 },
    });
    expect(repository.listExpiredTrials).not.toHaveBeenCalled();
    expect(repository.listExpiredPaidSubscriptions).toHaveBeenCalledWith({
      now: '2026-07-14T00:00:00.000Z',
      limit: 20,
    });
    expect(repository.suspendExpiredPaidSubscription).toHaveBeenCalledTimes(2);
    expect(repository.suspendExpiredPaidSubscription).toHaveBeenNthCalledWith(1, {
      orgId,
      effectiveAt: '2026-07-14T00:00:00.000Z',
    });
  });

  it('fails closed when paid-period expiry is enabled without repository methods', async () => {
    const repository: TrialExpiryRepository = {
      listExpiredTrials: vi.fn(async () => []),
      suspendExpiredTrial: vi.fn(),
    };

    await expect(runScopedTrialExpiry(repository, {
      includePaidPeriods: true,
    })).rejects.toThrow('Paid period expiry repository methods are not configured.');
    expect(repository.listExpiredTrials).not.toHaveBeenCalled();
  });

  it('continues paid-period expiry when the trial candidate query fails', async () => {
    const repository: TrialExpiryRepository = {
      listExpiredTrials: vi.fn(async () => {
        throw new Error('trial query unavailable');
      }),
      suspendExpiredTrial: vi.fn(),
      listExpiredPaidSubscriptions: vi.fn(async () => [paidCandidate()]),
      suspendExpiredPaidSubscription: vi.fn(async () => ({
        changed: true,
        orgId,
        subscriptionId,
        auditLogId: null,
        reason: 'prepaid_period_expired',
      })),
    };

    const result = await runScopedTrialExpiry(repository, {
      now: new Date('2026-07-14T00:00:00.000Z'),
      includePaidPeriods: true,
    });

    expect(result.summary).toEqual({ scanned: 1, suspended: 1, skipped: 0, failed: 1 });
    expect(result.scopeSummary).toEqual({
      trials: { scanned: 0, suspended: 0, skipped: 0, failed: 1 },
      paidPeriods: { scanned: 1, suspended: 1, skipped: 0, failed: 0 },
    });
    expect(result.scopeErrors).toEqual({ trials: 'trial query unavailable' });
    expect(repository.suspendExpiredTrial).not.toHaveBeenCalled();
    expect(repository.suspendExpiredPaidSubscription).toHaveBeenCalledWith({
      orgId,
      effectiveAt: '2026-07-14T00:00:00.000Z',
    });
  });

  it('continues trial expiry when the paid-period candidate query fails', async () => {
    const repository: TrialExpiryRepository = {
      listExpiredTrials: vi.fn(async () => [candidate()]),
      suspendExpiredTrial: vi.fn(async () => ({
        changed: true,
        orgId,
        subscriptionId,
        auditLogId: null,
        reason: 'trial_expired',
      })),
      listExpiredPaidSubscriptions: vi.fn(async () => {
        throw new Error('paid query unavailable');
      }),
      suspendExpiredPaidSubscription: vi.fn(),
    };

    const result = await runScopedTrialExpiry(repository, {
      now: new Date('2026-07-14T00:00:00.000Z'),
      includePaidPeriods: true,
    });

    expect(result.summary).toEqual({ scanned: 1, suspended: 1, skipped: 0, failed: 1 });
    expect(result.scopeSummary).toEqual({
      trials: { scanned: 1, suspended: 1, skipped: 0, failed: 0 },
      paidPeriods: { scanned: 0, suspended: 0, skipped: 0, failed: 1 },
    });
    expect(result.scopeErrors).toEqual({ paidPeriods: 'paid query unavailable' });
    expect(repository.suspendExpiredTrial).toHaveBeenCalledWith({
      orgId,
      effectiveAt: '2026-07-14T00:00:00.000Z',
    });
    expect(repository.suspendExpiredPaidSubscription).not.toHaveBeenCalled();
  });

  it('queries expired active fixed-term rows and filters unsupported or incomplete records', async () => {
    const manualSubscriptionId = '44444444-4444-4444-8444-444444444444';
    const manualOrgId = '55555555-5555-4555-8555-555555555555';
    const then = vi.fn((resolve) => Promise.resolve(resolve({
      data: [
        {
          id: subscriptionId,
          org_id: orgId,
          status: 'active',
          provider: 'ecpay',
          current_period_end: '2026-07-13T00:00:00.000Z',
        },
        {
          id: manualSubscriptionId,
          org_id: manualOrgId,
          status: 'active',
          provider: 'manual',
          current_period_end: '2026-07-12T00:00:00.000Z',
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          org_id: '77777777-7777-4777-8777-777777777777',
          status: 'active',
          provider: 'manual',
          current_period_end: null,
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          org_id: '99999999-9999-4999-8999-999999999999',
          status: 'active',
          provider: 'stripe',
          current_period_end: '2026-07-11T00:00:00.000Z',
        },
      ],
      error: null,
    })));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      then,
    };
    const client = {
      from: vi.fn(() => query),
      rpc: vi.fn(async () => ({
        data: {
          changed: true,
          org_id: orgId,
          subscription_id: subscriptionId,
          reason: 'prepaid_period_expired',
        },
        error: null,
      })),
    };
    const repository = createTrialExpiryRepository(client);

    await expect(repository.listExpiredPaidSubscriptions!({
      now: '2026-07-14T00:00:00.000Z',
      limit: 25,
    })).resolves.toEqual([
      paidCandidate(),
      paidCandidate({
        subscriptionId: manualSubscriptionId,
        orgId: manualOrgId,
        provider: 'manual',
        currentPeriodEnd: '2026-07-12T00:00:00.000Z',
      }),
    ]);
    await repository.suspendExpiredPaidSubscription!({
      orgId,
      effectiveAt: '2026-07-14T00:00:00.000Z',
    });

    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.in).toHaveBeenCalledWith('provider', ['ecpay', 'manual']);
    expect(query.lte).toHaveBeenCalledWith(
      'current_period_end',
      '2026-07-14T00:00:00.000Z'
    );
    expect(query.select).toHaveBeenCalledWith(
      'id, org_id, status, provider, current_period_end'
    );
    expect(client.rpc).toHaveBeenCalledWith('suspend_expired_paid_organization', {
      p_org_id: orgId,
      p_effective_at: '2026-07-14T00:00:00.000Z',
    });
  });
});
