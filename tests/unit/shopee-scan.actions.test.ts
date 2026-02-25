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

function buildMockClient(rows: MockRow[], updateError: { message: string } | null = null) {
  const selectMock = vi.fn().mockResolvedValue({
    data: rows,
    error: null,
  });

  const inMock = vi.fn().mockResolvedValue({
    error: updateError,
  });

  const updateMock = vi.fn().mockReturnValue({
    in: inMock,
  });

  const fromMock = vi.fn().mockImplementation(() => ({
    select: selectMock,
    update: updateMock,
  }));

  return {
    client: {
      from: fromMock,
    },
    fromMock,
    selectMock,
    updateMock,
    inMock,
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
    expect(result.data?.alreadyScanned).toBe(false);
    expect(result.data?.matchedCount).toBe(2);
    expect(result.data?.updatedCount).toBe(2);
    expect(result.data?.matched.order_number).toBe('260130D0X7N6FH');
    expect(result.data?.matched.platform).toBe('mall');

    expect(mock.updateMock).toHaveBeenCalledTimes(1);
    expect(mock.inMock).toHaveBeenCalledWith('id', ['row-1', 'row-2']);
    expect(mock.updateMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        is_scanned: true,
        scanned_at: expect.any(String),
        updated_at: expect.any(String),
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
    expect(result.data?.alreadyScanned).toBe(true);
    expect(result.data?.matchedCount).toBe(2);
    expect(result.data?.updatedCount).toBe(0);
    expect(mock.updateMock).not.toHaveBeenCalled();
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
  });
});
