import { describe, expect, it, vi } from 'vitest';

import {
  assertSelfServiceTrialReturnCapacity,
  SELF_SERVICE_TRIAL_IMPORT_ROW_LIMIT,
  SELF_SERVICE_TRIAL_RETURN_LIMIT,
} from '@/lib/saas/self-service-trial-return-limits';

function createRepository(input?: { claim?: boolean; used?: number }) {
  return {
    hasSelfServiceTrialClaim: vi.fn().mockResolvedValue(input?.claim ?? true),
    countReturns: vi.fn().mockResolvedValue(input?.used ?? 0),
  };
}

describe('self-service trial return limits', () => {
  it('does not apply to paid workspaces or manually provisioned trials', async () => {
    const paidRepository = createRepository({ used: SELF_SERVICE_TRIAL_RETURN_LIMIT });
    await expect(assertSelfServiceTrialReturnCapacity({
      orgId: 'org-paid',
      orgStatus: 'active',
      additionalReturns: 1,
      repository: paidRepository,
    })).resolves.toBeUndefined();
    expect(paidRepository.hasSelfServiceTrialClaim).not.toHaveBeenCalled();

    const manualTrialRepository = createRepository({ claim: false });
    await expect(assertSelfServiceTrialReturnCapacity({
      orgId: 'org-manual-trial',
      orgStatus: 'trialing',
      additionalReturns: 100,
      repository: manualTrialRepository,
    })).resolves.toBeUndefined();
    expect(manualTrialRepository.countReturns).not.toHaveBeenCalled();
  });

  it('allows the final available return and rejects anything above 50', async () => {
    const repository = createRepository({ used: SELF_SERVICE_TRIAL_RETURN_LIMIT - 1 });

    await expect(assertSelfServiceTrialReturnCapacity({
      orgId: 'org-trial',
      orgStatus: 'trialing',
      additionalReturns: 1,
      repository,
    })).resolves.toBeUndefined();

    await expect(assertSelfServiceTrialReturnCapacity({
      orgId: 'org-trial',
      orgStatus: 'trialing',
      additionalReturns: 2,
      repository,
    })).rejects.toMatchObject({ code: 'trial_return_limit_reached', status: 402 });
  });

  it('rejects an import above 30 source rows before counting returns', async () => {
    const repository = createRepository();

    await expect(assertSelfServiceTrialReturnCapacity({
      orgId: 'org-trial',
      orgStatus: 'trialing',
      additionalReturns: 1,
      importRowCount: SELF_SERVICE_TRIAL_IMPORT_ROW_LIMIT + 1,
      repository,
    })).rejects.toMatchObject({ code: 'trial_import_row_limit_exceeded', status: 400 });
    expect(repository.countReturns).not.toHaveBeenCalled();
  });

  it('fails closed when trial usage cannot be verified', async () => {
    const repository = createRepository();
    repository.countReturns.mockRejectedValue(new Error('database unavailable'));

    await expect(assertSelfServiceTrialReturnCapacity({
      orgId: 'org-trial',
      orgStatus: 'trialing',
      additionalReturns: 1,
      repository,
    })).rejects.toMatchObject({ code: 'trial_return_limit_unavailable', status: 503 });
  });
});
