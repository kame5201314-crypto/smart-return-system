import { describe, expect, it, vi } from 'vitest';

import {
  createSelfServiceTrialAIQuotaRepository,
  loadSelfServiceTrialAIQuotaSnapshot,
  reserveSelfServiceTrialAIAnalysis,
  SelfServiceTrialAIQuotaError,
} from '@/lib/saas/self-service-trial-ai-quota';

const orgId = '11111111-1111-4111-8111-111111111111';
const claimId = '22222222-2222-4222-8222-222222222222';
const reservationToken = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-07-14T12:00:00.000Z');

describe('self-service trial AI quota policy', () => {
  it('does not call the draft RPC before Google trial signup is enabled', async () => {
    const repository = { reserve: vi.fn(), complete: vi.fn(), release: vi.fn() };

    await expect(reserveSelfServiceTrialAIAnalysis({
      enabled: false,
      orgId,
      repository,
      now,
    })).resolves.toBeNull();
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it('lets non-self-service organizations continue through the monthly policy', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { applies: false, allowed: true, reason: 'not_self_service_trial' },
      error: null,
    });
    const repository = createSelfServiceTrialAIQuotaRepository({ rpc });

    await expect(repository.reserve(orgId, now.toISOString())).resolves.toBeNull();
  });

  it('restores monthly plan quota after a self-service trial converts to paid', async () => {
    const repository = createSelfServiceTrialAIQuotaRepository({
      rpc: vi.fn().mockResolvedValue({
        data: { applies: false, allowed: true, reason: 'paid_plan' },
        error: null,
      }),
    });

    await expect(repository.reserve(orgId, now.toISOString())).resolves.toBeNull();
  });

  it('normalizes an atomically acquired reservation and passes its token to completion', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          applies: true,
          allowed: true,
          reason: 'reserved',
          claim_id: claimId,
          reservation_token: reservationToken,
          reserved_at: now.toISOString(),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { completed: true, reused: false, claim_id: claimId },
        error: null,
      });
    const repository = createSelfServiceTrialAIQuotaRepository({ rpc });
    const reservation = await repository.reserve(orgId, now.toISOString());

    expect(reservation).toMatchObject({ orgId, claimId, reservationToken });
    await repository.complete(reservation!, now.toISOString());
    expect(rpc).toHaveBeenLastCalledWith(
      'complete_google_self_service_trial_ai_analysis',
      {
        p_org_id: orgId,
        p_reservation_token: reservationToken,
        p_effective_at: now.toISOString(),
      }
    );
  });

  it('allows the first completed trial analysis and rejects the second reservation', async () => {
    let completed = false;
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === 'complete_google_self_service_trial_ai_analysis') {
        completed = true;
        return {
          data: { completed: true, reused: false, claim_id: claimId },
          error: null,
        };
      }

      return completed
        ? {
            data: {
              applies: true,
              allowed: false,
              reason: 'limit_reached',
              claim_id: claimId,
            },
            error: null,
          }
        : {
            data: {
              applies: true,
              allowed: true,
              reason: 'reserved',
              claim_id: claimId,
              reservation_token: reservationToken,
              reserved_at: now.toISOString(),
            },
            error: null,
          };
    });
    const repository = createSelfServiceTrialAIQuotaRepository({ rpc });

    const firstReservation = await repository.reserve(orgId, now.toISOString());
    expect(firstReservation).toMatchObject({ orgId, claimId, reservationToken });
    await repository.complete(firstReservation!, now.toISOString());

    await expect(repository.reserve(orgId, now.toISOString())).rejects.toMatchObject({
      code: 'trial_ai_quota_exceeded',
      status: 402,
      quota: { limit: 1, used: 1, remaining: 0 },
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['limit_reached', 'trial_ai_quota_exceeded', 402, 1],
    ['in_progress', 'trial_ai_analysis_in_progress', 409, 0],
    ['trial_inactive', 'trial_inactive', 402, 0],
  ] as const)('maps %s to a stable API error', async (reason, code, status, used) => {
    const repository = createSelfServiceTrialAIQuotaRepository({
      rpc: vi.fn().mockResolvedValue({
        data: { applies: true, allowed: false, reason },
        error: null,
      }),
    });

    await expect(repository.reserve(orgId, now.toISOString())).rejects.toMatchObject({
      code,
      status,
      quota: { limit: 1, used, remaining: 1 - used },
    });
  });

  it('fails closed when the reservation RPC is unavailable', async () => {
    const repository = createSelfServiceTrialAIQuotaRepository({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function does not exist' },
      }),
    });

    await expect(repository.reserve(orgId, now.toISOString()))
      .rejects.toBeInstanceOf(SelfServiceTrialAIQuotaError);
    await expect(repository.reserve(orgId, now.toISOString())).rejects.toMatchObject({
      code: 'trial_ai_quota_unavailable',
      status: 503,
    });
  });

  it('releases only through the token-owned RPC contract', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { released: true }, error: null });
    const repository = createSelfServiceTrialAIQuotaRepository({ rpc });

    await repository.release({
      orgId,
      claimId,
      reservationToken,
      reservedAt: now.toISOString(),
    });

    expect(rpc).toHaveBeenCalledWith(
      'release_google_self_service_trial_ai_analysis',
      { p_org_id: orgId, p_reservation_token: reservationToken }
    );
  });

  it('shows 0/1 before use and 1/1 after a successful self-service trial analysis', async () => {
    const availableClient = createQuotaQueryClient({
      analysis_reserved_at: null,
      analysis_completed_at: null,
    });
    await expect(loadSelfServiceTrialAIQuotaSnapshot({
      enabled: true,
      orgId,
      orgStatus: 'trialing',
      client: availableClient,
    })).resolves.toMatchObject({
      applies: true,
      used: 0,
      remaining: 1,
      reason: 'available',
    });

    const completedClient = createQuotaQueryClient({
      analysis_reserved_at: now.toISOString(),
      analysis_completed_at: now.toISOString(),
    });
    await expect(loadSelfServiceTrialAIQuotaSnapshot({
      enabled: true,
      orgId,
      orgStatus: 'trialing',
      client: completedClient,
    })).resolves.toMatchObject({
      applies: true,
      used: 1,
      remaining: 0,
      reason: 'limit_reached',
    });
  });

  it('does not keep the trial limit after conversion to an active paid plan', async () => {
    const client = createQuotaQueryClient({
      analysis_reserved_at: now.toISOString(),
      analysis_completed_at: now.toISOString(),
    });

    await expect(loadSelfServiceTrialAIQuotaSnapshot({
      enabled: true,
      orgId,
      orgStatus: 'active',
      client,
    })).resolves.toMatchObject({ applies: false, reason: 'paid_plan' });
  });
});

function createQuotaQueryClient(data: Record<string, unknown> | null) {
  const result = Promise.resolve({ data, error: null });
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => result),
  };
  return { from: vi.fn(() => builder) };
}
