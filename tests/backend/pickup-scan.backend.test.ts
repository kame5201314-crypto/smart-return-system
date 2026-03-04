import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

import {
  getRecentScannedPickupRecords,
  scanPickupRecord,
} from '@/lib/actions/pickup.actions';

interface PickupRow {
  id: string;
  process_date: string;
  order_number: string;
  tracking_number: string | null;
  platform: string;
  logistics_provider: string;
  delivery_status: string;
  received_status: string;
  notes: string | null;
  receiver_info: string | null;
  is_printed: boolean;
  is_scanned: boolean;
  scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

function buildMockClient(initialRows: PickupRow[]) {
  const rows = structuredClone(initialRows);

  const selectOrderMock = vi.fn().mockResolvedValue({ data: rows, error: null });
  const recentLimitMock = vi.fn().mockImplementation((limit: number) => Promise.resolve({
    data: rows
      .filter((row) => row.is_scanned)
      .sort((a, b) => (a.scanned_at || '') < (b.scanned_at || '') ? 1 : -1)
      .slice(0, limit),
    error: null,
  }));
  const recentOrderMock = vi.fn().mockReturnValue({
    limit: recentLimitMock,
  });
  const recentEqMock = vi.fn().mockReturnValue({
    order: recentOrderMock,
  });

  const selectMock = vi.fn().mockReturnValue({
    order: selectOrderMock,
    eq: recentEqMock,
  });

  const updateSingleMock = vi.fn().mockImplementation((id: string, payload: Record<string, unknown>) => {
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) {
      return Promise.resolve({ data: null, error: { message: 'not found' } });
    }
    rows[index] = {
      ...rows[index],
      ...payload,
    } as PickupRow;
    return Promise.resolve({
      data: rows[index],
      error: null,
    });
  });

  const updateEqMock = vi.fn().mockImplementation((field: string, id: string) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(() => {
        const payload = updateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
        if (field !== 'id') {
          return Promise.resolve({ data: null, error: { message: 'unexpected field' } });
        }
        return updateSingleMock(id, payload);
      }),
    }),
  }));

  const updateMock = vi.fn().mockReturnValue({
    eq: updateEqMock,
  });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table !== 'pickup_records') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select: selectMock,
      update: updateMock,
    };
  });

  return {
    client: { from: fromMock },
    rows,
    updateMock,
  };
}

describe('pickup backend scan smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('掃描後可更新為已掃描，且可從最近掃描列表讀到', async () => {
    const now = new Date().toISOString();
    const mock = buildMockClient([
      {
        id: 'pickup-1',
        process_date: '2026-03-04',
        order_number: '260130D0X7N6FH',
        tracking_number: '210-372-2821',
        platform: '商城',
        logistics_provider: '新竹物流',
        delivery_status: '派車收件',
        received_status: '未收到',
        notes: null,
        receiver_info: '王小明',
        is_printed: false,
        is_scanned: false,
        scanned_at: null,
        created_at: now,
        updated_at: now,
      },
    ]);
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const scanResult = await scanPickupRecord('2103722821');
    expect(scanResult.success).toBe(true);
    expect(scanResult.data?.alreadyScanned).toBe(false);
    expect(scanResult.data?.matched.is_scanned).toBe(true);
    expect(scanResult.data?.matched.scanned_at).toEqual(expect.any(String));
    expect(mock.updateMock).toHaveBeenCalledTimes(1);

    const recentResult = await getRecentScannedPickupRecords(5);
    expect(recentResult.success).toBe(true);
    expect(recentResult.data).toHaveLength(1);
    expect(recentResult.data?.[0]?.id).toBe('pickup-1');
    expect(recentResult.data?.[0]?.is_scanned).toBe(true);
  });
});
