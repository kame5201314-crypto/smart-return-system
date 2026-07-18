import { NextRequest, NextResponse } from 'next/server';

import { resolveBillingProviderConfig, verifyECPayCheckMacValue } from '@/lib/saas/billing';
import {
  createECPayCheckoutRepository,
  parseECPayPaymentDate,
  resolveECPayPrepaidAmountTwd,
  type ECPayCheckoutRepository,
} from '@/lib/saas/billing-ecpay';

type ECPayWebhookPayload = Record<string, string>;

export interface ECPayWebhookDependencies {
  env?: Record<string, string | undefined>;
  repository?: ECPayCheckoutRepository;
  verifySignature?: (payload: ECPayWebhookPayload) => boolean | Promise<boolean>;
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

function requiredPayloadValue(payload: ECPayWebhookPayload, key: string): string {
  const value = payload[key]?.trim();
  if (!value) {
    throw new BillingWebhookError('invalid_request', 400, `${key} is required.`);
  }
  return value;
}

function requiredInteger(payload: ECPayWebhookPayload, key: string): number {
  const value = requiredPayloadValue(payload, key);
  if (!/^-?\d+$/.test(value)) {
    throw new BillingWebhookError('invalid_request', 400, `${key} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new BillingWebhookError('invalid_request', 400, `${key} is outside the safe range.`);
  }
  return parsed;
}

async function readWebhookPayload(request: NextRequest): Promise<ECPayWebhookPayload> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    throw new BillingWebhookError(
      'unsupported_media_type',
      415,
      'ECPay webhook must be form encoded.'
    );
  }
  const rawBody = await request.text();
  if (!rawBody.trim() || rawBody.length > 64_000) {
    throw new BillingWebhookError('invalid_request', 400, 'Webhook body is invalid.');
  }
  const params = new URLSearchParams(rawBody);
  const payload: ECPayWebhookPayload = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length !== 1) {
      throw new BillingWebhookError('invalid_request', 400, 'Duplicate webhook fields are invalid.');
    }
    payload[key] = values[0] ?? '';
  }
  return payload;
}

function plainAcknowledgement(): NextResponse {
  return new NextResponse('1|OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function handleECPayBillingWebhook(
  request: NextRequest,
  deps: ECPayWebhookDependencies = {}
) {
  try {
    const env = deps.env ?? process.env;
    // New checkout creation is feature-flag gated, but verified callbacks for
    // already-created orders must continue to drain after the flag is turned
    // off. Otherwise a customer could be charged while access is never
    // activated. The webhook still requires complete credentials, a valid
    // signature, the configured merchant, and a matching server-side order.
    const config = resolveBillingProviderConfig('ecpay', env);
    if (!config.configured) {
      throw new BillingWebhookError(
        'credentials_missing',
        503,
        'ECPay billing credentials are not configured.'
      );
    }

    const payload = await readWebhookPayload(request);
    const signatureValid = await (
      deps.verifySignature?.(payload) ?? verifyECPayCheckMacValue(payload, env)
    );
    if (!signatureValid) {
      throw new BillingWebhookError(
        'signature_required',
        401,
        'ECPay webhook signature verification failed.'
      );
    }

    const merchantId = requiredPayloadValue(payload, 'MerchantID');
    if (merchantId !== env.ECPAY_MERCHANT_ID?.trim()) {
      throw new BillingWebhookError('merchant_mismatch', 401, 'ECPay MerchantID does not match.');
    }
    const merchantTradeNo = requiredPayloadValue(payload, 'MerchantTradeNo');
    if (!/^[A-Za-z0-9]{1,20}$/.test(merchantTradeNo)) {
      throw new BillingWebhookError(
        'invalid_request',
        400,
        'MerchantTradeNo must be 1-20 alphanumeric characters.'
      );
    }
    const tradeAmountTwd = requiredInteger(payload, 'TradeAmt');
    const rtnCode = requiredInteger(payload, 'RtnCode');
    const simulatePaidValue = requiredPayloadValue(payload, 'SimulatePaid');
    if (simulatePaidValue !== '0' && simulatePaidValue !== '1') {
      throw new BillingWebhookError('invalid_request', 400, 'SimulatePaid must be 0 or 1.');
    }
    const simulatePaid = simulatePaidValue === '1';
    const tradeNo = payload.TradeNo?.trim() || null;
    if (rtnCode === 1 && !tradeNo) {
      throw new BillingWebhookError('invalid_request', 400, 'TradeNo is required for payment success.');
    }
    const paymentDate = parseECPayPaymentDate(payload.PaymentDate);
    if (rtnCode === 1 && !paymentDate) {
      throw new BillingWebhookError('invalid_request', 400, 'PaymentDate is invalid.');
    }

    const repository = deps.repository ?? createECPayCheckoutRepository();
    const order = await repository.findOrderByMerchantTradeNo(
      merchantTradeNo,
      merchantId,
      config.mode
    );
    if (!order) {
      throw new BillingWebhookError('order_not_found', 404, 'Payment order was not found.');
    }
    const serverAmount = resolveECPayPrepaidAmountTwd(order.plan);
    if (order.amountTwd !== serverAmount || tradeAmountTwd !== serverAmount) {
      throw new BillingWebhookError(
        'amount_mismatch',
        409,
        'ECPay amount does not match the server payment order.'
      );
    }

    await repository.processNotification({
      order,
      providerEventId: [
        config.mode,
        merchantId,
        merchantTradeNo,
        tradeNo ?? 'no-trade',
        `rtn${rtnCode}`,
        `sim${simulatePaid ? 1 : 0}`,
      ].join(':'),
      tradeNo,
      merchantId,
      tradeAmountTwd,
      rtnCode,
      rtnMessage: payload.RtnMsg?.trim() || '',
      simulatePaid,
      paymentDate,
      payload,
    });

    return plainAcknowledgement();
  } catch (error) {
    if (error instanceof BillingWebhookError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.error('ECPay billing webhook failed:', error);
    return NextResponse.json(
      { success: false, error: 'ECPay billing webhook failed.', code: 'webhook_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleECPayBillingWebhook(request);
}
