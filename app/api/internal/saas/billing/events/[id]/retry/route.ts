import { NextRequest, NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  buildBillingEventRetryDecision,
  type BillingEventRetryDecision,
  type BillingEventRetrySource,
} from '@/lib/saas/billing-reconciliation';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';

type BillingEventRetryErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'retry_not_enabled'
  | 'lookup_failed';

interface BillingEventRetryRepository {
  getBillingEvent(input: { eventId: string }): Promise<BillingEventRetrySource | null>;
}

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: BillingEventRetryRepository;
}

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryBuilder {
  select(columns: string): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: SupabaseQueryError | null }>;
}

interface BillingEventRetryQueryClient {
  from(table: string): SupabaseQueryBuilder;
}

class BillingEventRetryError extends Error {
  constructor(
    public readonly code: BillingEventRetryErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'BillingEventRetryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireString(value: unknown, field: string): string {
  const normalized = stringOrNull(value);
  if (!normalized) {
    throw new BillingEventRetryError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }
  return normalized;
}

function normalizeBillingEventId(value: unknown): string {
  const id = requireString(value, 'eventId');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new BillingEventRetryError(
      'invalid_request',
      400,
      'eventId must be a valid UUID.'
    );
  }
  return id;
}

function normalizeBillingEvent(row: unknown): BillingEventRetrySource | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const orgId = stringOrNull(row.org_id);
  const provider = stringOrNull(row.provider);
  const eventType = stringOrNull(row.event_type);
  const createdAt = stringOrNull(row.created_at);
  if (!id || !orgId || !provider || !eventType || !createdAt) {
    return null;
  }

  return {
    id,
    orgId,
    provider,
    eventType,
    status: stringOrNull(row.status) ?? (stringOrNull(row.processed_at) ? 'processed' : 'received'),
    providerEventId: stringOrNull(row.provider_event_id),
    createdAt,
  };
}

function createBillingEventRetryRepository(
  client: BillingEventRetryQueryClient
): BillingEventRetryRepository {
  return {
    async getBillingEvent(input) {
      const { data, error } = await client
        .from('billing_events')
        .select('id, org_id, provider, event_type, status, provider_event_id, processed_at, created_at')
        .eq('id', input.eventId)
        .maybeSingle();

      if (error) {
        throw new BillingEventRetryError(
          'lookup_failed',
          500,
          error.message || 'Failed to load billing event.'
        );
      }

      return normalizeBillingEvent(data);
    },
  };
}

function getRepository(deps: HandlerDependencies): BillingEventRetryRepository {
  return deps.repository ?? createBillingEventRetryRepository(
    createUntypedAdminClient() as unknown as BillingEventRetryQueryClient
  );
}

async function readDryRunRequest(request: NextRequest): Promise<{ dryRun: boolean }> {
  const text = await request.text();
  if (!text.trim()) {
    return { dryRun: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BillingEventRetryError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }

  if (!isRecord(parsed)) {
    throw new BillingEventRetryError(
      'invalid_request',
      400,
      'Request body must be an object.'
    );
  }

  return {
    dryRun: parsed.dryRun !== false,
  };
}

function retryDisabledResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Billing event replay is not enabled. Use dryRun=true for eligibility checks.',
      code: 'retry_not_enabled',
    },
    { status: 409 }
  );
}

export async function handleDryRunPlatformBillingEventRetry(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: HandlerDependencies = {}
) {
  try {
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_billing_events',
    })))();
    const { dryRun } = await readDryRunRequest(request);
    if (!dryRun) {
      return retryDisabledResponse();
    }

    const { id } = await context.params;
    const eventId = normalizeBillingEventId(id);
    const event = await getRepository(deps).getBillingEvent({ eventId });
    if (!event) {
      throw new BillingEventRetryError('not_found', 404, 'Billing event not found.');
    }

    const decision: BillingEventRetryDecision = buildBillingEventRetryDecision(event);

    return NextResponse.json({
      success: true,
      data: {
        ...decision,
        retryEnabled: false,
        dryRunOnly: true,
      },
    });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (error instanceof BillingEventRetryError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Dry-run platform billing event retry failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate billing event retry.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleDryRunPlatformBillingEventRetry(request, context);
}
