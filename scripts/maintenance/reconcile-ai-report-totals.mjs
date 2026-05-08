#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes('--apply');
  const strict = args.includes('--strict');
  const compareAmount = !args.includes('--skip-amount');

  const periodArg = args.find((arg) => arg.startsWith('--period='));
  const periods = (periodArg ? periodArg.split('=')[1] : '')
    .split(',')
    .map((period) => period.trim())
    .filter((period) => /^\d{4}-\d{2}$/.test(period));

  return {
    apply,
    strict,
    compareAmount,
    periodFilter: new Set(periods),
  };
}

function parseExcelDate(serial) {
  if (!Number.isFinite(serial)) return null;
  if (serial < 1 || serial > 100000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 24 * 60 * 60 * 1000);
}

function extractYearMonthFromRaw(raw) {
  const match = raw.match(/(\d{4})\D+(\d{1,2})/);
  if (!match) return null;

  const year = match[1];
  const monthNum = Number(match[2]);
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;

  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

function toYearMonth(value) {
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

function getShopeeReturnReportPeriod(row) {
  return (
    toYearMonth(row.order_date)
    || toYearMonth(row.dispute_deadline)
    || toYearMonth(row.created_at)
    || toYearMonth(row.processed_at)
  );
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

function amountsMatch(a, b) {
  return Math.abs(a - b) < 0.01;
}

async function main() {
  const args = parseArgs(process.argv);
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '[reconcile-ai-report-totals] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
    return 1;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

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
    console.error('[reconcile-ai-report-totals] Query error:', rrError?.message || srError?.message || reportsError?.message);
    return 1;
  }

  const totalsByPeriod = new Map();
  for (const row of returnRequests || []) {
    const period = toYearMonth(row.created_at);
    if (!period) continue;
    const current = totalsByPeriod.get(period) || { totalReturns: 0, totalRefundAmount: 0 };
    const refund = toFiniteNumber(row.refund_amount) ?? 0;
    totalsByPeriod.set(period, {
      totalReturns: current.totalReturns + 1,
      totalRefundAmount: roundCurrency(current.totalRefundAmount + refund),
    });
  }

  for (const row of shopeeReturns || []) {
    const period = getShopeeReturnReportPeriod(row);
    if (!period) continue;
    const current = totalsByPeriod.get(period) || { totalReturns: 0, totalRefundAmount: 0 };
    const refund =
      toFiniteNumber(row.refund_amount)
      ?? toFiniteNumber(row.total_price)
      ?? 0;
    totalsByPeriod.set(period, {
      totalReturns: current.totalReturns + 1,
      totalRefundAmount: roundCurrency(current.totalRefundAmount + refund),
    });
  }

  const latestReportByPeriod = new Map();
  for (const row of reports || []) {
    if (!latestReportByPeriod.has(row.report_period)) {
      latestReportByPeriod.set(row.report_period, row);
    }
  }

  const reportRows = [...latestReportByPeriod.values()]
    .filter((row) => args.periodFilter.size === 0 || args.periodFilter.has(row.report_period))
    .sort((a, b) => a.report_period.localeCompare(b.report_period));

  const mismatches = [];
  for (const row of reportRows) {
    const expected = totalsByPeriod.get(row.report_period) || { totalReturns: 0, totalRefundAmount: 0 };
    const actualReturns = toFiniteNumber(row.total_returns) ?? 0;
    const actualRefundAmount = roundCurrency(toFiniteNumber(row.total_refund_amount) ?? 0);

    const returnsMismatch = actualReturns !== expected.totalReturns;
    const amountMismatch = args.compareAmount && !amountsMatch(actualRefundAmount, expected.totalRefundAmount);

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

  const applied = [];
  const applyErrors = [];
  if (args.apply) {
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
        continue;
      }

      applied.push({ id: mismatch.id, period: mismatch.period });
    }
  }

  const summary = {
    apply: args.apply,
    strict: args.strict,
    compareAmount: args.compareAmount,
    checkedPeriods: reportRows.length,
    mismatchCount: mismatches.length,
    mismatches,
    appliedCount: applied.length,
    applied,
    applyErrors,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (applyErrors.length > 0) {
    return 1;
  }

  if (args.strict && mismatches.length > 0) {
    return 1;
  }

  return 0;
}

main()
  .then((exitCode) => {
    if (exitCode && exitCode !== 0) {
      process.exitCode = exitCode;
    }
  })
  .catch((error) => {
    console.error('[reconcile-ai-report-totals] Unexpected error:', error);
    process.exitCode = 1;
  });
