import { NextResponse } from 'next/server';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';

interface ReconcileMismatch {
  id: string;
  period: string;
  expectedReturns: number;
  actualReturns: number;
  expectedRefundAmount: number;
  actualRefundAmount: number;
  returnsMismatch: boolean;
  amountMismatch: boolean;
}

function normalizeEnvValue(value: string | undefined): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (!normalized) return defaultValue;
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return defaultValue;
}

function parseExcelDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  if (serial < 1 || serial > 100000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 24 * 60 * 60 * 1000);
}

function extractYearMonthFromRaw(raw: string): string | null {
  const match = raw.match(/(\d{4})\D+(\d{1,2})/);
  if (!match) return null;

  const year = match[1];
  const monthNum = Number(match[2]);
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;

  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

function toYearMonth(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const excelDate = parseExcelDate(Number(raw));
    if (excelDate && !Number.isNaN(excelDate.getTime())) {
      const year = excelDate.getUTCFullYear();
      const month = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  }

  const rawYearMonth = extractYearMonthFromRaw(raw);
  if (rawYearMonth) return rawYearMonth;

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
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

function parseRequestedPeriods(url: string): Set<string> {
  const { searchParams } = new URL(url);
  const raw = searchParams.get('period') || '';
  const periods = raw
    .split(',')
    .map((period) => period.trim())
    .filter((period) => /^\d{4}-\d{2}$/.test(period));
  return new Set(periods);
}

function shouldAutoFix(url: string): boolean {
  const { searchParams } = new URL(url);
  const fromQuery = searchParams.get('apply');
  if (fromQuery !== null) {
    return parseBool(fromQuery, false);
  }
  return parseBool(process.env.RECONCILE_CRON_AUTO_FIX, true);
}

async function reconcileReports(url: string): Promise<{
  checkedPeriods: number;
  mismatchCount: number;
  mismatches: ReconcileMismatch[];
  appliedCount: number;
  applyErrors: Array<{ id: string; period: string; error: string }>;
}> {
  const periodFilter = parseRequestedPeriods(url);
  const apply = shouldAutoFix(url);
  const compareAmount = parseBool(process.env.RECONCILE_COMPARE_AMOUNT, true);
  const supabase = createUntypedAdminClient();

  const [{ data: returnRequests, error: rrError }, { data: shopeeReturns, error: srError }, { data: reports, error: reportsError }] =
    await Promise.all([
      supabase.from('return_requests').select('created_at, refund_amount'),
      supabase.from('shopee_returns').select('order_date, refund_amount, total_price'),
      supabase
        .from('ai_analysis_reports')
        .select('id, report_period, total_returns, total_refund_amount, created_at')
        .order('created_at', { ascending: false }),
    ]);

  if (rrError || srError || reportsError) {
    throw new Error(rrError?.message || srError?.message || reportsError?.message || 'Failed to query tables');
  }

  const totalsByPeriod = new Map<string, { totalReturns: number; totalRefundAmount: number }>();

  for (const row of returnRequests || []) {
    const period = toYearMonth((row as { created_at?: unknown }).created_at);
    if (!period) continue;
    const current = totalsByPeriod.get(period) || { totalReturns: 0, totalRefundAmount: 0 };
    const refund = toFiniteNumber((row as { refund_amount?: unknown }).refund_amount) ?? 0;
    totalsByPeriod.set(period, {
      totalReturns: current.totalReturns + 1,
      totalRefundAmount: roundCurrency(current.totalRefundAmount + refund),
    });
  }

  for (const row of shopeeReturns || []) {
    const period = toYearMonth((row as { order_date?: unknown }).order_date);
    if (!period) continue;
    const current = totalsByPeriod.get(period) || { totalReturns: 0, totalRefundAmount: 0 };
    const refund =
      toFiniteNumber((row as { refund_amount?: unknown }).refund_amount)
      ?? toFiniteNumber((row as { total_price?: unknown }).total_price)
      ?? 0;
    totalsByPeriod.set(period, {
      totalReturns: current.totalReturns + 1,
      totalRefundAmount: roundCurrency(current.totalRefundAmount + refund),
    });
  }

  const latestByPeriod = new Map<string, { id: string; report_period: string; total_returns: unknown; total_refund_amount: unknown }>();
  for (const row of reports || []) {
    const report = row as { id: string; report_period: string; total_returns: unknown; total_refund_amount: unknown };
    if (!latestByPeriod.has(report.report_period)) {
      latestByPeriod.set(report.report_period, report);
    }
  }

  const reportRows = [...latestByPeriod.values()]
    .filter((row) => periodFilter.size === 0 || periodFilter.has(row.report_period))
    .sort((a, b) => a.report_period.localeCompare(b.report_period));

  const mismatches: ReconcileMismatch[] = [];
  for (const row of reportRows) {
    const expected = totalsByPeriod.get(row.report_period) || { totalReturns: 0, totalRefundAmount: 0 };
    const actualReturns = toFiniteNumber(row.total_returns) ?? 0;
    const actualRefundAmount = roundCurrency(toFiniteNumber(row.total_refund_amount) ?? 0);

    const returnsMismatch = actualReturns !== expected.totalReturns;
    const amountMismatch = compareAmount && !amountsMatch(actualRefundAmount, expected.totalRefundAmount);
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

  const applyErrors: Array<{ id: string; period: string; error: string }> = [];
  let appliedCount = 0;
  if (apply) {
    for (const mismatch of mismatches) {
      const { error } = await supabase
        .from('ai_analysis_reports')
        .update({
          total_returns: mismatch.expectedReturns,
          total_refund_amount: mismatch.expectedRefundAmount,
        })
        .eq('id', mismatch.id);

      if (error) {
        applyErrors.push({ id: mismatch.id, period: mismatch.period, error: error.message });
      } else {
        appliedCount += 1;
      }
    }
  }

  return {
    checkedPeriods: reportRows.length,
    mismatchCount: mismatches.length,
    mismatches,
    appliedCount,
    applyErrors,
  };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (isProduction && !cronSecret) {
      console.error('CRON_SECRET is not configured in production environment');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!cronSecret && !isProduction) {
      console.warn('CRON_SECRET not set - allowing request in development mode');
    }

    const result = await reconcileReports(request.url);

    if (result.mismatchCount > 0) {
      await emitSchemaDriftAlert({
        source: 'cron.reconcile-ai-reports',
        table: 'ai_analysis_reports',
        column: 'total_returns,total_refund_amount',
        errorMessage: `Detected ${result.mismatchCount} mismatch period(s), auto-fixed ${result.appliedCount}.`,
        context: {
          mismatches: result.mismatches.slice(0, 20),
          applyErrors: result.applyErrors,
        },
      });
    }

    if (result.applyErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reconcile completed with apply errors',
          data: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cron reconcile error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

