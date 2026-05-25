import { NextResponse } from 'next/server';

import {
  buildSaaSEmailQueueWorkerPreview,
  createDefaultSaaSEmailQueueWorkerRepository,
  type SaaSEmailQueueWorkerRepository,
} from '@/lib/saas/email-queue-worker';

export interface SaaSEmailQueueCronDependencies {
  repository?: SaaSEmailQueueWorkerRepository;
  env?: Record<string, string | undefined>;
  now?: Date;
}

function normalizeEnvValue(value: string | undefined | null): string {
  if (!value) return '';
  return String(value).replace(/\\n/g, '').trim();
}

function isProduction(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
}

function parsePositiveInt(value: string | null | undefined, fallback: number): number {
  const parsed = Number(normalizeEnvValue(value));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 500);
}

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function isAuthorized(
  request: Request,
  env: Record<string, string | undefined>
): { ok: boolean; status?: number; message?: string } {
  const cronSecret = normalizeEnvValue(env.CRON_SECRET);
  const authHeader = normalizeEnvValue(request.headers.get('authorization'));

  if (isProduction(env) && !cronSecret) {
    return { ok: false, status: 500, message: 'Server configuration error' };
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return { ok: true };
}

export async function handleSaaSEmailQueueCron(
  request: Request,
  deps: SaaSEmailQueueCronDependencies = {}
) {
  const env = deps.env ?? process.env;
  const auth = isAuthorized(request, env);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.message },
      { status: auth.status ?? 401 }
    );
  }

  const url = new URL(request.url);
  const dryRun = parseBool(url.searchParams.get('dryRun'), true);
  if (!dryRun) {
    return NextResponse.json(
      {
        success: false,
        code: 'delivery_not_enabled',
        error: 'Email delivery is not enabled. Use dryRun=true for queue eligibility checks.',
      },
      { status: 409 }
    );
  }

  const now = deps.now ?? new Date();
  const limit = parsePositiveInt(
    url.searchParams.get('limit') ?? env.SAAS_EMAIL_QUEUE_DRY_RUN_LIMIT,
    50
  );
  const maxAttempts = parsePositiveInt(env.SAAS_EMAIL_QUEUE_MAX_ATTEMPTS, 3);
  const repository = deps.repository ?? createDefaultSaaSEmailQueueWorkerRepository();

  try {
    const records = await repository.listDueEmailQueue({
      now: now.toISOString(),
      limit,
    });
    const preview = buildSaaSEmailQueueWorkerPreview(records, {
      now,
      maxAttempts,
      deliveryProviderEnabled: false,
    });

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to inspect email queue.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleSaaSEmailQueueCron(request);
}
