import { NextResponse } from 'next/server';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import {
  buildReconcileMismatches,
  type AiReportMetricRow,
  type ReturnRequestMetricRow,
  type ShopeeReturnMetricRow,
} from '@/lib/maintenance/reconcile-ai-reports';

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
  mismatches: ReturnType<typeof buildReconcileMismatches>['mismatches'];
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
      supabase
        .from('shopee_returns')
        .select('order_date, dispute_deadline, processed_at, created_at, refund_amount, total_price'),
      supabase
        .from('ai_analysis_reports')
        .select('id, report_period, total_returns, total_refund_amount, created_at')
        .order('created_at', { ascending: false }),
    ]);

  if (rrError || srError || reportsError) {
    throw new Error(rrError?.message || srError?.message || reportsError?.message || 'Failed to query tables');
  }

  const summary = buildReconcileMismatches({
    returnRequests: (returnRequests || []) as ReturnRequestMetricRow[],
    shopeeReturns: (shopeeReturns || []) as ShopeeReturnMetricRow[],
    reports: (reports || []) as AiReportMetricRow[],
    compareAmount,
    periodFilter,
  });

  const applyErrors: Array<{ id: string; period: string; error: string }> = [];
  let appliedCount = 0;
  if (apply) {
    for (const mismatch of summary.mismatches) {
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
    checkedPeriods: summary.checkedPeriods,
    mismatchCount: summary.mismatches.length,
    mismatches: summary.mismatches,
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
