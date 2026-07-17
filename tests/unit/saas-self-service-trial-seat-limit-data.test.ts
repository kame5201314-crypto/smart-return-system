import { describe, expect, it, vi } from 'vitest';

import { createSelfServiceTrialSeatLimitDataRepository } from '@/lib/saas/self-service-trial-seat-limit-data';

function createClient(result: { data: unknown; error: { message?: string } | null }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
    then: undefined,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);

  return {
    client: {
      from: vi.fn(() => chain),
    },
    chain,
  };
}

describe('self-service trial seat-limit data repository', () => {
  it('checks only the authenticated organization claim and returns true', async () => {
    const { client, chain } = createClient({
      data: { org_id: 'org-1' },
      error: null,
    });
    const repository = createSelfServiceTrialSeatLimitDataRepository(client as never);

    await expect(repository.hasSelfServiceTrialClaim('org-1')).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith('saas_self_service_trial_claims');
    expect(chain.select).toHaveBeenCalledWith('org_id');
    expect(chain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(chain.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('returns false when the organization has no self-service claim', async () => {
    const { client } = createClient({ data: null, error: null });
    const repository = createSelfServiceTrialSeatLimitDataRepository(client as never);

    await expect(repository.hasSelfServiceTrialClaim('org-manual')).resolves.toBe(false);
  });

  it('fails closed when the protected claim lookup fails', async () => {
    const { client } = createClient({
      data: null,
      error: { message: 'claim lookup failed' },
    });
    const repository = createSelfServiceTrialSeatLimitDataRepository(client as never);

    await expect(repository.hasSelfServiceTrialClaim('org-1')).rejects.toThrow(
      'claim lookup failed'
    );
  });
});
