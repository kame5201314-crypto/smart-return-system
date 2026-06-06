import { NextResponse } from 'next/server';

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

function parsePositiveInt(value: string | undefined | null, fallback: number): number {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
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
    return NextResponse.json(buildPlatformMaintenanceCronSkip('cron.scan-retention'));
  }

  const url = new URL(request.url);
  const scanEventRetentionDays = parsePositiveInt(
    url.searchParams.get('scanDays') || process.env.SCAN_EVENTS_RETENTION_DAYS,
    180
  );
  const unmatchedRetentionDays = parsePositiveInt(
    url.searchParams.get('unmatchedDays') || process.env.UNMATCHED_SCANS_RETENTION_DAYS,
    90
  );
  const batchLimit = parsePositiveInt(
    url.searchParams.get('batchLimit') || process.env.SCAN_RETENTION_BATCH_LIMIT,
    5000
  );

  try {
    const supabase = createUntypedAdminClient();
    const { data, error } = await supabase.rpc('archive_old_scan_data', {
      p_scan_event_retention_days: scanEventRetentionDays,
      p_unmatched_retention_days: unmatchedRetentionDays,
      p_batch_limit: batchLimit,
    });

    if (error) {
      await emitSchemaDriftAlert({
        source: 'cron.scan-retention',
        table: 'shopee_scan_events,shopee_unmatched_scans',
        column: 'scanned_at,last_seen_at,status',
        errorMessage: `archive_old_scan_data failed: ${error.message}`,
        context: {
          scanEventRetentionDays,
          unmatchedRetentionDays,
          batchLimit,
        },
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const summary = Array.isArray(data) && data.length > 0 ? data[0] : {};
    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      data: {
        scanEventRetentionDays,
        unmatchedRetentionDays,
        batchLimit,
        summary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emitSchemaDriftAlert({
      source: 'cron.scan-retention',
      table: 'shopee_scan_events,shopee_unmatched_scans',
      column: 'scanned_at,last_seen_at,status',
      errorMessage: `Unexpected retention cron error: ${message}`,
      context: {
        scanEventRetentionDays,
        unmatchedRetentionDays,
        batchLimit,
      },
    });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
