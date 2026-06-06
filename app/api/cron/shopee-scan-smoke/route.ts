import { NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { emitSchemaDriftAlert } from '@/lib/observability/schema-drift';
import {
  buildPlatformMaintenanceCronSkip,
  isPlatformMaintenanceCronEnabled,
} from '@/lib/maintenance/cron-policy';
import { collectShopeeScanHealthSnapshot } from '@/lib/maintenance/shopee-scan-health';

function normalizeEnvValue(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function parsePositiveInt(value: string | null | undefined, defaultValue: number): number {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isInteger(parsed) || parsed <= 0) return defaultValue;
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
    return NextResponse.json(buildPlatformMaintenanceCronSkip('cron.shopee-scan-smoke'));
  }

  try {
    const url = new URL(request.url);
    const slaHours = parsePositiveInt(
      url.searchParams.get('slaHours') || process.env.SHOPEE_SCAN_SLA_HOURS,
      24
    );

    const supabase = createUntypedAdminClient();
    const snapshot = await collectShopeeScanHealthSnapshot(supabase, { slaHours });

    if (!snapshot.smoke.passed) {
      await emitSchemaDriftAlert({
        source: 'cron.shopee-scan-smoke',
        table: 'shopee_returns',
        column: 'is_scanned,scanned_at,is_inbound,inbound_at',
        errorMessage: `Shopee scan smoke failed with ${snapshot.smoke.errors.length} error(s).`,
        context: {
          metricDate: snapshot.metricDate,
          smoke: snapshot.smoke,
          state: snapshot.state,
        },
      });
    }

    const status = snapshot.smoke.passed ? 200 : 500;
    return NextResponse.json(
      {
        success: snapshot.smoke.passed,
        checkedAt: new Date().toISOString(),
        data: {
          metricDate: snapshot.metricDate,
          smoke: snapshot.smoke,
          state: snapshot.state,
        },
      },
      { status }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('shopee scan smoke failed:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
