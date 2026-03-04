import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

import {
  createPickupRecord,
  getRecentScannedPickupRecords,
  scanPickupRecord,
  type PickupRecord,
} from '@/lib/actions/pickup.actions';

function buildPickupRow(partial: Partial<PickupRecord>): PickupRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id || 'pickup-1',
    process_date: partial.process_date || '2026-03-04',
    order_number: partial.order_number || '260222BCM22EVV',
    tracking_number: partial.tracking_number ?? '210-372-2821',
    platform: partial.platform || 'mall',
    logistics_provider: partial.logistics_provider || 'HCT',
    delivery_status: partial.delivery_status || '待收件',
    received_status: partial.received_status || '未收到',
    notes: partial.notes ?? null,
    receiver_info: partial.receiver_info ?? 'Receiver',
    is_printed: partial.is_printed ?? false,
    is_scanned: partial.is_scanned ?? false,
    scanned_at: partial.scanned_at ?? null,
    created_at: partial.created_at || now,
    updated_at: partial.updated_at || now,
  };
}

function buildPickupClient(seedRows: PickupRecord[]) {
  const rows = structuredClone(seedRows);

  const insertMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(() => {
        const now = new Date().toISOString();
        const newRow = buildPickupRow({
          id: `pickup-${rows.length + 1}`,
          ...(payload as Partial<PickupRecord>),
          created_at: now,
          updated_at: now,
          is_scanned: false,
          scanned_at: null,
          is_printed: false,
        });
        rows.unshift(newRow);
        return Promise.resolve({ data: newRow, error: null });
      }),
    }),
  }));

  const selectOrderMock = vi.fn().mockImplementation(() =>
    Promise.resolve({
      data: [...rows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      error: null,
    })
  );

  const recentLimitMock = vi.fn().mockImplementation((limit: number) =>
    Promise.resolve({
      data: rows
        .filter((row) => row.is_scanned)
        .sort(
          (a, b) =>
            new Date(b.scanned_at || b.updated_at).getTime()
            - new Date(a.scanned_at || a.updated_at).getTime()
        )
        .slice(0, limit),
      error: null,
    })
  );

  const recentOrderMock = vi.fn().mockReturnValue({
    limit: recentLimitMock,
  });

  const selectEqMock = vi.fn().mockReturnValue({
    order: recentOrderMock,
  });

  const selectMock = vi.fn().mockReturnValue({
    order: selectOrderMock,
    eq: selectEqMock,
  });

  const updateMock = vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
    eq: vi.fn().mockImplementation((field: string, id: string) => ({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(() => {
          if (field !== 'id') {
            return Promise.resolve({ data: null, error: { message: `Unexpected field: ${field}` } });
          }
          const row = rows.find((entry) => entry.id === id);
          if (!row) {
            return Promise.resolve({ data: null, error: { message: 'not found' } });
          }
          Object.assign(row, payload);
          return Promise.resolve({ data: row, error: null });
        }),
      }),
    })),
  }));

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table !== 'pickup_records') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      insert: insertMock,
      select: selectMock,
      update: updateMock,
    };
  });

  return {
    client: { from: fromMock },
    rows,
  };
}

describe('Pickup scan e2e flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates record, scans once, then treats same code as duplicate', async () => {
    const mock = buildPickupClient([]);
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const created = await createPickupRecord({
      process_date: '2026-03-04',
      order_number: '260222BCM22EVV',
      tracking_number: '210-372-2821',
      platform: 'mall',
      logistics_provider: 'HCT',
      delivery_status: '待收件',
      received_status: '未收到',
      notes: '',
      receiver_info: 'Receiver A',
    });

    expect(created.success).toBe(true);
    expect(created.data?.is_scanned).toBe(false);

    const firstScan = await scanPickupRecord('2103722821');
    expect(firstScan.success).toBe(true);
    expect(firstScan.data?.scanStatus).toBe('matched');
    expect(firstScan.data?.alreadyScanned).toBe(false);
    expect(firstScan.data?.matched.is_scanned).toBe(true);
    expect(firstScan.data?.matched.received_status).toBe('未收到');

    const duplicateScan = await scanPickupRecord('2103722821');
    expect(duplicateScan.success).toBe(true);
    expect(duplicateScan.data?.scanStatus).toBe('duplicate');
    expect(duplicateScan.data?.alreadyScanned).toBe(true);

    const recent = await getRecentScannedPickupRecords(10);
    expect(recent.success).toBe(true);
    expect(recent.data).toHaveLength(1);
    expect(recent.data?.[0]?.order_number).toBe('260222BCM22EVV');
    expect(recent.data?.[0]?.is_scanned).toBe(true);
    expect(recent.data?.[0]?.received_status).toBe('未收到');
  });
});
