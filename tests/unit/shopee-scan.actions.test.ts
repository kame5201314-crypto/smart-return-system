import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

import { scanShopeeReturn } from '@/lib/actions/shopee-returns.actions';

interface MockRow {
  id: string;
  order_number: string;
  tracking_number: string | null;
  is_scanned: boolean;
  scanned_at: string | null;
  platform: 'shopee' | 'mall' | null;
}

interface MockBuildOptions {
  updateError?: { message: string } | null;
  recentScanEvents?: Array<{ id: string; scanned_at: string }>;
  openUnmatchedRows?: Array<{ id: string; hit_count: number }>;
}

function normalizeToken(value: string | null | undefined): string {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function toThenableResult<T>(result: T) {
  return {
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    finally: (onFinally?: () => void) => Promise.resolve(result).finally(onFinally),
  };
}

function buildMockClient(rows: MockRow[], options: MockBuildOptions = {}) {
  const returnsUpdateInMock = vi.fn().mockResolvedValue({
    error: options.updateError || null,
  });
  const returnsUpdateMock = vi.fn().mockReturnValue({
    in: returnsUpdateInMock,
  });

  const returnsSelectInMock = vi.fn().mockImplementation((field: string, values: string[]) => {
    const tokenSet = new Set(values.map((value) => normalizeToken(value)));
    const filtered = rows.filter((row) => {
      const orderToken = normalizeToken(row.order_number);
      const trackingToken = normalizeToken(row.tracking_number);
      if (field === 'order_number_norm') return tokenSet.has(orderToken);
      if (field === 'tracking_number_norm') return tokenSet.has(trackingToken);
      return false;
    });
    return Promise.resolve({
      data: filtered,
      error: null,
    });
  });

  const returnsSelectMock = vi.fn().mockImplementation(() => {
    const fallbackResult = { data: rows, error: null };
    return {
      in: returnsSelectInMock,
      ...toThenableResult(fallbackResult),
    };
  });

  const scanEventsSelectLimitMock = vi.fn().mockResolvedValue({
    data: options.recentScanEvents || [],
    error: null,
  });
  const scanEventsSelectOrderMock = vi.fn().mockReturnValue({
    limit: scanEventsSelectLimitMock,
  });
  const scanEventsSelectEqMock = vi.fn().mockReturnValue({
    order: scanEventsSelectOrderMock,
  });
  const scanEventsSelectMock = vi.fn().mockReturnValue({
    eq: scanEventsSelectEqMock,
  });

  const scanEventsInsertPayloads: Record<string, unknown>[] = [];
  let eventSeq = 1;
  const scanEventsInsertMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    scanEventsInsertPayloads.push(payload);
    return {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: `event-${eventSeq++}`,
            ...payload,
            scanned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    };
  });

  const unmatchedSelectLimitMock = vi.fn().mockResolvedValue({
    data: options.openUnmatchedRows || [],
    error: null,
  });
  const unmatchedSelectSecondEqMock = vi.fn().mockReturnValue({
    limit: unmatchedSelectLimitMock,
  });
  const unmatchedSelectFirstEqMock = vi.fn().mockReturnValue({
    eq: unmatchedSelectSecondEqMock,
  });
  const unmatchedSelectMock = vi.fn().mockReturnValue({
    eq: unmatchedSelectFirstEqMock,
  });

  const unmatchedUpdateSecondEqMock = vi.fn().mockResolvedValue({ error: null });
  const unmatchedUpdateFirstEqMock = vi.fn().mockReturnValue({
    eq: unmatchedUpdateSecondEqMock,
  });
  const unmatchedUpdateMock = vi.fn().mockReturnValue({
    eq: unmatchedUpdateFirstEqMock,
  });
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
    client: {
      from: fromMock,
    },
    returnsUpdateMock,
    returnsUpdateInMock,
    scanEventsInsertMock,
    scanEventsInsertPayloads,
    unmatchedInsertMock,
  };
}

