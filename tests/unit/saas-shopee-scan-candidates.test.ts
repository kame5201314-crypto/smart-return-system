import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock, getOrgContextMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
  getOrgContextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

vi.mock('@/lib/saas/org-context', () => ({
  getOrgContext: getOrgContextMock,
}));

import { searchShopeeReturnScanCandidates } from '@/lib/actions/shopee-returns.actions';

interface Row {
  id: string;
  order_number: string;
  tracking_number: string | null;
  platform: 'shopee' | 'mall' | 'other' | null;
  is_scanned: boolean;
}

function row(id: string, order: string, tracking: string | null = null): Row {
  return { id, order_number: order, tracking_number: tracking, platform: 'shopee', is_scanned: false };
}

/**
 * Records every filter the action builds and resolves each query from a small
 * fixture so we can assert that user input is only ever passed as a
 * parameterized `.eq()` / `.ilike()` value — never concatenated into a `.or()`
 * PostgREST filter expression.
 */
function buildClient(fixtures: {
  exact?: Record<string, Row[]>;
  like?: Record<string, Row[]>;
} = {}) {
  const eqCalls: Array<[string, unknown]> = [];
  const ilikeCalls: Array<[string, string]> = [];
  const orCalls: string[] = [];

  function makeBuilder() {
    const eqFilters: Array<[string, unknown]> = [];
    const ilikeFilters: Array<[string, string]> = [];

    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn((col: string, val: unknown) => {
        eqFilters.push([col, val]);
        eqCalls.push([col, val]);
        return builder;
      }),
      ilike: vi.fn((col: string, val: string) => {
        ilikeFilters.push([col, val]);
        ilikeCalls.push([col, val]);
        return builder;
      }),
      or: vi.fn((expr: string) => {
        orCalls.push(expr);
        return builder;
      }),
      limit: vi.fn(() => {
        const ilikeFilter = ilikeFilters[0];
        if (ilikeFilter) {
          return Promise.resolve({ data: fixtures.like?.[ilikeFilter[0]] ?? [], error: null });
        }
        const exactFilter = eqFilters.find(
          ([col]) => col === 'order_number_norm' || col === 'tracking_number_norm'
        );
        if (exactFilter) {
          return Promise.resolve({
            data: fixtures.exact?.[`${exactFilter[0]}:${String(exactFilter[1])}`] ?? [],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      }),
    };
    return builder;
  }

  return {
    client: { from: vi.fn(() => makeBuilder()) },
    eqCalls,
    ilikeCalls,
    orCalls,
  };
}

describe('searchShopeeReturnScanCandidates (.or injection hardening)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgContextMock.mockResolvedValue({
      userId: 'user-1',
      orgId: 'org-1',
      orgName: 'Test Org',
      orgSlug: 'test-org',
      orgStatus: 'trialing',
      role: 'owner',
      plan: 'growth',
      planDefinition: {},
      featureFlags: {},
      isPlatformAdmin: false,
    });
  });

  it('resolves exact matches via two parameterized .eq() queries, never .or()', async () => {
    const hit = row('row-1', '260130D0X7N6FH', 'TW2631984572320');
    const mock = buildClient({ exact: { 'order_number_norm:260130D0X7N6FH': [hit] } });
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await searchShopeeReturnScanCandidates('260130D0X7N6FH');

    expect(result.success).toBe(true);
    expect(result.data?.map((r) => r.id)).toEqual(['row-1']);
    // org scope + both normalized columns queried as bound values
    expect(mock.eqCalls).toContainEqual(['org_id', 'org-1']);
    expect(mock.eqCalls).toContainEqual(['order_number_norm', '260130D0X7N6FH']);
    expect(mock.eqCalls).toContainEqual(['tracking_number_norm', '260130D0X7N6FH']);
    expect(mock.orCalls).toHaveLength(0);
  });

  it('escapes LIKE wildcards in the partial-match fallback', async () => {
    const mock = buildClient({ like: { order_number: [], tracking_number: [] } });
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await searchShopeeReturnScanCandidates('a_b%c');

    expect(result.success).toBe(true);
    // `_` and `%` are escaped so they are matched literally, not as wildcards
    expect(mock.ilikeCalls).toContainEqual(['order_number', '%a\\_b\\%c%']);
    expect(mock.ilikeCalls).toContainEqual(['tracking_number', '%a\\_b\\%c%']);
    expect(mock.orCalls).toHaveLength(0);
  });

  it('passes a PostgREST injection payload as a literal ilike value, not a filter', async () => {
    const mock = buildClient({ like: { order_number: [], tracking_number: [] } });
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const payload = 'x,is_scanned.eq.true)';
    const result = await searchShopeeReturnScanCandidates(payload);

    expect(result.success).toBe(true);
    // The whole payload (including `,` and `)`) stays inside a single bound
    // ilike value; `_` is escaped. It never becomes a `.or()` expression.
    expect(mock.ilikeCalls).toContainEqual(['order_number', '%x,is\\_scanned.eq.true)%']);
    expect(mock.orCalls).toHaveLength(0);
  });

  it('deduplicates candidates by id across order and tracking matches', async () => {
    const shared = row('row-1', 'DUP1', 'TWDUP1');
    const extra = row('row-2', 'DUP1', 'TWDUP1');
    const mock = buildClient({
      exact: {
        'order_number_norm:DUP1': [shared],
        'tracking_number_norm:DUP1': [shared, extra],
      },
    });
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await searchShopeeReturnScanCandidates('DUP1');

    expect(result.success).toBe(true);
    expect(result.data?.map((r) => r.id)).toEqual(['row-1', 'row-2']);
  });

  it('returns an empty list for blank keywords without touching the database', async () => {
    const mock = buildClient();
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await searchShopeeReturnScanCandidates('   ');

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(mock.client.from).not.toHaveBeenCalled();
  });
});
