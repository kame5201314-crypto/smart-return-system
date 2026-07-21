/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { handleTrialExpiryCron } from '@/app/api/cron/saas/trial-expiry/route';

function request(secret = 'cron-secret') {
  return new Request('https://example.com/api/cron/saas/trial-expiry', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe('SaaS trial expiry cron route', () => {
  it('fails closed when CRON_SECRET is missing or wrong', async () => {
    const repository = { listExpiredTrials: vi.fn(), suspendExpiredTrial: vi.fn() };
    const missing = await handleTrialExpiryCron(request(), {
      env: { ENABLE_TRIAL_EXPIRY_CRON: 'true' },
      repository,
    });
    const wrong = await handleTrialExpiryCron(request('wrong'), {
      env: { CRON_SECRET: 'cron-secret', ENABLE_TRIAL_EXPIRY_CRON: 'true' },
      repository,
    });
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(repository.listExpiredTrials).not.toHaveBeenCalled();
  });

  it('does not read or mutate trials while the rollout flag is disabled', async () => {
    const repository = { listExpiredTrials: vi.fn(), suspendExpiredTrial: vi.fn() };
    const response = await handleTrialExpiryCron(request(), {
      env: { CRON_SECRET: 'cron-secret', ENABLE_TRIAL_EXPIRY_CRON: 'false' },
      repository,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      skipped: true,
      code: 'trial_expiry_cron_disabled',
    });
    expect(repository.listExpiredTrials).not.toHaveBeenCalled();
  });

  it('runs the scoped worker only when auth and rollout flag are valid', async () => {
    const repository = {
      listExpiredTrials: vi.fn(async () => []),
      suspendExpiredTrial: vi.fn(),
    };
    const response = await handleTrialExpiryCron(request(), {
      env: {
        CRON_SECRET: 'cron-secret',
        ENABLE_TRIAL_EXPIRY_CRON: 'true',
        SAAS_TRIAL_EXPIRY_BATCH_LIMIT: '20',
      },
      now: new Date('2026-07-14T00:00:00.000Z'),
      repository,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { summary: { scanned: 0, suspended: 0, skipped: 0, failed: 0 } },
    });
    expect(repository.listExpiredTrials).toHaveBeenCalledWith({
      now: '2026-07-14T00:00:00.000Z',
      limit: 20,
    });
  });

  it('reports a failed mutation as a cron failure', async () => {
    const repository = {
      listExpiredTrials: vi.fn(async () => [{
        subscriptionId: '22222222-2222-4222-8222-222222222222',
        orgId: '11111111-1111-4111-8111-111111111111',
        status: 'trialing' as const,
        trialEnd: '2026-07-13T00:00:00.000Z',
      }]),
      suspendExpiredTrial: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    };
    const response = await handleTrialExpiryCron(request(), {
      env: { CRON_SECRET: 'cron-secret', ENABLE_TRIAL_EXPIRY_CRON: 'true' },
      now: new Date('2026-07-14T00:00:00.000Z'),
      repository,
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      success: false,
      data: { summary: { failed: 1 } },
    });
  });

  it('can run paid fixed-term expiry independently without scanning trials', async () => {
    const repository = {
      listExpiredTrials: vi.fn(async () => []),
      suspendExpiredTrial: vi.fn(),
      listExpiredPaidSubscriptions: vi.fn(async () => [{
        subscriptionId: '22222222-2222-4222-8222-222222222222',
        orgId: '11111111-1111-4111-8111-111111111111',
        status: 'active' as const,
        provider: 'ecpay' as const,
        currentPeriodEnd: '2026-07-13T00:00:00.000Z',
      }]),
      suspendExpiredPaidSubscription: vi.fn(async () => ({
        changed: true,
        orgId: '11111111-1111-4111-8111-111111111111',
        subscriptionId: '22222222-2222-4222-8222-222222222222',
        auditLogId: null,
        reason: 'prepaid_period_expired',
      })),
    };
    const response = await handleTrialExpiryCron(request(), {
      env: {
        CRON_SECRET: 'cron-secret',
        ENABLE_TRIAL_EXPIRY_CRON: 'false',
        ENABLE_PAID_PERIOD_EXPIRY_CRON: 'true',
        SAAS_PAID_PERIOD_EXPIRY_BATCH_LIMIT: '15',
      },
      now: new Date('2026-07-14T00:00:00.000Z'),
      repository,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        summary: { scanned: 1, suspended: 1, skipped: 0, failed: 0 },
        scopeSummary: {
          trials: { scanned: 0, suspended: 0, skipped: 0, failed: 0 },
          paidPeriods: { scanned: 1, suspended: 1, skipped: 0, failed: 0 },
        },
      },
    });
    expect(repository.listExpiredTrials).not.toHaveBeenCalled();
    expect(repository.listExpiredPaidSubscriptions).toHaveBeenCalledWith({
      now: '2026-07-14T00:00:00.000Z',
      limit: 15,
    });
  });

  it('fails closed when the paid-period flag is enabled without paid repository methods', async () => {
    const repository = {
      listExpiredTrials: vi.fn(async () => []),
      suspendExpiredTrial: vi.fn(),
    };
    const response = await handleTrialExpiryCron(request(), {
      env: {
        CRON_SECRET: 'cron-secret',
        ENABLE_TRIAL_EXPIRY_CRON: 'false',
        ENABLE_PAID_PERIOD_EXPIRY_CRON: 'true',
      },
      repository,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Paid period expiry repository methods are not configured.',
    });
    expect(repository.listExpiredTrials).not.toHaveBeenCalled();
  });

  it('returns 500 after completing paid expiry when the trial list query fails', async () => {
    const repository = {
      listExpiredTrials: vi.fn(async () => {
        throw new Error('trial query unavailable');
      }),
      suspendExpiredTrial: vi.fn(),
      listExpiredPaidSubscriptions: vi.fn(async () => [{
        subscriptionId: '22222222-2222-4222-8222-222222222222',
        orgId: '11111111-1111-4111-8111-111111111111',
        status: 'active' as const,
        provider: 'ecpay' as const,
        currentPeriodEnd: '2026-07-13T00:00:00.000Z',
      }]),
      suspendExpiredPaidSubscription: vi.fn(async () => ({
        changed: true,
        orgId: '11111111-1111-4111-8111-111111111111',
        subscriptionId: '22222222-2222-4222-8222-222222222222',
        auditLogId: null,
        reason: 'prepaid_period_expired',
      })),
    };
    const response = await handleTrialExpiryCron(request(), {
      env: {
        CRON_SECRET: 'cron-secret',
        ENABLE_TRIAL_EXPIRY_CRON: 'true',
        ENABLE_PAID_PERIOD_EXPIRY_CRON: 'true',
      },
      now: new Date('2026-07-14T00:00:00.000Z'),
      repository,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      success: false,
      data: {
        summary: { scanned: 1, suspended: 1, skipped: 0, failed: 1 },
        scopeSummary: {
          trials: { scanned: 0, suspended: 0, skipped: 0, failed: 1 },
          paidPeriods: { scanned: 1, suspended: 1, skipped: 0, failed: 0 },
        },
        scopeErrors: { trials: 'trial query unavailable' },
      },
    });
    expect(repository.suspendExpiredPaidSubscription).toHaveBeenCalledTimes(1);
  });
});
