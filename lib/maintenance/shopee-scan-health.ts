import type { SupabaseClient } from '@supabase/supabase-js';

interface QueryError {
  message?: string | null;
}

interface CountQueryResult {
  count?: number | null;
  error?: QueryError | null;
}

interface RowsQueryResult<T> {
  data?: T[] | null;
  error?: QueryError | null;
}

interface StaleUnmatchedRow {
  id: string;
  sample_scanned_code: string;
  normalized_code: string;
  last_seen_at: string;
  hit_count: number;
}

export interface ShopeeScanHealthSnapshot {
  metricDate: string;
  periodStart: string;
  periodEnd: string;
  staleBefore: string;
  kpi: {
    totalScans: number;
    matchedScans: number;
    unmatchedScans: number;
    duplicateScans: number;
    unmatchedRate: number;
    duplicateRate: number;
  };
  state: {
    totalRows: number;
    scannedRows: number;
    inboundRows: number;
    notInboundRows: number;
    staleUnmatchedOpenCount: number;
  };
  smoke: {
    passed: boolean;
    errors: string[];
    warnings: string[];
    checks: {
      scanTimestampMismatchCount: number;
      inboundTimestampMismatchCount: number;
      inboundTimestampMissingCount: number;
      inboundWithoutScanCount: number;
      scanOnlyRowsCount: number;
    };
  };
  staleUnmatchedOpenRows: StaleUnmatchedRow[];
}

