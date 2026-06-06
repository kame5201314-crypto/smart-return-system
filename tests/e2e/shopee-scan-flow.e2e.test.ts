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

import {
  getShopeeScanDashboard,
  scanShopeeReturn,
  type ShopeeReturn,
  type ShopeeScanEvent,
} from '@/lib/actions/shopee-returns.actions';

interface MockUnmatchedRow {
  id: string;
  normalized_code: string;
  status: 'open' | 'resolved';
}

function normalizeToken(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildShopeeRow(partial: Partial<ShopeeReturn>): ShopeeReturn {
  const now = new Date().toISOString();
  return {
    id: partial.id || 'shopee-1',
    order_number: partial.order_number || '260130D0X7N6FH',
    order_number_norm: partial.order_number_norm || normalizeToken(partial.order_number || '260130D0X7N6FH'),
    tracking_number: partial.tracking_number ?? 'TW2631984572320',
    tracking_number_norm: partial.tracking_number_norm || normalizeToken(partial.tracking_number ?? 'TW2631984572320'),
    order_date: partial.order_date ?? '2026-02-25',
    total_price: partial.total_price ?? 1000,
    product_name: partial.product_name ?? 'Product',
    option_name: partial.option_name ?? 'Option',
    activity_price: partial.activity_price ?? 900,
    option_sku: partial.option_sku ?? 'SKU-1',
    return_quantity: partial.return_quantity ?? 1,
    dispute_deadline: partial.dispute_deadline ?? null,
    refund_amount: partial.refund_amount ?? 900,
    return_reason: partial.return_reason ?? null,
    buyer_note: partial.buyer_note ?? null,
    return_reason_note: partial.return_reason_note ?? null,
    shipping_method: partial.shipping_method ?? null,
    is_processed: partial.is_processed ?? false,
    is_printed: partial.is_printed ?? false,
    is_scanned: partial.is_scanned ?? false,
    scanned_at: partial.scanned_at ?? null,
    is_inbound: partial.is_inbound ?? false,
    inbound_at: partial.inbound_at ?? null,
    processed_at: partial.processed_at ?? null,
    note: partial.note ?? null,
    platform: partial.platform ?? 'mall',
    color_tag: partial.color_tag ?? null,
    imported_at: partial.imported_at ?? now,
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
  };
}

function buildShopeeClient(seedRows: ShopeeReturn[]) {
  const rows = structuredClone(seedRows);
  const events: ShopeeScanEvent[] = [];
  const unmatchedRows: MockUnmatchedRow[] = [];

  const rowMatchesFilter = (row: Record<string, unknown>, field: string, value: string) => {
    if (field === 'org_id') return String(row.org_id || 'org-1') === value;
    return String(row[field] || '') === value;
  };

  const buildThenableQuery = <T extends Record<string, unknown>>(
    sourceRows: T[],
    options: {
      projection?: (row: T) => Record<string, unknown>;
      defaultSort?: (input: T[]) => T[];
    } = {}
  ) => {
    const equals: Array<[string, string]> = [];
    let inFilter: [string, string[]] | null = null;
    let gteFilter: [string, string] | null = null;
    let limitCount: number | null = null;

    const resolveRows = () => {
      let filtered = sourceRows.filter((row) =>
        equals.every(([field, value]) => rowMatchesFilter(row, field, value))
      );

      if (inFilter) {
        const [field, values] = inFilter;
        const tokenSet = new Set(values.map((value) => normalizeToken(value)));
        filtered = filtered.filter((row) => {
          if (field === 'order_number_norm') {
            return tokenSet.has(normalizeToken(String(row.order_number_norm || row.order_number || '')));
          }
          if (field === 'tracking_number_norm') {
            return tokenSet.has(normalizeToken(String(row.tracking_number_norm || row.tracking_number || '')));
          }
          return tokenSet.has(normalizeToken(String(row[field] || '')));
        });
      }

      if (gteFilter) {
        const [field, lowerBound] = gteFilter;
        const lower = new Date(lowerBound).getTime();
        filtered = filtered.filter((row) =>
          Number.isNaN(lower) ? true : new Date(String(row[field] || '')).getTime() >= lower
        );
      }

      filtered = options.defaultSort ? options.defaultSort(filtered) : filtered;
      if (limitCount !== null) filtered = filtered.slice(0, limitCount);
      return options.projection ? filtered.map(options.projection) : filtered;
    };

    const query = {
      eq: vi.fn().mockImplementation((field: string, value: string) => {
        equals.push([field, value]);
        return query;
      }),
      in: vi.fn().mockImplementation((field: string, values: string[]) => {
        inFilter = [field, values];
        return Promise.resolve({ data: resolveRows(), error: null });
      }),
      gte: vi.fn().mockImplementation((field: string, value: string) => {
        gteFilter = [field, value];
        return Promise.resolve({ data: resolveRows(), error: null });
      }),
      order: vi.fn().mockImplementation(() => query),
      limit: vi.fn().mockImplementation((count: number) => {
        limitCount = count;
        return Promise.resolve({ data: resolveRows(), error: null });
      }),
      then: (onFulfilled?: (value: { data: Record<string, unknown>[]; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: resolveRows(), error: null }).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: resolveRows(), error: null }).catch(onRejected),
      finally: (onFinally?: () => void) => Promise.resolve({ data: resolveRows(), error: null }).finally(onFinally),
    };

    return query;
  };

  const returnsSelectMock = vi.fn().mockImplementation(() => buildThenableQuery(rows as unknown as Record<string, unknown>[]));

  const returnsUpdateInMock = vi.fn().mockImplementation((field: string, values: string[]) => {
    if (field !== 'id') {
      return Promise.resolve({ error: { message: `Unexpected field: ${field}` } });
    }

    const idSet = new Set(values);
    const payload = returnsUpdateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    for (const row of rows) {
      if (idSet.has(row.id)) {
        Object.assign(row, payload);
      }
    }
    return Promise.resolve({ error: null });
  });

  const returnsUpdateMock = vi.fn().mockImplementation(() => {
    const query = {} as {
      eq: ReturnType<typeof vi.fn>;
      in: typeof returnsUpdateInMock;
    };
    query.eq = vi.fn().mockImplementation(() => query);
    query.in = returnsUpdateInMock;
    return query;
  });

  const scanEventsSelectMock = vi.fn().mockImplementation((columns: string) => {
    const toNewestFirst = (input: ShopeeScanEvent[]) =>
      [...input].sort(
        (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
      );

    if (columns.includes('scan_status')) {
      return buildThenableQuery(events as unknown as Record<string, unknown>[], {
        projection: (event) => ({
          scan_status: event.scan_status,
          scanned_at: event.scanned_at,
        }),
      });
    }

    return buildThenableQuery(events as unknown as Record<string, unknown>[], {
      defaultSort: (input) => toNewestFirst(input as unknown as ShopeeScanEvent[]) as unknown as Record<string, unknown>[],
      projection: columns.includes('id, scanned_at')
        ? (event) => ({ id: event.id, scanned_at: event.scanned_at })
        : undefined,
    });
  });

  const scanEventsInsertMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(() => {
        const now = new Date().toISOString();
        const event: ShopeeScanEvent = {
          id: `event-${events.length + 1}`,
          scanned_code: String(payload.scanned_code || ''),
          normalized_code: String(payload.normalized_code || ''),
          scan_status: (payload.scan_status as ShopeeScanEvent['scan_status']) || 'error',
          matched_order_id: (payload.matched_order_id as string | null) || null,
          matched_order_number: (payload.matched_order_number as string | null) || null,
          matched_tracking_number: (payload.matched_tracking_number as string | null) || null,
          platform: (payload.platform as ShopeeScanEvent['platform']) || null,
          matched_count: Number(payload.matched_count || 0),
          updated_count: Number(payload.updated_count || 0),
          message: payload.message ? String(payload.message) : null,
          scanned_at: now,
          created_at: now,
        };
        events.push(event);
        return Promise.resolve({ data: event, error: null });
      }),
    }),
  }));

  const unmatchedSelectMock = vi.fn().mockImplementation(
    (_columns: string, options?: { count?: 'exact'; head?: boolean }) => {
      if (options?.head) {
        const equals: Array<[string, string]> = [];
        const query = {
          eq: vi.fn().mockImplementation((field: string, value: string) => {
            equals.push([field, value]);
            return query;
          }),
          then: (onFulfilled?: (value: { data: null; error: null; count: number }) => unknown, onRejected?: (reason: unknown) => unknown) => {
            const count = unmatchedRows.filter((row) =>
              equals.every(([field, value]) => rowMatchesFilter(row as unknown as Record<string, unknown>, field, value))
            ).length;
            return Promise.resolve({ data: null, error: null, count }).then(onFulfilled, onRejected);
          },
        };
        return query;
      }

      return buildThenableQuery(unmatchedRows as unknown as Record<string, unknown>[]);
    }
  );

  const unmatchedUpdateMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
    eq: vi.fn().mockImplementation((fieldA: string, valueA: string) => ({
      eq: vi.fn().mockImplementation((fieldB: string, valueB: string) => ({
        eq: vi.fn().mockImplementation((fieldC: string, valueC: string) => {
        for (const row of unmatchedRows) {
          if (
            rowMatchesFilter(row as unknown as Record<string, unknown>, fieldA, valueA) &&
            rowMatchesFilter(row as unknown as Record<string, unknown>, fieldB, valueB) &&
            rowMatchesFilter(row as unknown as Record<string, unknown>, fieldC, valueC)
          ) {
            Object.assign(row, payload);
          }
        }
        return Promise.resolve({ error: null });
        }),
      })),
    })),
  }));

  const unmatchedInsertMock = vi.fn().mockResolvedValue({ error: null });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'shopee_returns') {
      return {
        select: returnsSelectMock,
        update: returnsUpdateMock,
      };
    }

    if (table === 'shopee_scan_events') {
      return {
        select: scanEventsSelectMock,
        insert: scanEventsInsertMock,
      };
    }

    if (table === 'shopee_unmatched_scans') {
      return {
        select: unmatchedSelectMock,
        update: unmatchedUpdateMock,
        insert: unmatchedInsertMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from: fromMock },
    rows,
    events,
  };
}

