import { describe, expect, it } from 'vitest';

import type { ShopeeReturn } from '@/lib/actions/shopee-returns.actions';
import { buildShopeeReturnGroups, getShopeeReturnGroupKey } from '@/lib/utils/shopee-return-grouping';

function buildReturn(overrides: Partial<ShopeeReturn>): ShopeeReturn {
  return {
    id: overrides.id || 'row-1',
    order_number: overrides.order_number || '260323VDF3DJ62',
    tracking_number: overrides.tracking_number ?? 'TW2679258346822',
    order_date: overrides.order_date ?? '2026-03-23',
    total_price: overrides.total_price ?? 0,
    product_name: overrides.product_name ?? 'Product A',
    option_name: overrides.option_name ?? 'Option A',
    activity_price: overrides.activity_price ?? 0,
    option_sku: overrides.option_sku ?? 'CY139-A',
    return_quantity: overrides.return_quantity ?? 1,
    dispute_deadline: overrides.dispute_deadline ?? '2026-03-31',
    refund_amount: overrides.refund_amount ?? 100,
    return_reason: overrides.return_reason ?? '不符合需求',
    buyer_note: overrides.buyer_note ?? null,
    shipping_method: overrides.shipping_method ?? '蝦皮店到店退貨',
    return_reason_note: overrides.return_reason_note ?? null,
    is_processed: overrides.is_processed ?? false,
    is_printed: overrides.is_printed ?? false,
    is_scanned: overrides.is_scanned ?? false,
    scanned_at: overrides.scanned_at ?? null,
    is_inbound: overrides.is_inbound ?? false,
    inbound_at: overrides.inbound_at ?? null,
    processed_at: overrides.processed_at ?? null,
    note: overrides.note ?? null,
    platform: overrides.platform ?? 'shopee',
    color_tag: overrides.color_tag ?? null,
    imported_at: overrides.imported_at ?? '2026-03-23T10:00:00.000Z',
    created_at: overrides.created_at ?? '2026-03-23T10:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-03-23T10:00:00.000Z',
  };
}

describe('shopee return grouping', () => {
  it('groups rows by platform and order number', () => {
    const groups = buildShopeeReturnGroups([
      buildReturn({ id: 'row-1', option_sku: 'CY139-A', refund_amount: 100, return_quantity: 2 }),
      buildReturn({ id: 'row-2', option_sku: 'CY139-B', refund_amount: 50, return_quantity: 1 }),
      buildReturn({
        id: 'row-3',
        order_number: '260323OTHER001',
        option_sku: 'CY147-A',
        refund_amount: 80,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.orderNumber).toBe('260323VDF3DJ62');
    expect(groups[0]?.itemIds).toEqual(['row-1', 'row-2']);
    expect(groups[0]?.totalRefundAmount).toBe(150);
    expect(groups[0]?.totalReturnQuantity).toBe(3);
  });

  it('keeps the same order separated across different platforms', () => {
    const groups = buildShopeeReturnGroups([
      buildReturn({ id: 'row-1', platform: 'shopee' }),
      buildReturn({ id: 'row-2', platform: 'mall' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(getShopeeReturnGroupKey(buildReturn({ platform: 'shopee' }))).not.toBe(
      getShopeeReturnGroupKey(buildReturn({ platform: 'mall' }))
    );
  });

  it('only marks the order as complete when every row is complete', () => {
    const groups = buildShopeeReturnGroups([
      buildReturn({ id: 'row-1', is_processed: true, is_scanned: true, is_printed: true, is_inbound: true }),
      buildReturn({ id: 'row-2', is_processed: false, is_scanned: true, is_printed: true, is_inbound: true }),
    ]);

    expect(groups[0]?.isProcessed).toBe(false);
    expect(groups[0]?.isScanned).toBe(true);
    expect(groups[0]?.isPrinted).toBe(true);
    expect(groups[0]?.isInbound).toBe(true);
  });
});
