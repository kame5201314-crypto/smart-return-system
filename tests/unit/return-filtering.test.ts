import { describe, expect, it } from 'vitest';
import { filterAndSortReturns } from '@/lib/utils/return-filtering';

const STATUS_ORDER = {
  pending_review: 1,
  approved_waiting_shipping: 2,
  shipping_in_transit: 3,
  received_inspecting: 4,
  refund_processing: 5,
  abnormal_disputed: 6,
  completed: 7,
};

const rows = [
  {
    request_number: 'RET-1001',
    status: 'pending_review',
    created_at: '2026-02-01T10:00:00.000Z',
    channel_source: 'official',
    order: {
      customer_name: 'Amy',
      customer_phone: '0912-345-678',
      order_number: 'ORD-AAA',
    },
  },
  {
    request_number: 'RET-1002',
    status: 'completed',
    created_at: '2026-02-03T10:00:00.000Z',
    channel_source: 'shopee',
    order: {
      customer_name: 'Bob',
      customer_phone: '0922-000-111',
      order_number: 'ORD-BBB',
    },
  },
  {
    request_number: 'RET-1003',
    status: 'shipping_in_transit',
    created_at: '2026-02-02T10:00:00.000Z',
    channel_source: 'official',
    order: {
      customer_name: 'Carol',
      customer_phone: '0933-555-666',
      order_number: 'ORD-CCC',
    },
  },
];

describe('filterAndSortReturns', () => {
  it('does not filter by typed keyword before search is applied', () => {
    const result = filterAndSortReturns(rows, {
      appliedSearchQuery: '',
      statusFilter: 'all',
      channelFilter: 'all',
      sortField: 'created_at',
      sortDirection: 'desc',
      statusOrder: STATUS_ORDER,
    });

    expect(result).toHaveLength(3);
    expect(result.map((row) => row.request_number)).toEqual(['RET-1002', 'RET-1003', 'RET-1001']);
  });

  it('filters by applied keyword and phone normalization', () => {
    const resultByName = filterAndSortReturns(rows, {
      appliedSearchQuery: 'amy',
      statusFilter: 'all',
      channelFilter: 'all',
      sortField: 'created_at',
      sortDirection: 'desc',
      statusOrder: STATUS_ORDER,
    });
    expect(resultByName.map((row) => row.request_number)).toEqual(['RET-1001']);

    const resultByPhone = filterAndSortReturns(rows, {
      appliedSearchQuery: '0912345678',
      statusFilter: 'all',
      channelFilter: 'all',
      sortField: 'created_at',
      sortDirection: 'desc',
      statusOrder: STATUS_ORDER,
    });
    expect(resultByPhone.map((row) => row.request_number)).toEqual(['RET-1001']);
  });

  it('supports pending_inspection aggregate status filter', () => {
    const result = filterAndSortReturns(rows, {
      appliedSearchQuery: '',
      statusFilter: 'pending_inspection',
      channelFilter: 'official',
      sortField: 'status',
      sortDirection: 'asc',
      statusOrder: STATUS_ORDER,
    });

    expect(result.map((row) => row.request_number)).toEqual(['RET-1001', 'RET-1003']);
  });
});

