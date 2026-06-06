import { NextResponse } from 'next/server';

import { collectShopeeScanHealthSnapshot } from '@/lib/maintenance/shopee-scan-health';
import {
  buildPlatformMaintenanceCronSkip,
  isPlatformMaintenanceCronEnabled,
} from '@/lib/maintenance/cron-policy';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

function normalizeEnvValue(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parsePositiveInt(value: string | undefined | null, defaultValue: number): number {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isInteger(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function parsePositiveFloat(value: string | undefined | null, defaultValue: number): number {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function isAuthorized(request: Request): { ok: boolean; errorStatus?: number; errorMessage?: string } {
  const cronSecret = normalizeEnvValue(process.env.CRON_SECRET);
  const authHeader = normalizeEnvValue(request.headers.get('authorization'));

  if (isProduction() && !cronSecret) {
    return { ok: false, errorStatus: 500, errorMessage: 'Server configuration error' };
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, errorStatus: 401, errorMessage: 'Unauthorized' };
  }

  return { ok: true };
}

export async function GET(request: Request) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.errorMessage },
      { status: auth.errorStatus || 401 }
    );
  }

  if (!isPlatformMaintenanceCronEnabled()) {
    return NextResponse.json(buildPlatformMaintenanceCronSkip('cron.shopee-scan-daily-report'));
  }

  try {
    const url = new URL(request.url);
    const slaHours = parsePositiveInt(
      url.searchParams.get('slaHours') || process.env.SHOPEE_SCAN_SLA_HOURS,
      24
    );
    const unmatchedRateAlertThreshold = parsePositiveFloat(
      process.env.SHOPEE_SCAN_UNMATCHED_RATE_ALERT_THRESHOLD,
      25
    );
    const duplicateRateAlertThreshold = parsePositiveFloat(
      process.env.SHOPEE_SCAN_DUPLICATE_RATE_ALERT_THRESHOLD,
      35
    );
    const staleUnmatchedAlertThreshold = parsePositiveInt(
      process.env.SHOPEE_SCAN_STALE_UNMATCHED_ALERT_THRESHOLD,
      1
    );

    const supabase = createUntypedAdminClient();
    const snapshot = await collectShopeeScanHealthSnapshot(supabase, { slaHours });

    const upsertPayload = {
      metric_date: snapshot.metricDate,
      total_scans: snapshot.kpi.totalScans,
      matched_scans: snapshot.kpi.matchedScans,
      unmatched_scans: snapshot.kpi.unmatchedScans,
      duplicate_scans: snapshot.kpi.duplicateScans,
      unmatched_rate: snapshot.kpi.unmatchedRate,
      duplicate_rate: snapshot.kpi.duplicateRate,
      scanned_rows: snapshot.state.scannedRows,
      inbound_rows: snapshot.state.inboundRows,
      not_inbound_rows: snapshot.state.notInboundRows,
      stale_unmatched_open: snapshot.state.staleUnmatchedOpenCount,
      stale_hours_threshold: slaHours,
      smoke_passed: snapshot.smoke.passed,
      smoke_errors: snapshot.smoke.errors.length > 0 ? snapshot.smoke.errors : null,
      smoke_warnings: snapshot.smoke.warnings.length > 0 ? snapshot.smoke.warnings : null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('shopee_scan_daily_kpis')
      .upsert(upsertPayload as never, { onConflict: 'metric_date' });

    if (upsertError) {
      throw new Error(`Failed to upsert shopee_scan_daily_kpis: ${upsertError.message}`);
    }

    const alertReasons: string[] = [];
    if (snapshot.kpi.unmatchedRate >= unmatchedRateAlertThreshold) {
      alertReasons.push(
        `Unmatched rate ${snapshot.kpi.unmatchedRate}% exceeded threshold ${unmatchedRateAlertThreshold}%.`
      );
    }
    if (snapshot.kpi.duplicateRate >= duplicateRateAlertThreshold) {
      alertReasons.push(
        `Duplicate rate ${snapshot.kpi.duplicateRate}% exceeded threshold ${duplicateRateAlertThreshold}%.`
      );
    }
    if (!snapshot.smoke.passed) {
      alertReasons.push('Shopee scan smoke checks failed.');
    }

    if (snapshot.state.staleUnmatchedOpenCount >= staleUnmatchedAlertThreshold) {
      await emitSchemaDriftAlert({
        source: 'cron.shopee-unmatched-sla',
        table: 'shopee_unmatched_scans',
        column: 'status,last_seen_at',
        errorMessage: `Found ${snapshot.state.staleUnmatchedOpenCount} unmatched scans older than ${slaHours}h SLA.`,
        context: {
          metricDate: snapshot.metricDate,
          staleUnmatchedOpenCount: snapshot.state.staleUnmatchedOpenCount,
          staleHoursThreshold: slaHours,
          rows: snapshot.staleUnmatchedOpenRows,
        },
      });
    }

    if (alertReasons.length > 0) {
      await emitSchemaDriftAlert({
        source: 'cron.shopee-scan-daily-report',
        table: 'shopee_scan_events,shopee_returns',
        column: 'scan_status,is_scanned,is_inbound',
        errorMessage: `Shopee scan daily report alerts: ${alertReasons.join(' | ')}`,
        context: {
          metricDate: snapshot.metricDate,
          thresholds: {
            unmatchedRateAlertThreshold,
            duplicateRateAlertThreshold,
            staleUnmatchedAlertThreshold,
            slaHours,
          },
          snapshot,
        },
      });
    }

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      data: {
        snapshot,
        thresholds: {
          unmatchedRateAlertThreshold,
          duplicateRateAlertThreshold,
          staleUnmatchedAlertThreshold,
          slaHours,
        },
        alertReasons,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('shopee scan daily report failed:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
