import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

vi.mock('@/lib/saas/org-context', () => ({
  getOrgContext: vi.fn(async () => ({
    orgId: 'org-pickup-test',
    role: 'admin',
    featureFlags: {},
    plan: 'growth',
  })),
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

function buildBaseRow(partial: Partial<PickupRow>): PickupRow {
  const now = new Date().toISOString();
  return {
    id: partial.id || 'pickup-1',
    process_date: partial.process_date || '2026-03-04',
    order_number: partial.order_number || '260130D0X7N6FH',
    tracking_number: partial.tracking_number ?? '210-372-2821',
    platform: partial.platform || '商城',
    logistics_provider: partial.logistics_provider || '新竹物流',
    delivery_status: partial.delivery_status || '派車收件',
    received_status: partial.received_status || '未收到',
    notes: partial.notes || null,
    receiver_info: partial.receiver_info || '王小明',
    is_printed: partial.is_printed ?? false,
    is_scanned: partial.is_scanned ?? false,
    scanned_at: partial.scanned_at ?? null,
    created_at: partial.created_at || now,
    updated_at: partial.updated_at || now,
  };
}

function mockPickupSelectRows(rows: PickupRow[]) {
  const selectOrderMock = vi.fn().mockResolvedValue({ data: rows, error: null });
  const recentLimitMock = vi.fn().mockResolvedValue({
    data: rows.filter((row) => row.is_scanned),
    error: null,
  });
  const recentOrderMock = vi.fn().mockReturnValue({ limit: recentLimitMock });
  const scanSelectChain = {
    eq: vi.fn(),
    order: selectOrderMock,
  };
  scanSelectChain.eq.mockReturnValue(scanSelectChain);

  const recentSelectChain = {
    eq: vi.fn(),
    order: recentOrderMock,
  };
  recentSelectChain.eq.mockReturnValue(recentSelectChain);

  return vi.fn()
    .mockReturnValueOnce(scanSelectChain)
    .mockReturnValue(recentSelectChain);
}

describe('pickup actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns duplicate status when matched row is already scanned', async () => {
    const row = buildBaseRow({
      is_scanned: true,
      scanned_at: '2026-03-04T10:00:00.000Z',
    });
    const selectMock = mockPickupSelectRows([row]);
    const updateMock = vi.fn();

    createUntypedAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        update: updateMock,
      }),
    });

    const result = await scanPickupRecord('2103722821');

    expect(result.success).toBe(true);
    expect(result.data?.scanStatus).toBe('duplicate');
    expect(result.data?.alreadyScanned).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns unmatched error when no row can be matched', async () => {
    const row = buildBaseRow({
      order_number: '260130ABC123',
      tracking_number: '9074-5843-8256',
    });
    const selectMock = mockPickupSelectRows([row]);

    createUntypedAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        update: vi.fn(),
      }),
    });

    const result = await scanPickupRecord('ZZZ-NOT-FOUND-000');

    expect(result.success).toBe(false);
    expect(result.error).toContain('找不到對應單號');
  });

  it('returns migration hint when scanned columns are missing', async () => {
    const scanSchemaError = {
      message: "Could not find the 'is_scanned' column of 'pickup_records' in the schema cache",
      code: 'PGRST205',
    };

    const selectChain = {
      eq: vi.fn(),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: scanSchemaError,
        }),
      }),
    };
    selectChain.eq.mockReturnValue(selectChain);

    createUntypedAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
      }),
    });

    const result = await getRecentScannedPickupRecords(20);
    expect(result.success).toBe(false);
    expect(result.error).toContain('013_pickup_records_scan_status.sql');
  });
});
