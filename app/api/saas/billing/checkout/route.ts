import { NextRequest, NextResponse } from 'next/server';

import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  areECPayPaymentMethodsConfirmed,
  assertECPayCheckoutEnvironment,
  buildECPayAioCheckoutForm,
  createECPayCheckoutRepository,
  ECPayCheckoutRateLimitError,
  generateECPayCheckoutIdempotencyKey,
  generateECPayMerchantTradeNo,
  normalizeECPaySelfServiceCheckoutPlan,
  resolveECPayCustomOfferOrderMetadata,
  resolveECPayPrepaidAmountTwd,
  type ECPayCheckoutRepository,
  type ECPaySelfServiceCheckoutPlan,
} from '@/lib/saas/billing-ecpay';
import { resolveBillingWebhookState } from '@/lib/saas/billing';
import {
  createCustomPlanOfferRepository,
  CustomPlanOfferError,
  normalizeCustomPlanOfferId,
  type CustomPlanOfferRepository,
} from '@/lib/saas/custom-plan-offers';
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
  customOfferRepository?: CustomPlanOfferRepository;
  loadContext?: () => Promise<CheckoutContext>;
  now?: Date;
  generateMerchantTradeNo?: (now: Date) => string;
  generateIdempotencyKey?: () => string;
}

type CheckoutTarget =
  | { kind: 'plan'; plan: ECPaySelfServiceCheckoutPlan }
  | { kind: 'custom_offer'; offerId: string };

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

async function readCheckoutTarget(request: NextRequest): Promise<CheckoutTarget> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new CheckoutRouteError('invalid_request', 400, 'Checkout request body is invalid.');
  }

  if (!isRecord(payload)) {
    throw new CheckoutRouteError(
      'invalid_request',
      400,
      'Checkout request must be an object.'
    );
  }

  const keys = Object.keys(payload);
  if (keys.length !== 1 || (keys[0] !== 'plan' && keys[0] !== 'offerId')) {
    throw new CheckoutRouteError(
      'invalid_request',
      400,
      'Checkout request accepts either one plan or one custom offer.'
    );
  }

  if (keys[0] === 'offerId') {
    try {
      return {
        kind: 'custom_offer',
        offerId: normalizeCustomPlanOfferId(payload.offerId),
      };
    } catch {
      throw new CheckoutRouteError(
        'invalid_offer',
        400,
        'Checkout custom offer is invalid.'
      );
    }
  }

  const plan = normalizeECPaySelfServiceCheckoutPlan(payload.plan);
  if (!plan) {
    throw new CheckoutRouteError(
      'invalid_plan',
      400,
      'Checkout plan must be basic.'
    );
  }
  return { kind: 'plan', plan };
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
  if (!areECPayPaymentMethodsConfirmed(env)) {
    throw new CheckoutRouteError(
      'payment_methods_unavailable',
      503,
      'ECPay Production payment methods have not been confirmed.'
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
    const target = await readCheckoutTarget(request);
    const context = await loadCheckoutContext(deps, env);
    assertCheckoutEnabled(context, env);
    if (context.plan !== 'basic') {
      throw new CheckoutRouteError(
        'plan_downgrade_not_supported',
        409,
        'Legacy plans cannot be changed through self-service checkout.'
      );
    }

    const requestNow = deps.now ?? new Date();
    const merchantTradeNo = (deps.generateMerchantTradeNo ?? generateECPayMerchantTradeNo)(
      requestNow
    );
    const idempotencyKey = resolveIdempotencyKey(request, deps);
    const repository = deps.repository ?? createECPayCheckoutRepository();
    const providerMode = resolveBillingWebhookState('ecpay', env).config.mode;
    const merchantId = env.ECPAY_MERCHANT_ID!.trim();
    const amountTwd = target.kind === 'plan'
      ? resolveECPayPrepaidAmountTwd(target.plan)
      : null;
    const order = target.kind === 'plan'
      ? await repository.createOrder({
          orgId: context.orgId,
          actorUserId: context.userId,
          plan: target.plan,
          amountTwd: amountTwd!,
          merchantTradeNo,
          idempotencyKey,
          merchantId,
          providerMode,
        })
      : await (
          deps.customOfferRepository ?? createCustomPlanOfferRepository()
        ).createPaymentOrder({
          offerId: target.offerId,
          orgId: context.orgId,
          actorUserId: context.userId,
          provider: 'ecpay',
          providerMode,
          merchantId,
          merchantTradeNo,
          idempotencyKey,
        });

    if (
      order.orgId !== context.orgId
      || order.provider !== 'ecpay'
      || order.providerMode !== providerMode
      || order.merchantId !== merchantId
      || order.plan !== 'basic'
    ) {
      throw new CheckoutRouteError(
        'order_mismatch',
        409,
        'Persisted payment order does not match this checkout.'
      );
    }

    if (target.kind === 'plan') {
      if (order.plan !== target.plan || order.amountTwd !== amountTwd) {
        throw new CheckoutRouteError(
          'order_mismatch',
          409,
          'Persisted payment order does not match this checkout.'
        );
      }
    } else {
      let customOffer;
      try {
        customOffer = resolveECPayCustomOfferOrderMetadata(order);
      } catch {
        customOffer = null;
      }
      if (!customOffer || customOffer.customOfferId !== target.offerId) {
        throw new CheckoutRouteError(
          'order_mismatch',
          409,
          'Persisted payment order does not match this custom offer.'
        );
      }
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
    if (
      error instanceof ECPayCheckoutRateLimitError
      || (error instanceof CustomPlanOfferError
        && error.code === 'checkout_rate_limited')
    ) {
      const retryAfterSeconds = error instanceof ECPayCheckoutRateLimitError
        ? error.retryAfterSeconds
        : error.retryAfterSeconds ?? 60;
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    if (
      error instanceof SaaSOrgContextError
      || error instanceof CheckoutRouteError
      || error instanceof CustomPlanOfferError
    ) {
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
