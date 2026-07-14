import { NextResponse } from 'next/server';

import {
  createDefaultTrialExpiryRepository,
  isTrialExpiryCronEnabled,
  runScopedTrialExpiry,
  type TrialExpiryRepository,
} from '@/lib/saas/trial-expiry-worker';

export const dynamic = 'force-dynamic';

interface TrialExpiryCronDependencies {
  env?: Record<string, string | undefined>;
  repository?: TrialExpiryRepository;
  now?: Date;
}

function normalizeEnvValue(value: string | undefined | null): string {
  return value ? String(value).replace(/\\n/g, '').trim() : '';
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isInteger(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 500);
}

function isAuthorized(request: Request, env: Record<string, string | undefined>): boolean {
  const cronSecret = normalizeEnvValue(env.CRON_SECRET);
  const authHeader = normalizeEnvValue(request.headers.get('authorization'));
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

export async function handleTrialExpiryCron(
  request: Request,
  deps: TrialExpiryCronDependencies = {}
) {
  const env = deps.env ?? process.env;
  if (!isAuthorized(request, env)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrialExpiryCronEnabled(env)) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        code: 'trial_expiry_cron_disabled',
        reason: 'ENABLE_TRIAL_EXPIRY_CRON is not enabled.',
      },
      { status: 200 }
    );
  }

  try {
    const result = await runScopedTrialExpiry(
      deps.repository ?? createDefaultTrialExpiryRepository(),
      {
        now: deps.now,
        limit: parseLimit(env.SAAS_TRIAL_EXPIRY_BATCH_LIMIT),
      }
    );
    const failed = result.summary.failed > 0;
    return NextResponse.json(
      { success: !failed, data: result },
      { status: failed ? 500 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Trial expiry cron failed.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleTrialExpiryCron(request);
}
