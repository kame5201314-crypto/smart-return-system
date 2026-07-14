/* @vitest-environment node */

import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  createPlatformAdminDataRepository,
  type PlatformAdminQueryClient,
} from '@/lib/saas/platform-admin-data';

interface QueryResult {
  data: unknown;
  error: { message?: string } | null;
}

interface TestQueryBuilder {
  select: Mock<(columns: string) => TestQueryBuilder>;
  eq: Mock<(column: string, value: unknown) => TestQueryBuilder>;
  in: Mock<(column: string, values: string[]) => TestQueryBuilder>;
  gte: Mock<(column: string, value: string) => TestQueryBuilder>;
  order: Mock<(column: string, options: { ascending: boolean }) => TestQueryBuilder>;
  limit: Mock<(count: number) => TestQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
  then: PromiseLike<QueryResult>['then'];
}

function createChain(data: unknown, error: { message?: string } | null = null): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;
  const result = { data, error };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = ((onfulfilled, onrejected) =>
    Promise.resolve(result).then(onfulfilled, onrejected)) as TestQueryBuilder['then'];

  return chain;
}

describe('SaaS platform admin data repository', () => {
  it('builds usage snapshots from tenant-scoped return and AI usage rows', async () => {
    const returnsChain = createChain([
      { id: 'return-1', org_id: 'org-a', created_at: '2026-06-05T00:00:00.000Z' },
      { id: 'return-2', org_id: 'org-a', created_at: '2026-06-06T00:00:00.000Z' },
      { id: 'return-3', org_id: 'org-b', created_at: '2026-06-07T00:00:00.000Z' },
      { id: 'return-no-org', org_id: null, created_at: '2026-06-08T00:00:00.000Z' },
    ]);
    const aiChain = createChain([
      { id: 'ai-1', org_id: 'org-a', cached: false, success: true, created_at: '2026-06-05T00:00:00.000Z' },
      { id: 'ai-2', org_id: 'org-b', cached: false, success: true, created_at: '2026-06-06T00:00:00.000Z' },
    ]);
    const from = vi.fn()
      .mockReturnValueOnce(returnsChain)
      .mockReturnValueOnce(aiChain);
    const repository = createPlatformAdminDataRepository({ from } as PlatformAdminQueryClient);

    const usage = await repository.listOrganizationUsage({
      orgIds: ['org-a', 'org-b', 'org-c'],
      periodStart: '2026-06-01T00:00:00.000Z',
    });

    expect(usage).toEqual({
      'org-a': {
        returnsThisMonth: 2,
        aiUsedThisMonth: 1,
      },
      'org-b': {
        returnsThisMonth: 1,
        aiUsedThisMonth: 1,
      },
      'org-c': {
        returnsThisMonth: 0,
        aiUsedThisMonth: 0,
      },
    });
    expect(from).toHaveBeenNthCalledWith(1, 'return_requests');
    expect(from).toHaveBeenNthCalledWith(2, 'ai_usage_events');
    expect(returnsChain.in).toHaveBeenCalledWith('org_id', ['org-a', 'org-b', 'org-c']);
    expect(returnsChain.gte).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00.000Z');
    expect(aiChain.in).toHaveBeenCalledWith('org_id', ['org-a', 'org-b', 'org-c']);
    expect(aiChain.gte).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00.000Z');
    expect(aiChain.eq).toHaveBeenCalledWith('cached', false);
    expect(aiChain.eq).toHaveBeenCalledWith('success', true);
  });

  it('does not query usage tables when there are no organization ids', async () => {
    const from = vi.fn();
    const repository = createPlatformAdminDataRepository({ from } as PlatformAdminQueryClient);

    await expect(
      repository.listOrganizationUsage({
        orgIds: [],
        periodStart: '2026-06-01T00:00:00.000Z',
      })
    ).resolves.toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it('loads self-service trial claim state without selecting reservation tokens', async () => {
    const claimsChain = createChain([
      {
        org_id: 'org-a',
        created_at: '2026-07-14T00:00:00.000Z',
        analysis_reserved_at: null,
        analysis_completed_at: '2026-07-14T01:00:00.000Z',
      },
    ]);
    const from = vi.fn(() => claimsChain);
    const repository = createPlatformAdminDataRepository({ from } as PlatformAdminQueryClient);

    await expect(repository.listOrganizationSelfServiceTrialClaims({
      orgIds: ['org-a'],
    })).resolves.toEqual({
      'org-a': {
        orgId: 'org-a',
        createdAt: '2026-07-14T00:00:00.000Z',
        analysisReservedAt: null,
        analysisCompletedAt: '2026-07-14T01:00:00.000Z',
      },
    });

    expect(from).toHaveBeenCalledWith('saas_self_service_trial_claims');
    expect(claimsChain.select).toHaveBeenCalledWith(
      'org_id, created_at, analysis_reserved_at, analysis_completed_at'
    );
    expect(claimsChain.select.mock.calls[0][0]).not.toContain('analysis_reservation_token');
  });
});
