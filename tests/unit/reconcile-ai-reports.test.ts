import { describe, expect, it } from 'vitest';
import { buildReconcileMismatches } from '@/lib/maintenance/reconcile-ai-reports';

describe('buildReconcileMismatches', () => {
  it('detects mismatch when report totals do not match source data', () => {
    const summary = buildReconcileMismatches({
      returnRequests: [
        { created_at: '2026-01-03', refund_amount: 1000 },
        { created_at: '2026-01-05', refund_amount: 2000 },
      ],
      shopeeReturns: [
        { order_date: '2025-12-08', dispute_deadline: '2026-01-08', refund_amount: 500, total_price: 0 },
      ],
      reports: [
        {
          id: 'rpt-1',
          report_period: '2026-01',
          total_returns: 1,
          total_refund_amount: 0,
          created_at: '2026-01-31T00:00:00.000Z',
        },
      ],
      compareAmount: true,
      periodFilter: new Set(['2026-01']),
    });

    expect(summary.checkedPeriods).toBe(1);
    expect(summary.mismatches).toHaveLength(1);
    expect(summary.mismatches[0]).toMatchObject({
      period: '2026-01',
      expectedReturns: 2,
      actualReturns: 1,
      expectedRefundAmount: 3000,
      actualRefundAmount: 0,
      returnsMismatch: true,
      amountMismatch: true,
    });
  });

  it('counts Shopee returns by customer order period instead of dispute deadline period', () => {
    const summary = buildReconcileMismatches({
      returnRequests: [],
      shopeeReturns: [
        {
          order_date: '2026-01-10',
          dispute_deadline: '2026-04-18',
          refund_amount: 100,
          total_price: 0,
        },
      ],
      reports: [
        {
          id: 'jan-report',
          report_period: '2026-01',
          total_returns: 1,
          total_refund_amount: 100,
          created_at: '2026-01-31T00:00:00.000Z',
        },
      ],
      compareAmount: true,
      periodFilter: new Set(['2026-01']),
    });

    expect(summary.mismatches).toHaveLength(0);
  });

  it('uses latest report for each period and ignores old duplicates', () => {
    const summary = buildReconcileMismatches({
      returnRequests: [{ created_at: '2026-02-01', refund_amount: 100 }],
      shopeeReturns: [],
      reports: [
        {
          id: 'latest',
          report_period: '2026-02',
          total_returns: 1,
          total_refund_amount: 100,
          created_at: '2026-02-05T00:00:00.000Z',
        },
        {
          id: 'older',
          report_period: '2026-02',
          total_returns: 99,
          total_refund_amount: 9999,
          created_at: '2026-02-01T00:00:00.000Z',
        },
      ],
      compareAmount: true,
      periodFilter: new Set(),
    });

    expect(summary.mismatches).toHaveLength(0);
  });
});
