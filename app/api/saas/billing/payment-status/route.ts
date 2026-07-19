import { NextRequest, NextResponse } from 'next/server';

import { resolveBillingProviderConfig } from '@/lib/saas/billing';
import {
  createECPayCheckoutRepository,
  normalizeECPayMerchantTradeNo,
  type ECPayCheckoutRepository,
} from '@/lib/saas/billing-ecpay';
import {
  getOrgContext,
  SaaSOrgContextError,
  type SaaSOrgRole,
} from '@/lib/saas/org-context';

export const dynamic = 'force-dynamic';

const PAYMENT_ORDER_STATUSES = [
  'pending',
  'paid',
  'failed',
  'manual_review',
  'expired',
  'cancelled',
  'refunded',
] as const;

type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

interface PaymentStatusContext {
  orgId: string;
  role: SaaSOrgRole;
}

export interface PaymentStatusRouteDependencies {
  env?: Record<string, string | undefined>;
  repository?: ECPayCheckoutRepository;
  loadContext?: () => Promise<PaymentStatusContext>;
}

class PaymentStatusRouteError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PaymentStatusRouteError';
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function normalizePaymentOrderStatus(value: unknown): PaymentOrderStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return PAYMENT_ORDER_STATUSES.includes(normalized as PaymentOrderStatus)
    ? (normalized as PaymentOrderStatus)
    : null;
}

async function loadPaymentStatusContext(
  deps: PaymentStatusRouteDependencies,
  env: Record<string, string | undefined>
): Promise<PaymentStatusContext> {
  const context = deps.loadContext
    ? await deps.loadContext()
    : await getOrgContext({
        requirements: { roles: ['owner', 'admin'] },
        env,
      });

  if (context.role !== 'owner' && context.role !== 'admin') {
    throw new PaymentStatusRouteError(
      'role_forbidden',
      403,
      'Only organization owners or administrators can view payment status.'
    );
  }
  return context;
}

export async function handleGetECPayPaymentStatus(
  request: NextRequest,
  deps: PaymentStatusRouteDependencies = {}
) {
  try {
    const merchantTradeNo = normalizeECPayMerchantTradeNo(
      request.nextUrl.searchParams.get('trade')
    );
    if (!merchantTradeNo) {
      throw new PaymentStatusRouteError(
        'invalid_trade',
        400,
        'A valid ECPay merchant trade number is required.'
      );
    }

    const env = deps.env ?? process.env;
    const context = await loadPaymentStatusContext(deps, env);
    const config = resolveBillingProviderConfig('ecpay', env);
    if (!config.configured) {
      throw new PaymentStatusRouteError(
        'provider_not_ready',
        503,
        'ECPay payment status is not available.'
      );
    }

    const repository = deps.repository ?? createECPayCheckoutRepository();
    const order = await repository.findOrderByMerchantTradeNo(
      merchantTradeNo,
      env.ECPAY_MERCHANT_ID!.trim(),
      config.mode
    );

    // The repository uses the service role for provider callbacks. Enforce the
    // authenticated organization boundary again before returning any status.
    if (!order || order.orgId !== context.orgId) {
      throw new PaymentStatusRouteError(
        'payment_not_found',
        404,
        'Payment order was not found.'
      );
    }

    const status = normalizePaymentOrderStatus(order.status);
    if (!status) {
      throw new PaymentStatusRouteError(
        'invalid_payment_status',
        500,
        'Payment order status is invalid.'
      );
    }

    // Read-only by design. Only the signed server webhook may call the
    // settlement RPC and activate or extend a subscription.
    return jsonResponse({ success: true, status }, 200);
  } catch (error) {
    if (error instanceof SaaSOrgContextError || error instanceof PaymentStatusRouteError) {
      return jsonResponse(
        { success: false, error: error.message, code: error.code },
        error.status
      );
    }

    console.error('ECPay payment status lookup failed:', error);
    return jsonResponse(
      { success: false, error: 'Unable to load payment status.', code: 'status_failed' },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return handleGetECPayPaymentStatus(request);
}
