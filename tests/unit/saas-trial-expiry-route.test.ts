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
});
