import { NextRequest, NextResponse } from 'next/server';

import { resolveBillingProviderConfig, verifyECPayCheckMacValue } from '@/lib/saas/billing';
import { normalizeECPayMerchantTradeNo } from '@/lib/saas/billing-ecpay';

type ECPayResultPayload = Record<string, string>;

export interface ECPayResultRouteDependencies {
  env?: Record<string, string | undefined>;
  verifySignature?: (payload: ECPayResultPayload) => boolean | Promise<boolean>;
}

function redirectToBilling(
  request: NextRequest,
  payment: 'pending' | 'failed',
  merchantTradeNo?: string | null
): NextResponse {
  const target = new URL('/settings/billing', request.url);
  target.searchParams.set('payment', payment);
  if (payment === 'pending' && merchantTradeNo) {
    target.searchParams.set('trade', merchantTradeNo);
  }
  return NextResponse.redirect(target, {
    status: 303,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function parseResultPayload(request: NextRequest): Promise<ECPayResultPayload | null> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    return null;
  }
  const rawBody = await request.text();
  if (!rawBody.trim() || rawBody.length > 64_000) {
    return null;
  }
  const params = new URLSearchParams(rawBody);
  const payload: ECPayResultPayload = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length !== 1) {
      return null;
    }
    payload[key] = values[0] ?? '';
  }
  return payload;
}

export async function handleECPayBrowserResult(
  request: NextRequest,
  deps: ECPayResultRouteDependencies = {}
) {
  try {
    const env = deps.env ?? process.env;
    // New checkout creation may be disabled while a customer is already on
    // ECPay. Keep accepting signed browser results as long as the ECPay
    // credentials remain configured, matching the server webhook drain rule.
    // This route is advisory only and never activates a subscription.
    const config = resolveBillingProviderConfig('ecpay', env);
    if (!config.configured) {
      return redirectToBilling(request, 'failed');
    }
    const payload = await parseResultPayload(request);
    if (!payload) {
      return redirectToBilling(request, 'failed');
    }
    const signatureValid = await (
      deps.verifySignature?.(payload) ?? verifyECPayCheckMacValue(payload, env)
    );
    if (
      !signatureValid
      || payload.MerchantID?.trim() !== env.ECPAY_MERCHANT_ID?.trim()
      || payload.RtnCode?.trim() !== '1'
      || payload.SimulatePaid?.trim() === '1'
    ) {
      return redirectToBilling(request, 'failed');
    }
    const merchantTradeNo = normalizeECPayMerchantTradeNo(payload.MerchantTradeNo);
    if (!merchantTradeNo) {
      return redirectToBilling(request, 'failed');
    }
    // Browser results are advisory only. The signed server ReturnURL notification
    // remains the sole path that can activate a subscription.
    return redirectToBilling(request, 'pending', merchantTradeNo);
  } catch {
    return redirectToBilling(request, 'failed');
  }
}

export async function POST(request: NextRequest) {
  return handleECPayBrowserResult(request);
}

export async function GET(request: NextRequest) {
  const merchantTradeNo = normalizeECPayMerchantTradeNo(
    request.nextUrl.searchParams.get('trade')
  );
  return request.nextUrl.searchParams.get('back') === '1' && merchantTradeNo
    ? redirectToBilling(request, 'pending', merchantTradeNo)
    : redirectToBilling(request, 'failed');
}