describe('Shopee scan e2e flow', () => {
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

  it('scans, updates status, and aggregates dashboard KPI end-to-end', async () => {
    const mock = buildShopeeClient([
      buildShopeeRow({
        id: 'shopee-row-1',
        order_number: '260130D0X7N6FH',
        tracking_number: 'TW2631984572320',
        platform: 'mall',
        is_inbound: false,
      }),
    ]);

    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const firstScan = await scanShopeeReturn('TW2631984572320');
    expect(firstScan.success).toBe(true);
    expect(firstScan.data?.scanStatus).toBe('matched');
    expect(firstScan.data?.alreadyScanned).toBe(false);
    expect(firstScan.data?.updatedCount).toBe(1);
    expect(mock.rows[0]?.is_scanned).toBe(true);
    expect(mock.rows[0]?.is_inbound).toBe(false);

    const dashboardAfterMatch = await getShopeeScanDashboard();
    expect(dashboardAfterMatch.success).toBe(true);
    expect(dashboardAfterMatch.data?.kpi.todayTotalScans).toBe(1);
    expect(dashboardAfterMatch.data?.kpi.todayMatchedScans).toBe(1);
    expect(dashboardAfterMatch.data?.kpi.todayDuplicateScans).toBe(0);
    expect(dashboardAfterMatch.data?.kpi.scannedCompletionRate).toBe(100);

    const secondScan = await scanShopeeReturn('TW2631984572320');
    expect(secondScan.success).toBe(false);
    expect(mock.events.at(-1)?.scan_status).toBe('duplicate');

    const dashboardAfterDuplicate = await getShopeeScanDashboard();
    expect(dashboardAfterDuplicate.success).toBe(true);
    expect(dashboardAfterDuplicate.data?.kpi.todayTotalScans).toBe(2);
    expect(dashboardAfterDuplicate.data?.kpi.todayMatchedScans).toBe(1);
    expect(dashboardAfterDuplicate.data?.kpi.todayDuplicateScans).toBe(1);
    expect(dashboardAfterDuplicate.data?.recentEvents.length).toBeGreaterThanOrEqual(2);
  });
});
