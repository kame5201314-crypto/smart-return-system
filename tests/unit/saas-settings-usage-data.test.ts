import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  buildCurrentUsagePeriod,
  buildUsageSettingsViewInput,
  createSettingsUsageDataRepository,
  type SettingsUsageQueryBuilder,
  type SettingsUsageQueryClient,
} from '@/lib/saas/settings-usage-data';
import { buildUsageSettingsView } from '@/lib/saas/ui-backend-contracts';

interface QueryResult {
  data: unknown;
  error: { message?: string } | null;
}

interface TestQueryBuilder extends SettingsUsageQueryBuilder {
  select: Mock<(columns: string) => SettingsUsageQueryBuilder>;
  eq: Mock<(column: string, value: unknown) => SettingsUsageQueryBuilder>;
  gte: Mock<(column: string, value: string) => SettingsUsageQueryBuilder>;
  lt: Mock<(column: string, value: string) => SettingsUsageQueryBuilder>;
  order: Mock<(column: string, options: { ascending: boolean }) => SettingsUsageQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
}

function createChain(data: unknown, error: { message?: string } | null = null): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;
  const result = { data, error };

  chain.select = vi.fn(() => chain) as Mock<(columns: string) => SettingsUsageQueryBuilder>;
  chain.eq = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsUsageQueryBuilder>;
  chain.gte = vi.fn(() => chain) as Mock<(column: string, value: string) => SettingsUsageQueryBuilder>;
  chain.lt = vi.fn(() => chain) as Mock<(column: string, value: string) => SettingsUsageQueryBuilder>;
  chain.order = vi.fn(() => chain) as Mock<(column: string, options: { ascending: boolean }) => SettingsUsageQueryBuilder>;
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = ((onfulfilled, onrejected) =>
    Promise.resolve(result).then(onfulfilled, onrejected)) as SettingsUsageQueryBuilder['then'];

  return chain;
}

describe('SaaS settings usage data repository', () => {
  it('builds usage settings DTO input from org plan, seats, returns, and AI usage', async () => {
    const organizationChain = createChain({
      id: 'org-1',
      plan: 'growth',
    });
    const membersChain = createChain([
      {
        id: 'member-1',
        status: 'active',
      },
      {
        id: 'member-2',
        status: 'disabled',
      },
    ]);
    const invitesChain = createChain([
      {
        id: 'invite-1',
        accepted_at: null,
        expires_at: '2026-05-28T00:00:00.000Z',
      },
      {
        id: 'invite-2',
        accepted_at: '2026-05-19T00:00:00.000Z',
        expires_at: '2026-05-28T00:00:00.000Z',
      },
      {
        id: 'invite-3',
        accepted_at: null,
        expires_at: '2026-05-01T00:00:00.000Z',
      },
    ]);
    const returnsChain = createChain([{ id: 'return-1' }, { id: 'return-2' }]);
    const aiUsageChain = createChain([{ id: 'ai-1' }]);
    const from = vi
      .fn()
      .mockReturnValueOnce(organizationChain)
      .mockReturnValueOnce(membersChain)
      .mockReturnValueOnce(invitesChain)
      .mockReturnValueOnce(returnsChain)
      .mockReturnValueOnce(aiUsageChain);
    const repository = createSettingsUsageDataRepository({ from } as SettingsUsageQueryClient);

    const input = await buildUsageSettingsViewInput(repository, {
      orgId: 'org-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      period: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
    });

    expect(input).toEqual({
      plan: 'growth',
      usage: {
        seatsUsed: 2,
        returnsThisMonth: 2,
        aiUsedThisMonth: 1,
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
    });
    expect(buildUsageSettingsView(input!)).toMatchObject({
      plan: {
        code: 'growth',
      },
      usage: {
        seatsUsed: 2,
      },
    });
    expect(from).toHaveBeenNthCalledWith(1, 'organizations');
    expect(from).toHaveBeenNthCalledWith(2, 'organization_members');
    expect(from).toHaveBeenNthCalledWith(3, 'organization_invites');
    expect(from).toHaveBeenNthCalledWith(4, 'return_requests');
    expect(from).toHaveBeenNthCalledWith(5, 'ai_usage_events');
    expect(returnsChain.gte).toHaveBeenCalledWith('created_at', '2026-05-01T00:00:00.000Z');
    expect(returnsChain.lt).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00.000Z');
    expect(aiUsageChain.eq).toHaveBeenCalledWith('feature', 'return_ai_analysis');
    expect(aiUsageChain.eq).toHaveBeenCalledWith('cached', false);
    expect(aiUsageChain.eq).toHaveBeenCalledWith('success', true);
  });

  it('builds the current UTC month usage period', () => {
    expect(buildCurrentUsagePeriod(new Date('2026-05-21T12:00:00.000Z'))).toEqual({
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
    });
  });

  it('returns null when organization usage plan data is missing', async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(createChain(null))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));
    const repository = createSettingsUsageDataRepository({ from } as SettingsUsageQueryClient);

    await expect(
      buildUsageSettingsViewInput(repository, {
        orgId: 'missing-org',
      })
    ).resolves.toBeNull();
  });

  it('surfaces repository query errors instead of serving partial usage data', async () => {
    const repository = createSettingsUsageDataRepository({
      from: vi.fn(() =>
        createChain(null, {
          message: 'usage query failed',
        })
      ),
    } as SettingsUsageQueryClient);

    await expect(
      repository.getOrganizationPlan({
        orgId: 'org-1',
      })
    ).rejects.toThrow('usage query failed');
  });
});
