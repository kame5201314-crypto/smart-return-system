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
  importShopeeReturns,
  type ShopeeReturnInput,
} from '@/lib/actions/shopee-returns.actions';

const BUYER_NOTE_SCHEMA_ERROR = {
  code: 'PGRST204',
  message: "Could not find the 'buyer_note' column of 'shopee_returns' in the schema cache",
};

const INPUT: ShopeeReturnInput = {
  orderNumber: 'ORDER-20260728-001',
  trackingNumber: 'TW1234567890',
  orderDate: '2026-07-28',
  totalPrice: 399,
  productName: '測試商品',
  optionName: '黑色',
  activityPrice: 399,
  optionSku: 'SKU-001',
  returnQuantity: 1,
  buyerNote: '買家希望換貨',
};

function createSelectChain(result: {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
}) {
  return {
    eq: vi.fn().mockResolvedValue(result),
  };
}

describe('importShopeeReturns schema compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgContextMock.mockResolvedValue({
      orgId: 'org-schema-compat',
      role: 'owner',
      featureFlags: {},
      plan: 'growth',
    });
  });

  it('imports legacy rows when buyer_note is missing from the schema cache', async () => {
    const selectMock = vi.fn()
      .mockReturnValueOnce(createSelectChain({
        data: null,
        error: BUYER_NOTE_SCHEMA_ERROR,
      }))
      .mockReturnValueOnce(createSelectChain({
        data: [],
        error: null,
      }));
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    createUntypedAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        insert: insertMock,
      }),
    });

    const result = await importShopeeReturns([INPUT]);

    expect(result).toEqual({
      success: true,
      data: {
        imported: 1,
        duplicates: 0,
        updated: 0,
      },
    });
    expect(selectMock).toHaveBeenNthCalledWith(
      1,
      'id, order_number, option_sku, buyer_note'
    );
    expect(selectMock).toHaveBeenNthCalledWith(
      2,
      'id, order_number, option_sku'
    );
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0]?.[0]).toEqual([
      expect.not.objectContaining({
        buyer_note: expect.anything(),
      }),
    ]);
  });

  it('retries the batch without buyer_note when schema drift appears during insert', async () => {
    const selectMock = vi.fn().mockReturnValue(createSelectChain({
      data: [],
      error: null,
    }));
    const insertMock = vi.fn()
      .mockResolvedValueOnce({ error: BUYER_NOTE_SCHEMA_ERROR })
      .mockResolvedValueOnce({ error: null });

    createUntypedAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        insert: insertMock,
      }),
    });

    const result = await importShopeeReturns([INPUT]);

    expect(result.success).toBe(true);
    expect(result.data?.imported).toBe(1);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        buyer_note: '買家希望換貨',
      }),
    ]);
    expect(insertMock.mock.calls[1]?.[0]).toEqual([
      expect.not.objectContaining({
        buyer_note: expect.anything(),
      }),
    ]);
  });

  it('keeps buyer_note when the current schema supports it', async () => {
    const selectMock = vi.fn().mockReturnValue(createSelectChain({
      data: [],
      error: null,
    }));
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    createUntypedAdminClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
        insert: insertMock,
      }),
    });

    const result = await importShopeeReturns([INPUT]);

    expect(result.success).toBe(true);
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        buyer_note: '買家希望換貨',
      }),
    ]);
  });
});
