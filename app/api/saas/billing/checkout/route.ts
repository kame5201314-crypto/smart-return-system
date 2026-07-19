import { NextRequest, NextResponse } from 'next/server';

import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  assertECPayCheckoutEnvironment,
  buildECPayAioCheckoutForm,
  createECPayCheckoutRepository,
  ECPayCheckoutRateLimitError,
  generateECPayCheckoutIdempotencyKey,
  generateECPayMerchantTradeNo,
  normalizeECPayPrepaidPlan,
  resolveECPayPrepaidAmountTwd,
  type ECPayCheckoutRepository,
  type ECPayPrepaidPlan,
} from '@/lib/saas/billing-ecpay';
import { resolveBillingWebhookState } from '@/lib/saas/billing';
import {
  getOrgContext,
  SaaSOrgContextError,
  type SaaSOrgContext,
  type SaaSOrgRole,
} from '@/lib/saas/org-context';

export const dynamic = 'force-dynamic';

interface CheckoutContext {
  userId: string;
  orgId: string;
  orgStatus: SaaSOrgContext['orgStatus'];
  suspensionSource?: SaaSOrgContext['suspensionSource'];
  role: SaaSOrgRole;
  plan: SaaSOrgContext['plan'];
  featureFlags: Pick<SaaSOrgContext['featureFlags'], 'billing' | 'subscription_plan'>;
}

export interface ECPayCheckoutRouteDependencies {
  env?: Record<string, string | undefined>;
  repository?: ECPayCheckoutRepository;
  loadContext?: () => Promise<CheckoutContext>;
  now?: Date;
  generateMerchantTradeNo?: (now: Date) => string;
  generateIdempotencyKey?: () => string;
}

class CheckoutRouteError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'CheckoutRouteError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readCheckoutPlan(request: NextRequest): Promise<ECPayPrepaidPlan> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new CheckoutRouteError('invalid_request', 400, 'Checkout request body is invalid.');
  }

  if (!isRecord(payload) || Object.keys(payload).some((key) => key !== 'plan')) {
    throw new CheckoutRouteError(
      'invalid_request',
      400,
      'Checkout request only accepts a plan.'
    );
  }
  const plan = normalizeECPayPrepaidPlan(payload.plan);
  if (!plan) {
    throw new CheckoutRouteError(
      'invalid_plan',
      400,
      'Checkout plan must be basic or growth.'
    );
  }
  return plan;
}

function resolveIdempotencyKey(
  request: NextRequest,
  deps: ECPayCheckoutRouteDependencies
): string {
  const supplied = request.headers.get('idempotency-key')?.trim();
  if (!supplied) {
    return (deps.generateIdempotencyKey ?? generateECPayCheckoutIdempotencyKey)();
  }
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(supplied)) {
    throw new CheckoutRouteError(
      'invalid_idempotency_key',
      400,
      'Idempotency-Key must be 16-160 safe ASCII characters.'
    );
  }
  return supplied;
}

function resolveCheckoutFormDate(
  orderCreatedAt: string | null,
  explicitlyInjectedNow: Date | undefined,
  requestNow: Date
): Date {
  if (explicitlyInjectedNow) {
    return explicitlyInjectedNow;
  }

  if (orderCreatedAt) {
    const persistedCreatedAt = new Date(orderCreatedAt);
    if (!Number.isNaN(persistedCreatedAt.getTime())) {
      return persistedCreatedAt;
    }
  }

  return requestNow;
}

async function loadCheckoutContext(
  deps: ECPayCheckoutRouteDependencies,
  env: Record<string, string | undefined>
): Promise<CheckoutContext> {
  const context = deps.loadContext
    ? await deps.loadContext()
    : await getOrgContext({
        requirements: { roles: ['owner', 'admin'] },
        env,
      });

  if (context.role !== 'owner' && context.role !== 'admin') {
    throw new CheckoutRouteError(
      'role_forbidden',
      403,
      'Only organization owners or administrators can start checkout.'
    );
  }
  return context;
}