describe('scanShopeeReturn action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches normalized code and marks all unscanned rows of same match', async () => {
    const rows: MockRow[] = [
      {
        id: 'row-1',
        order_number: '260130D0X7N6FH',
        tracking_number: 'TW2631984572320',
        is_scanned: false,
        scanned_at: null,
        platform: 'mall',
      },
      {
        id: 'row-2',
        order_number: '260130D0X7N6FH',
        tracking_number: 'TW2631984572320',
        is_scanned: false,
        scanned_at: null,
        platform: 'mall',
      },
      {
        id: 'row-3',
        order_number: 'OTHER0001',
        tracking_number: 'TW0000000000',
        is_scanned: false,
        scanned_at: null,
        platform: 'shopee',
      },
    ];

    const mock = buildMockClient(rows);
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await scanShopeeReturn('蝦皮訂單編號: 260130D0X7N6FH');

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data?.scanStatus).toBe('matched');
    expect(result.data?.alreadyScanned).toBe(false);
    expect(result.data?.matchedCount).toBe(2);
    expect(result.data?.updatedCount).toBe(2);
    expect(result.data?.matched.order_number).toBe('260130D0X7N6FH');
    expect(result.data?.matched.platform).toBe('mall');

    expect(mock.returnsUpdateMock).toHaveBeenCalledTimes(1);
    expect(mock.returnsUpdateInMock).toHaveBeenCalledWith('id', ['row-1', 'row-2']);
    expect(mock.returnsUpdateMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        is_scanned: true,
        scanned_at: expect.any(String),
        updated_at: expect.any(String),
      })
    );
    const scanUpdatePayload = mock.returnsUpdateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(scanUpdatePayload).not.toHaveProperty('is_inbound');
    expect(scanUpdatePayload).not.toHaveProperty('inbound_at');
    expect(mock.scanEventsInsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        scan_status: 'matched',
        matched_count: 2,
        updated_count: 2,
      })
    );
  });

  it('returns alreadyScanned=true when matched rows are already scanned', async () => {
    const rows: MockRow[] = [
      {
        id: 'row-1',
        order_number: '260130D0X7N6FH',
        tracking_number: 'TW2631984572320',
        is_scanned: true,
        scanned_at: '2026-02-25T10:00:00.000Z',
        platform: 'shopee',
      },
      {
        id: 'row-2',
        order_number: '260130D0X7N6FH',
        tracking_number: 'TW2631984572320',
        is_scanned: true,
        scanned_at: '2026-02-25T10:00:00.000Z',
        platform: 'shopee',
      },
    ];

    const mock = buildMockClient(rows);
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await scanShopeeReturn('260130D0X7N6FH');

    expect(result.success).toBe(true);
    expect(result.data?.scanStatus).toBe('matched');
    expect(result.data?.alreadyScanned).toBe(true);
    expect(result.data?.matchedCount).toBe(2);
    expect(result.data?.updatedCount).toBe(0);
    expect(mock.returnsUpdateMock).not.toHaveBeenCalled();
    expect(mock.scanEventsInsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        scan_status: 'matched',
        matched_count: 2,
        updated_count: 0,
      })
    );
  });

  it('returns tracking-number guidance when scanning TW code with no match', async () => {
    const rows: MockRow[] = [
      {
        id: 'row-1',
        order_number: '260130D0X7N6FH',
        tracking_number: 'TW2631984572320',
        is_scanned: false,
        scanned_at: null,
        platform: 'mall',
      },
    ];

    const mock = buildMockClient(rows);
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await scanShopeeReturn('TW9999999999999');

    expect(result.success).toBe(false);
    expect(result.error).toContain('這是寄件編號');
    expect(mock.unmatchedInsertMock).toHaveBeenCalledTimes(1);
    expect(mock.scanEventsInsertPayloads.at(-1)).toEqual(
      expect.objectContaining({
        scan_status: 'unmatched',
      })
    );
  });
});
