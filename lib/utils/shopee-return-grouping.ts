import type { ColorTag, ShopeeReturn } from '@/lib/actions/shopee-returns.actions';

export interface ShopeeReturnGroup {
  groupKey: string;
  primaryId: string;
  orderNumber: string;
  platform: ShopeeReturn['platform'];
  trackingNumber: string | null;
  shippingMethod: string | null;
  orderDate: string | null;
  disputeDeadline: string | null;
  processedAt: string | null;
  scannedAt: string | null;
  inboundAt: string | null;
  isProcessed: boolean;
  isPrinted: boolean;
  isScanned: boolean;
  isInbound: boolean;
  colorTag: ColorTag;
  note: string;
  hasMixedNotes: boolean;
  itemIds: string[];
  items: ShopeeReturn[];
  totalRefundAmount: number;
  totalReturnQuantity: number;
}

function pickSharedString(
  items: ShopeeReturn[],
  getter: (item: ShopeeReturn) => string | null | undefined,
  fallback: string | null = null
): string | null {
  const values = items.map((item) => getter(item) || null);
  const firstValue = values[0] || null;
  return values.every((value) => value === firstValue) ? firstValue : fallback;
}

function pickColorTag(items: ShopeeReturn[]): ColorTag {
  const firstValue = items[0].color_tag || null;
  if (items.every((item) => (item.color_tag || null) === firstValue)) {
    return firstValue;
  }
  return items.find((item) => item.color_tag)?.color_tag || null;
}

export function getShopeeReturnGroupKey(record: Pick<ShopeeReturn, 'order_number' | 'platform'>): string {
  return `${record.platform || 'unknown'}::${record.order_number}`;
}

export function buildShopeeReturnGroups(records: ShopeeReturn[]): ShopeeReturnGroup[] {
  const groups = new Map<string, ShopeeReturn[]>();

  records.forEach((record) => {
    const groupKey = getShopeeReturnGroupKey(record);
    const current = groups.get(groupKey);
    if (current) {
      current.push(record);
      return;
    }
    groups.set(groupKey, [record]);
  });

  return [...groups.entries()].map(([groupKey, items]) => {
    const primary = items[0];
    const note = pickSharedString(items, (item) => item.note, '') || '';

    return {
      groupKey,
      primaryId: primary.id,
      orderNumber: primary.order_number,
      platform: primary.platform,
      trackingNumber: pickSharedString(items, (item) => item.tracking_number, primary.tracking_number),
      shippingMethod: pickSharedString(items, (item) => item.shipping_method, primary.shipping_method),
      orderDate: pickSharedString(items, (item) => item.order_date, primary.order_date),
      disputeDeadline: pickSharedString(items, (item) => item.dispute_deadline, primary.dispute_deadline),
      processedAt: pickSharedString(items, (item) => item.processed_at),
      scannedAt: pickSharedString(items, (item) => item.scanned_at),
      inboundAt: pickSharedString(items, (item) => item.inbound_at || null),
      isProcessed: items.every((item) => item.is_processed),
      isPrinted: items.every((item) => item.is_printed),
      isScanned: items.every((item) => item.is_scanned),
      isInbound: items.every((item) => !!item.is_inbound),
      colorTag: pickColorTag(items),
      note,
      hasMixedNotes: items.some((item) => (item.note || '') !== note),
      itemIds: items.map((item) => item.id),
      items,
      totalRefundAmount: items.reduce((sum, item) => sum + (item.refund_amount || 0), 0),
      totalReturnQuantity: items.reduce((sum, item) => sum + (item.return_quantity || 0), 0),
    };
  });
}
