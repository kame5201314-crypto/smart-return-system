import { describe, expect, it, vi } from 'vitest';

import {
  resolveSelfServiceTrialSeatLimit,
  SELF_SERVICE_TRIAL_SEAT_LIMIT,
} from '@/lib/saas/self-service-trial-seat-limit';

describe('self-service trial seat limit', () => {
  it('keeps paid and manually provisioned workspaces on their plan limit', async () => {
    const paidRepository = { hasSelfServiceTrialClaim: vi.fn() };
    await expect(resolveSelfServiceTrialSeatLimit({
      orgId: 'org-paid',
      orgStatus: 'active',
      planSeatLimit: 3,
      repository: paidRepository,
    })).resolves.toEqual({ applies: false, seatLimit: 3 });
    expect(paidRepository.hasSelfServiceTrialClaim).not.toHaveBeenCalled();

    await expect(resolveSelfServiceTrialSeatLimit({
      orgId: 'org-manual',
      orgStatus: 'trialing',
      planSeatLimit: 3,
      repository: { hasSelfServiceTrialClaim: vi.fn(async () => false) },
    })).resolves.toEqual({ applies: false, seatLimit: 3 });
  });

  it('limits an active self-service trial to the owner seat only', async () => {
    await expect(resolveSelfServiceTrialSeatLimit({
      orgId: 'org-trial',
      orgStatus: 'trialing',
      planSeatLimit: 3,
      repository: { hasSelfServiceTrialClaim: vi.fn(async () => true) },
    })).resolves.toEqual({
      applies: true,
      seatLimit: SELF_SERVICE_TRIAL_SEAT_LIMIT,
    });
  });

  it('fails closed when the trial claim cannot be verified', async () => {
    await expect(resolveSelfServiceTrialSeatLimit({
      orgId: 'org-trial',
      orgStatus: 'trialing',
      planSeatLimit: 3,
      repository: {
        hasSelfServiceTrialClaim: vi.fn(async () => {
          throw new Error('database unavailable');
        }),
      },
    })).rejects.toHaveProperty('name', 'SelfServiceTrialSeatLimitError');
  });
});