function toCount(value: number | null | undefined): number {
  if (!Number.isFinite(value || 0)) return 0;
  return Number(value || 0);
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function ensureNoError(error: QueryError | null | undefined, label: string): void {
  if (!error) return;
  throw new Error(`${label}: ${error.message || 'unknown error'}`);
}

function toCountResult(value: unknown): CountQueryResult {
  return value as CountQueryResult;
}

function toRowsResult<T>(value: unknown): RowsQueryResult<T> {
  return value as RowsQueryResult<T>;
}

function getTaipeiDateRange(now: Date): { metricDate: string; periodStart: string; periodEnd: string } {
  const metricDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const periodStart = new Date(`${metricDate}T00:00:00+08:00`).toISOString();
  const periodEnd = new Date(`${metricDate}T23:59:59.999+08:00`).toISOString();

  return { metricDate, periodStart, periodEnd };
}

export async function collectShopeeScanHealthSnapshot(
  supabase: SupabaseClient,
  options?: {
    now?: Date;
    slaHours?: number;
  }
): Promise<ShopeeScanHealthSnapshot> {
  const now = options?.now || new Date();
  const slaHours = options?.slaHours && options.slaHours > 0 ? options.slaHours : 24;
  const { metricDate, periodStart, periodEnd } = getTaipeiDateRange(now);
  const staleBefore = new Date(now.getTime() - slaHours * 60 * 60 * 1000).toISOString();

  const schemaProbeRaw = await supabase
    .from('shopee_returns')
    .select('id, is_scanned, scanned_at, is_inbound, inbound_at')
    .limit(1);
  const schemaProbeResult = toRowsResult<{ id: string }>(schemaProbeRaw);
  ensureNoError(schemaProbeResult.error, 'schema probe failed');

  const [
    totalScansRaw,
    matchedScansRaw,
    unmatchedScansRaw,
    duplicateScansRaw,
    totalRowsRaw,
    scannedRowsRaw,
    inboundRowsRaw,
    notInboundRowsRaw,
    staleUnmatchedCountRaw,
    staleUnmatchedRowsRaw,
    scanTimestampMismatchRaw,
    inboundTimestampMismatchRaw,
    inboundTimestampMissingRaw,
    inboundWithoutScanRaw,
    scanOnlyRowsRaw,
  ] = await Promise.all([
    supabase
      .from('shopee_scan_events')
      .select('id', { count: 'exact', head: true })
      .gte('scanned_at', periodStart)
      .lte('scanned_at', periodEnd),
    supabase
      .from('shopee_scan_events')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'matched')
      .gte('scanned_at', periodStart)
      .lte('scanned_at', periodEnd),
    supabase
      .from('shopee_scan_events')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'unmatched')
      .gte('scanned_at', periodStart)
      .lte('scanned_at', periodEnd),
    supabase
      .from('shopee_scan_events')
      .select('id', { count: 'exact', head: true })
      .eq('scan_status', 'duplicate')
      .gte('scanned_at', periodStart)
      .lte('scanned_at', periodEnd),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_scanned', true),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_inbound', true),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_inbound', false),
    supabase
      .from('shopee_unmatched_scans')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .lte('last_seen_at', staleBefore),
    supabase
      .from('shopee_unmatched_scans')
      .select('id, sample_scanned_code, normalized_code, last_seen_at, hit_count')
      .eq('status', 'open')
      .lte('last_seen_at', staleBefore)
      .order('last_seen_at', { ascending: true })
      .limit(20),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_scanned', false)
      .not('scanned_at', 'is', null),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_inbound', false)
      .not('inbound_at', 'is', null),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_inbound', true)
      .is('inbound_at', null),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_inbound', true)
      .eq('is_scanned', false),
    supabase
      .from('shopee_returns')
      .select('id', { count: 'exact', head: true })
      .eq('is_scanned', true)
      .eq('is_inbound', false),
  ]);

  const totalScansResult = toCountResult(totalScansRaw);
  const matchedScansResult = toCountResult(matchedScansRaw);
  const unmatchedScansResult = toCountResult(unmatchedScansRaw);
  const duplicateScansResult = toCountResult(duplicateScansRaw);
  const totalRowsResult = toCountResult(totalRowsRaw);
  const scannedRowsResult = toCountResult(scannedRowsRaw);
  const inboundRowsResult = toCountResult(inboundRowsRaw);
  const notInboundRowsResult = toCountResult(notInboundRowsRaw);
  const staleUnmatchedCountResult = toCountResult(staleUnmatchedCountRaw);
  const staleUnmatchedRowsResult = toRowsResult<StaleUnmatchedRow>(staleUnmatchedRowsRaw);
  const scanTimestampMismatchResult = toCountResult(scanTimestampMismatchRaw);
  const inboundTimestampMismatchResult = toCountResult(inboundTimestampMismatchRaw);
  const inboundTimestampMissingResult = toCountResult(inboundTimestampMissingRaw);
  const inboundWithoutScanResult = toCountResult(inboundWithoutScanRaw);
  const scanOnlyRowsResult = toCountResult(scanOnlyRowsRaw);

  ensureNoError(totalScansResult.error, 'load total scans failed');
  ensureNoError(matchedScansResult.error, 'load matched scans failed');
  ensureNoError(unmatchedScansResult.error, 'load unmatched scans failed');
  ensureNoError(duplicateScansResult.error, 'load duplicate scans failed');
  ensureNoError(totalRowsResult.error, 'load total rows failed');
  ensureNoError(scannedRowsResult.error, 'load scanned rows failed');
  ensureNoError(inboundRowsResult.error, 'load inbound rows failed');
  ensureNoError(notInboundRowsResult.error, 'load not inbound rows failed');
  ensureNoError(staleUnmatchedCountResult.error, 'load stale unmatched count failed');
  ensureNoError(staleUnmatchedRowsResult.error, 'load stale unmatched rows failed');
  ensureNoError(scanTimestampMismatchResult.error, 'check scan timestamp mismatch failed');
  ensureNoError(inboundTimestampMismatchResult.error, 'check inbound timestamp mismatch failed');
  ensureNoError(inboundTimestampMissingResult.error, 'check inbound timestamp missing failed');
  ensureNoError(inboundWithoutScanResult.error, 'check inbound without scan failed');
  ensureNoError(scanOnlyRowsResult.error, 'check scan-only rows failed');

  const totalScans = toCount(totalScansResult.count);
  const matchedScans = toCount(matchedScansResult.count);
  const unmatchedScans = toCount(unmatchedScansResult.count);
  const duplicateScans = toCount(duplicateScansResult.count);
  const totalRows = toCount(totalRowsResult.count);
  const scannedRows = toCount(scannedRowsResult.count);
  const inboundRows = toCount(inboundRowsResult.count);
  const notInboundRows = toCount(notInboundRowsResult.count);
  const staleUnmatchedOpenCount = toCount(staleUnmatchedCountResult.count);

  const scanTimestampMismatchCount = toCount(scanTimestampMismatchResult.count);
  const inboundTimestampMismatchCount = toCount(inboundTimestampMismatchResult.count);
  const inboundTimestampMissingCount = toCount(inboundTimestampMissingResult.count);
  const inboundWithoutScanCount = toCount(inboundWithoutScanResult.count);
  const scanOnlyRowsCount = toCount(scanOnlyRowsResult.count);

  const smokeErrors: string[] = [];
  if (scanTimestampMismatchCount > 0) {
    smokeErrors.push(
      `Found ${scanTimestampMismatchCount} rows where is_scanned = false but scanned_at is not null.`
    );
  }
  if (inboundTimestampMismatchCount > 0) {
    smokeErrors.push(
      `Found ${inboundTimestampMismatchCount} rows where is_inbound = false but inbound_at is not null.`
    );
  }
  if (inboundTimestampMissingCount > 0) {
    smokeErrors.push(
      `Found ${inboundTimestampMissingCount} rows where is_inbound = true but inbound_at is null.`
    );
  }

  const smokeWarnings: string[] = [];
  if (inboundWithoutScanCount > 0) {
    smokeWarnings.push(
      `Found ${inboundWithoutScanCount} rows where is_inbound = true but is_scanned = false.`
    );
  }
  if (scannedRows > 0 && scanOnlyRowsCount === 0) {
    smokeWarnings.push(
      'All scanned rows are already inbound; scan-to-inbound transition check may be less observable.'
    );
  }

  const unmatchedRate = totalScans > 0 ? roundPercent((unmatchedScans / totalScans) * 100) : 0;
  const duplicateRate = totalScans > 0 ? roundPercent((duplicateScans / totalScans) * 100) : 0;

  return {
    metricDate,
    periodStart,
    periodEnd,
    staleBefore,
    kpi: {
      totalScans,
      matchedScans,
      unmatchedScans,
      duplicateScans,
      unmatchedRate,
      duplicateRate,
    },
    state: {
      totalRows,
      scannedRows,
      inboundRows,
      notInboundRows,
      staleUnmatchedOpenCount,
    },
    smoke: {
      passed: smokeErrors.length === 0,
      errors: smokeErrors,
      warnings: smokeWarnings,
      checks: {
        scanTimestampMismatchCount,
        inboundTimestampMismatchCount,
        inboundTimestampMissingCount,
        inboundWithoutScanCount,
        scanOnlyRowsCount,
      },
    },
    staleUnmatchedOpenRows: staleUnmatchedRowsResult.data || [],
  };
}
