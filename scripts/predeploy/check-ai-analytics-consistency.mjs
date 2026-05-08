#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function normalizeEnvValue(value) {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
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
    toYearMonth(row.dispute_deadline)
    || toYearMonth(row.created_at)
    || toYearMonth(row.processed_at)
    || toYearMonth(row.order_date)
  );
}

function isStrictMode() {
  const explicit = normalizeEnvValue(process.env.CONSISTENCY_CHECK_STRICT);
  if (explicit === '1' || explicit.toLowerCase() === 'true') return true;

  const isVercel = normalizeEnvValue(process.env.VERCEL) === '1';
  const vercelEnv = normalizeEnvValue(process.env.VERCEL_ENV).toLowerCase();
  return isVercel && vercelEnv === 'production';
}

function resolveTargetPeriod() {
  const explicitPeriod = normalizeEnvValue(process.env.CONSISTENCY_CHECK_PERIOD);
  if (/^\d{4}-\d{2}$/.test(explicitPeriod)) {
    return explicitPeriod;
  }

  const now = new Date();
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
  }).format(now);
  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
  }).format(now);
  return `${year}-${month}`;
}

async function main() {
  const strict = isStrictMode();
  const targetPeriod = resolveTargetPeriod();
  const supabaseUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !serviceRoleKey) {
    const message = '[consistency-check] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY';
    if (strict) {
      console.error(`${message} (strict mode: fail)`);
      return 1;
    }
    console.warn(`${message} (non-strict mode: skip)`);
    return 0;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: reports, error: reportsError } = await supabase
    .from('ai_analysis_reports')
    .select('id, report_period, total_returns, created_at')
    .eq('report_period', targetPeriod)
    .order('created_at', { ascending: false })
    .limit(20);

  if (reportsError) {
    console.error(`[consistency-check] Failed to load ai_analysis_reports: ${reportsError.message}`);
    return 1;
  }

  if (!reports || reports.length === 0) {
    console.log(`[consistency-check] No AI report for ${targetPeriod}, skip consistency comparison.`);
    return 0;
  }

  const latestReport = reports[0];
  if (!latestReport?.report_period) {
    console.log(`[consistency-check] Invalid AI report period for ${targetPeriod}, skip.`);
    return 0;
  }

  const { data: returnRequests, error: rrError } = await supabase
    .from('return_requests')
    .select('id, created_at');
  if (rrError) {
    console.error(`[consistency-check] Failed to load return_requests: ${rrError.message}`);
    return 1;
  }

  const { data: shopeeReturns, error: shopeeError } = await supabase
    .from('shopee_returns')
    .select('id, order_date, dispute_deadline, processed_at, created_at');
  if (shopeeError) {
    console.error(`[consistency-check] Failed to load shopee_returns: ${shopeeError.message}`);
    return 1;
  }

  const totalsByPeriod = new Map();

  for (const row of returnRequests || []) {
    const period = toYearMonth(row.created_at);
    if (!period) continue;
    totalsByPeriod.set(period, (totalsByPeriod.get(period) || 0) + 1);
  }

  for (const row of shopeeReturns || []) {
    const period = getShopeeReturnReportPeriod(row);
    if (!period) continue;
    totalsByPeriod.set(period, (totalsByPeriod.get(period) || 0) + 1);
  }

  const expected = totalsByPeriod.get(targetPeriod) || 0;
  const actual = Number(latestReport.total_returns || 0);

  if (actual === expected) {
    console.log(`[consistency-check] PASS (${targetPeriod}) expected=${expected} actual=${actual}`);
    return 0;
  }

  console.error('[consistency-check] MISMATCH detected between analytics and AI report totals:');
  console.error(
    `  - period=${targetPeriod} expected=${expected} actual=${actual} report=${latestReport.id}`
  );

  return strict ? 1 : 0;
}

main()
  .then((exitCode) => {
    if (exitCode && exitCode !== 0) {
      process.exitCode = exitCode;
    }
  })
  .catch((error) => {
    console.error('[consistency-check] Unexpected error:', error);
    process.exitCode = 1;
  });