function assertCheckoutEnabled(
  context: CheckoutContext,
  env: Record<string, string | undefined>
): void {
  if (
    context.orgStatus === 'suspended'
    && context.suspensionSource !== 'trial_expired'
    && context.suspensionSource !== 'billing'
  ) {
    throw new CheckoutRouteError(
      'platform_suspension_requires_review',
      409,
      'Platform-suspended workspaces cannot start self-service checkout.'
    );
  }

  const state = resolveBillingWebhookState('ecpay', env);
  if (
    !context.featureFlags.billing
    || !context.featureFlags.subscription_plan
    || !state.billingEnabled
    || !state.providerEnabled
  ) {
    throw new CheckoutRouteError(
      'billing_disabled',
      404,
      'Self-service billing is not enabled.'
    );
  }
  if (!state.config.configured) {
    throw new CheckoutRouteError(
      'credentials_missing',
      503,
      'ECPay billing credentials are not configured.'
    );
  }
  try {
    assertECPayCheckoutEnvironment(env);
  } catch {
    throw new CheckoutRouteError(
      'provider_not_ready',
      503,
      'ECPay checkout is not ready.'
    );
  }
}

export async function handleCreateECPayCheckout(
  request: NextRequest,
  deps: ECPayCheckoutRouteDependencies = {}
) {
  try {
    const env = deps.env ?? process.env;
    const plan = await readCheckoutPlan(request);
    const context = await loadCheckoutContext(deps, env);
    assertCheckoutEnabled(context, env);
    const planRank = { basic: 1, growth: 2, enterprise: 3 } as const;
    if (planRank[plan] < planRank[context.plan]) {
      throw new CheckoutRouteError(
        'plan_downgrade_not_supported',
        409,
        'Plans cannot be downgraded through self-service checkout.'
      );
    }

    const amountTwd = resolveECPayPrepaidAmountTwd(plan);
    const requestNow = deps.now ?? new Date();
    const merchantTradeNo = (deps.generateMerchantTradeNo ?? generateECPayMerchantTradeNo)(
      requestNow
    );
    const idempotencyKey = resolveIdempotencyKey(request, deps);
    const repository = deps.repository ?? createECPayCheckoutRepository();
    const providerMode = resolveBillingWebhookState('ecpay', env).config.mode;
    const order = await repository.createOrder({
      orgId: context.orgId,
      actorUserId: context.userId,
      plan,
      amountTwd,
      merchantTradeNo,
      idempotencyKey,
      merchantId: env.ECPAY_MERCHANT_ID!.trim(),
      providerMode,
    });

    if (
      order.orgId !== context.orgId
      || order.provider !== 'ecpay'
      || order.providerMode !== providerMode
      || order.merchantId !== env.ECPAY_MERCHANT_ID!.trim()
      || order.plan !== plan
      || order.amountTwd !== amountTwd
    ) {
      throw new CheckoutRouteError(
        'order_mismatch',
        409,
        'Persisted payment order does not match this checkout.'
      );
    }

    if (order.status.toLowerCase() !== 'pending') {
      throw new CheckoutRouteError(
        'checkout_order_not_pending',
        409,
        'This checkout order is no longer pending. Start a new checkout.'
      );
    }

    const checkout = buildECPayAioCheckoutForm({
      order,
      env,
      now: resolveCheckoutFormDate(order.createdAt, deps.now, requestNow),
    });
    return NextResponse.json(
      { success: true, checkout },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof ECPayCheckoutRateLimitError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(error.retryAfterSeconds),
          },
        }
      );
    }

    if (error instanceof SaaSOrgContextError || error instanceof CheckoutRouteError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('ECPay checkout creation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to start checkout.', code: 'checkout_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) {
    return crossSiteResponse;
  }
  return handleCreateECPayCheckout(request);
}
