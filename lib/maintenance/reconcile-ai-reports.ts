import { getShopeeReturnReportPeriod, toYearMonth } from '@/lib/utils/return-period';

export { toYearMonth };

export interface ReturnRequestMetricRow {
  created_at: unknown;
  refund_amount?: unknown;
}

export interface ShopeeReturnMetricRow {
  order_date: unknown;
  dispute_deadline?: unknown;
  processed_at?: unknown;
  created_at?: unknown;
  refund_amount?: unknown;
  total_price?: unknown;
}

export interface AiReportMetricRow {
  id: string;
  report_period: string;
  total_returns?: unknown;
  total_refund_amount?: unknown;
  created_at?: unknown;
}

export interface ReconcileMismatch {
  id: string;
  period: string;
  expectedReturns: number;
  actualReturns: number;
  expectedRefundAmount: number;
  actualRefundAmount: number;
  returnsMismatch: boolean;
  amountMismatch: boolean;
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function buildReconcileMismatches(input: {
  returnRequests: ReturnRequestMetricRow[];
  shopeeReturns: ShopeeReturnMetricRow[];
  reports: AiReportMetricRow[];
  compareAmount: boolean;
  periodFilter: Set<string>;
}): {
  checkedPeriods: number;
  mismatches: ReconcileMismatch[];
} {
  const totalsByPeriod = new Map<string, { totalReturns: number; totalRefundAmount: number }>();

  for (const row of input.returnRequests || []) {
    const period = toYearMonth(row.created_at);
    if (!period) continue;
    const current = totalsByPeriod.get(period) || { totalReturns: 0, totalRefundAmount: 0 };
    const refund = toFiniteNumber(row.refund_amount) ?? 0;
    totalsByPeriod.set(period, {
      totalReturns: current.totalReturns + 1,
      totalRefundAmount: roundCurrency(current.totalRefundAmount + refund),
    });
  }

  for (const row of input.shopeeReturns || []) {
    const period = getShopeeReturnReportPeriod(row);
    if (!period) continue;
    const current = totalsByPeriod.get(period) || { totalReturns: 0, totalRefundAmount: 0 };
    const refund = toFiniteNumber(row.refund_amount) ?? toFiniteNumber(row.total_price) ?? 0;
    totalsByPeriod.set(period, {
      totalReturns: current.totalReturns + 1,
      totalRefundAmount: roundCurrency(current.totalRefundAmount + refund),
    });
  }

  const latestByPeriod = new Map<string, AiReportMetricRow>();
  for (const row of input.reports || []) {
    if (!latestByPeriod.has(row.report_period)) {
      latestByPeriod.set(row.report_period, row);
    }
  }

  const reportRows = [...latestByPeriod.values()]
    .filter((row) => input.periodFilter.size === 0 || input.periodFilter.has(row.report_period))
    .sort((a, b) => a.report_period.localeCompare(b.report_period));

  const mismatches: ReconcileMismatch[] = [];
  for (const row of reportRows) {
    const expected = totalsByPeriod.get(row.report_period) || { totalReturns: 0, totalRefundAmount: 0 };
    const actualReturns = toFiniteNumber(row.total_returns) ?? 0;
    const actualRefundAmount = roundCurrency(toFiniteNumber(row.total_refund_amount) ?? 0);

    const returnsMismatch = actualReturns !== expected.totalReturns;
    const amountMismatch = input.compareAmount && !amountsMatch(actualRefundAmount, expected.totalRefundAmount);

    if (returnsMismatch || amountMismatch) {
      mismatches.push({
        id: row.id,
        period: row.report_period,
        expectedReturns: expected.totalReturns,
        actualReturns,
        expectedRefundAmount: expected.totalRefundAmount,
        actualRefundAmount,
        returnsMismatch,
        amountMismatch,
      });
    }
  }

  return {
    checkedPeriods: reportRows.length,
    mismatches,
  };
}
