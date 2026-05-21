import { NextRequest, NextResponse } from 'next/server';

import {
  createBillingEventsRepository,
  resolveBillingWebhookState,
  resolveECPayWebhookEvent,
  verifyECPayCheckMacValue,
  type BillingEventsRepository,
  type BillingEventsQueryClient,
} from '@/lib/saas/billing';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

type ECPayWebhookPayload = Record<string, string>;

interface HandlerDependencies {
  env?: Record<string, string | undefined>;
  repository?: BillingEventsRepository;
  verifySignature?: (payload: ECPayWebhookPayload) => boolean | Promise<boolean>;
  resolveOrgId?: (payload: ECPayWebhookPayload) => string | null | Promise<string | null>;
}

class BillingWebhookError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'BillingWebhookError';
  }
}

function getRepository(deps: HandlerDependencies): BillingEventsRepository {
  return deps.repository ?? createBillingEventsRepository(
    createUntypedAdminClient() as unknown as BillingEventsQueryClient
  );
}

function parseWebhookPayload(rawBody: string, contentType: string | null): ECPayWebhookPayload {
  if (contentType?.includes('application/json')) {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)])
    );
  }

  const params = new URLSearchParams(rawBody);
  return Object.fromEntries(params.entries());
}

async function readWebhookPayload(request: NextRequest): Promise<ECPayWebhookPayload> {
  const rawBody = await request.text();
  if (!rawBody.trim()) {
    throw new BillingWebhookError('invalid_request', 400, 'Webhook body is required.');
  }

  try {
    return parseWebhookPayload(rawBody, request.headers.get('content-type'));
  } catch {
    throw new BillingWebhookError('invalid_request', 400, 'Webhook body is invalid.');
  }
}

async function resolveWebhookOrgId(
  payload: ECPayWebhookPayload,
  deps: HandlerDependencies
): Promise<string> {
  const orgId = (await deps.resolveOrgId?.(payload)) || payload.CustomField1 || payload.org_id;
  if (!orgId?.trim()) {
    throw new BillingWebhookError(
      'org_not_resolved',
      422,
      'Billing webhook organization could not be resolved.'
    );
  }
  return orgId.trim();
}

export async function handleECPayBillingWebhook(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const state = resolveBillingWebhookState('ecpay', deps.env);

    if (!state.billingEnabled || !state.providerEnabled) {
      return NextResponse.json(
        { success: false, error: 'Billing webhook is disabled.', code: 'billing_disabled' },
        { status: 404 }
      );
    }

    if (!state.config.configured) {
      return NextResponse.json(
        {
          success: false,
          error: 'ECPay billing credentials are not configured.',
          code: 'credentials_missing',
          missingEnv: state.config.missingEnv,
        },
        { status: 503 }
      );
    }

    const payload = await readWebhookPayload(request);
    const signatureValid = await (
      deps.verifySignature?.(payload) ??
      verifyECPayCheckMacValue(payload, deps.env)
    );

    if (!signatureValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'ECPay webhook signature verification failed.',
          code: 'signature_required',
        },
        { status: 401 }
      );
    }

    const orgId = await resolveWebhookOrgId(payload, deps);
    const event = resolveECPayWebhookEvent(payload);
    const result = await getRepository(deps).recordEvent({
      orgId,
      provider: 'ecpay',
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      payload,
    });

    return NextResponse.json(
      {
        success: true,
        provider: 'ecpay',
        eventStatus: result.status,
      },
      { status: result.status === 'duplicate' ? 200 : 202 }
    );
  } catch (error) {
    if (error instanceof BillingWebhookError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('ECPay billing webhook failed:', error);
    return NextResponse.json(
      { success: false, error: 'ECPay billing webhook failed.', code: 'webhook_failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleECPayBillingWebhook(request);
}
