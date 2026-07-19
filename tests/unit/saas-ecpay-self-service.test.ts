/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  GET as handleECPayBrowserBack,
  handleECPayBrowserResult,
} from '@/app/api/billing/ecpay/result/route';
import { handleECPayBillingWebhook } from '@/app/api/billing/ecpay/webhook/route';
import {
  POST as postECPayCheckout,
  handleCreateECPayCheckout,
} from '@/app/api/saas/billing/checkout/route';
import {
  buildECPayCheckMacValue,
  verifyECPayCheckMacValue,
} from '@/lib/saas/billing';
import {
  createECPayCheckoutRepository,
  ECPayCheckoutRateLimitError,
  generateECPayMerchantTradeNo,
  type ECPayCheckoutQueryClient,
  type ECPayCheckoutRepository,
  type ECPayPaymentOrder,
} from '@/lib/saas/billing-ecpay';

const env = {
  ENABLE_BILLING: 'true',
  ENABLE_SUBSCRIPTION_PLAN: 'true',
  BILLING_PROVIDER: 'ecpay',
  ECPAY_MERCHANT_ID: '3002607',
  ECPAY_HASH_KEY: 'pwFHCqoQZGmho4w6',
  ECPAY_HASH_IV: 'EkRm7iFT261dpevs',
  ECPAY_MODE: 'test',
  NEXT_PUBLIC_APP_URL: 'https://smart-return-system-saas.vercel.app',
};

const order: ECPayPaymentOrder = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  actorUserId: '33333333-3333-4333-8333-333333333333',
  provider: 'ecpay',
  providerMode: 'test',
  plan: 'basic',
  amountTwd: 399,
  merchantId: env.ECPAY_MERCHANT_ID,
  merchantTradeNo: 'SR20260719PAY01',
  status: 'pending',
  createdAt: '2026-07-19T00:00:00.000Z',
};

function checkoutContext(overrides: Record<string, unknown> = {}) {
  return {
    userId: order.actorUserId!,
    orgId: order.orgId,
    orgStatus: 'trialing' as const,
    suspensionSource: null,
    role: 'owner' as const,
    plan: 'basic' as const,
    featureFlags: {
      billing: true,
      subscription_plan: true,
    },
    ...overrides,
  };
}

function repository(
  paymentOrder: ECPayPaymentOrder = order,
  notificationStatus: 'processed' | 'duplicate' | 'ignored' | 'failed' = 'processed'
): ECPayCheckoutRepository {
  return {
    createOrder: vi.fn(async () => paymentOrder),
    findOrderByMerchantTradeNo: vi.fn(async () => paymentOrder),
    processNotification: vi.fn(async () => notificationStatus),
  };
}

function checkoutRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest('https://smart-return-system-saas.vercel.app/api/saas/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function webhookPayload(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    MerchantID: env.ECPAY_MERCHANT_ID,
    MerchantTradeNo: order.merchantTradeNo,
    TradeAmt: '399',
    RtnCode: '1',
    RtnMsg: 'Succeeded',
    SimulatePaid: '0',
    TradeNo: '260719000000001',
    PaymentDate: '2026/07/19 12:00:00',
    ...overrides,
  };
}

function queryTradePayload(overrides: Record<string, string> = {}): Record<string, string> {
  const { CheckMacValue: overriddenCheckMacValue, ...fieldOverrides } = overrides;
  const payload: Record<string, string> = {
    MerchantID: env.ECPAY_MERCHANT_ID,
    MerchantTradeNo: order.merchantTradeNo,
    TradeNo: '260719000000001',
    TradeAmt: '399',
    PaymentDate: '2026/07/19 12:00:00',
    TradeStatus: '1',
    ...fieldOverrides,
  };
  payload.CheckMacValue = overriddenCheckMacValue ?? buildECPayCheckMacValue({
    payload,
    hashKey: env.ECPAY_HASH_KEY,
    hashIv: env.ECPAY_HASH_IV,
  });
  return payload;
}

function queryTradeFetcher(
  payload: Record<string, string> = queryTradePayload(),
  status = 200
): typeof fetch {
  return vi.fn(async () => new Response(new URLSearchParams(payload).toString(), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })) as unknown as typeof fetch;
}

function formRequest(path: string, payload: Record<string, string>): NextRequest {
  return new NextRequest(`https://smart-return-system-saas.vercel.app${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams(payload).toString(),
  });
}

describe('self-service ECPay checkout', () => {
  it('rejects cross-site requests at the route boundary before parsing the body', async () => {
    const request = new NextRequest(
      'https://smart-return-system-saas.vercel.app/api/saas/billing/checkout',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.example.com',
          'sec-fetch-site': 'cross-site',
        },
        body: '{not-json',
      }
    );

    const response = await postECPayCheckout(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Cross-site requests are not allowed.',
      code: 'cross_site_request',
    });
  });

  it('creates a server-priced basic order and returns an official signed POST form', async () => {
    const checkoutRepository = repository();
    const response = await handleCreateECPayCheckout(checkoutRequest({ plan: 'basic' }), {
      env,
      repository: checkoutRepository,
      loadContext: async () => checkoutContext(),
      now: new Date('2026-07-19T04:00:00.000Z'),
      generateMerchantTradeNo: () => order.merchantTradeNo,
      generateIdempotencyKey: () => 'checkout-idempotency-0001',
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      checkout: {
        action: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
        method: 'POST',
        fields: expect.objectContaining({
          MerchantID: env.ECPAY_MERCHANT_ID,
          MerchantTradeNo: order.merchantTradeNo,
          TotalAmount: '399',
          ReturnURL: `${env.NEXT_PUBLIC_APP_URL}/api/billing/ecpay/webhook`,
          ClientBackURL: `${env.NEXT_PUBLIC_APP_URL}/api/billing/ecpay/result?back=1&trade=${order.merchantTradeNo}`,
          OrderResultURL: `${env.NEXT_PUBLIC_APP_URL}/api/billing/ecpay/result`,
          EncryptType: '1',
        }),
      },
    });
    expect(verifyECPayCheckMacValue(payload.checkout.fields, env)).toBe(true);
    expect(checkoutRepository.createOrder).toHaveBeenCalledWith({
      orgId: order.orgId,
      actorUserId: order.actorUserId,
      plan: 'basic',
      amountTwd: 399,
      merchantTradeNo: order.merchantTradeNo,
      idempotencyKey: 'checkout-idempotency-0001',
      merchantId: env.ECPAY_MERCHANT_ID,
      providerMode: 'test',
    });
  });

  it('allows suspended owners to renew and never requires writable subscription access', async () => {
    const growthOrder = { ...order, plan: 'growth' as const, amountTwd: 699 };
    const checkoutRepository = repository(growthOrder);
    const response = await handleCreateECPayCheckout(checkoutRequest({ plan: 'growth' }), {
      env,
      repository: checkoutRepository,
      loadContext: async () => checkoutContext({
        orgStatus: 'suspended' as const,
        suspensionSource: 'trial_expired' as const,
      }),
      generateMerchantTradeNo: () => order.merchantTradeNo,
      generateIdempotencyKey: () => 'checkout-idempotency-0002',
    });
    expect(response.status).toBe(200);
    expect(checkoutRepository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'growth', amountTwd: 699 })
    );
  });

  it.each([null, 'platform_admin'] as const)(
    'blocks a platform-suspended workspace before order creation (source: %s)',
    async (suspensionSource) => {
      const checkoutRepository = repository();
      const response = await handleCreateECPayCheckout(checkoutRequest({ plan: 'basic' }), {
        env,
        repository: checkoutRepository,
        loadContext: async () => checkoutContext({
          orgStatus: 'suspended' as const,
          suspensionSource,
        }),
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: 'platform_suspension_requires_review',
      });
      expect(checkoutRepository.createOrder).not.toHaveBeenCalled();
    }
  );

  it('rejects client-supplied amount or organization fields', async () => {
    const checkoutRepository = repository();
    const response = await handleCreateECPayCheckout(
      checkoutRequest({ plan: 'basic', amountTwd: 1, orgId: 'attacker-org' }),
      {
        env,
        repository: checkoutRepository,
        loadContext: async () => checkoutContext(),
      }
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_request' });
    expect(checkoutRepository.createOrder).not.toHaveBeenCalled();
  });

  it('blocks staff checkout plus growth and enterprise self-service downgrades', async () => {
    const checkoutRepository = repository();
    const staffResponse = await handleCreateECPayCheckout(checkoutRequest({ plan: 'basic' }), {
      env,
      repository: checkoutRepository,
      loadContext: async () => checkoutContext({ role: 'staff' as const }),
    });
    expect(staffResponse.status).toBe(403);

    const downgradeResponse = await handleCreateECPayCheckout(
      checkoutRequest({ plan: 'basic' }),
      {
        env,
        repository: checkoutRepository,
        loadContext: async () => checkoutContext({ plan: 'growth' as const }),
      }
    );
    expect(downgradeResponse.status).toBe(409);
    expect(await downgradeResponse.json()).toMatchObject({
      code: 'plan_downgrade_not_supported',
    });
    const enterpriseResponse = await handleCreateECPayCheckout(
      checkoutRequest({ plan: 'growth' }),
      {
        env,
        repository: checkoutRepository,
        loadContext: async () => checkoutContext({ plan: 'enterprise' as const }),
      }
    );
    expect(enterpriseResponse.status).toBe(409);
    expect(await enterpriseResponse.json()).toMatchObject({
      code: 'plan_downgrade_not_supported',
    });
    expect(checkoutRepository.createOrder).not.toHaveBeenCalled();
  });

  it('fails closed before order creation when subscription billing is disabled or mode is invalid', async () => {
    for (const override of [
      { ENABLE_SUBSCRIPTION_PLAN: 'false' },
      { ECPAY_MODE: 'unexpected' },
    ]) {
      const checkoutRepository = repository();
      const response = await handleCreateECPayCheckout(checkoutRequest({ plan: 'basic' }), {
        env: { ...env, ...override },
        repository: checkoutRepository,
        loadContext: async () => checkoutContext({
          featureFlags: {
            billing: true,
            subscription_plan: override.ENABLE_SUBSCRIPTION_PLAN !== 'false',
          },
        }),
      });
      expect([404, 503]).toContain(response.status);
      expect(checkoutRepository.createOrder).not.toHaveBeenCalled();
    }
  });

  it('returns a stable 429 response and Retry-After for the durable checkout limit', async () => {
    const checkoutRepository = repository();
    vi.mocked(checkoutRepository.createOrder).mockRejectedValueOnce(
      new ECPayCheckoutRateLimitError(73)
    );

    const response = await handleCreateECPayCheckout(checkoutRequest({ plan: 'basic' }), {
      env,
      repository: checkoutRepository,
      loadContext: async () => checkoutContext(),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('73');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'checkout_rate_limited',
      retryAfterSeconds: 73,
    });
  });

  it('keeps the signed provider form stable when a pending order is reused later', async () => {
    vi.useFakeTimers();
    try {
      const checkoutRepository = repository();
      vi.setSystemTime(new Date('2026-07-19T04:00:00.000Z'));
      const firstResponse = await handleCreateECPayCheckout(
        checkoutRequest({ plan: 'basic' }),
        {
          env,
          repository: checkoutRepository,
          loadContext: async () => checkoutContext(),
        }
      );

      vi.setSystemTime(new Date('2026-07-19T04:10:00.000Z'));
      const reusedResponse = await handleCreateECPayCheckout(
        checkoutRequest({ plan: 'basic' }),
        {
          env,
          repository: checkoutRepository,
          loadContext: async () => checkoutContext(),
        }
      );

      const firstPayload = await firstResponse.json();
      const reusedPayload = await reusedResponse.json();
      expect(firstPayload.checkout.fields.MerchantTradeDate).toBe('2026/07/19 08:00:00');
      expect(reusedPayload.checkout.fields).toEqual(firstPayload.checkout.fields);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never signs a reused order that is no longer pending', async () => {
    const checkoutRepository = repository({ ...order, status: 'paid' });
    const response = await handleCreateECPayCheckout(checkoutRequest({ plan: 'basic' }), {
      env,
      repository: checkoutRepository,
      loadContext: async () => checkoutContext(),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'checkout_order_not_pending',
    });
  });

  it('generates ECPay-compatible trade numbers', () => {
    const value = generateECPayMerchantTradeNo(
      new Date('2026-07-19T04:00:00.000Z'),
      'A-B_C.D!123456789'
    );
    expect(value).toMatch(/^[A-Za-z0-9]{1,20}$/);
    expect(value.length).toBeLessThanOrEqual(20);
  });
});

describe('ECPay repository RPC boundary', () => {
  it('turns the durable RPC limit result into a typed checkout error', async () => {
    const from = vi.fn();
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          status: 'rate_limited',
          error_code: 'checkout_rate_limited',
          retry_after_seconds: 91,
          scope: 'actor_and_org',
        },
        error: null,
      })),
      from,
    } as unknown as ECPayCheckoutQueryClient;
    const adapter = createECPayCheckoutRepository(client);

    await expect(adapter.createOrder({
      orgId: order.orgId,
      actorUserId: order.actorUserId!,
      plan: 'basic',
      amountTwd: 399,
      merchantTradeNo: order.merchantTradeNo,
      idempotencyKey: 'checkout-idempotency-rate-limit',
      merchantId: env.ECPAY_MERCHANT_ID,
      providerMode: 'test',
    })).rejects.toMatchObject({
      name: 'ECPayCheckoutRateLimitError',
      code: 'checkout_rate_limited',
      retryAfterSeconds: 91,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('uses only locked service-role RPCs and queries the persisted order', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'create_self_service_payment_order') {
        return {
          data: {
            payment_order_id: order.id,
            org_id: order.orgId,
            actor_user_id: order.actorUserId,
            provider: 'ecpay',
            provider_mode: 'test',
            plan: 'basic',
            amount_twd: 399,
            merchant_id: order.merchantId,
            merchant_trade_no: order.merchantTradeNo,
            status: 'pending',
          },
          error: null,
        };
      }
      return {
        data: { status: 'paid', activated: true, reused: false },
        error: null,
      };
    });
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: order.id,
        org_id: order.orgId,
        actor_user_id: order.actorUserId,
        provider: 'ecpay',
        provider_mode: 'test',
        plan: 'basic',
        amount_twd: 399,
        merchant_id: order.merchantId,
        merchant_trade_no: order.merchantTradeNo,
        status: 'pending',
        created_at: order.createdAt,
      },
      error: null,
    }));
    const query = {} as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: typeof maybeSingle;
    };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = maybeSingle;
    const client = {
      rpc,
      from: vi.fn(() => query),
    } as unknown as ECPayCheckoutQueryClient;
    const adapter = createECPayCheckoutRepository(client);

    await expect(adapter.createOrder({
      orgId: order.orgId,
      actorUserId: order.actorUserId!,
      plan: 'basic',
      amountTwd: 399,
      merchantTradeNo: order.merchantTradeNo,
      idempotencyKey: 'checkout-idempotency-0003',
      merchantId: env.ECPAY_MERCHANT_ID,
      providerMode: 'test',
    })).resolves.toMatchObject(order);

    expect(rpc).toHaveBeenNthCalledWith(1, 'create_self_service_payment_order', {
      p_org_id: order.orgId,
      p_actor_user_id: order.actorUserId,
      p_provider: 'ecpay',
      p_provider_mode: 'test',
      p_plan: 'basic',
      p_amount_twd: 399,
      p_merchant_trade_no: order.merchantTradeNo,
      p_idempotency_key: 'checkout-idempotency-0003',
      p_metadata: {
        source: 'self_service_settings',
        billing_period_months: 1,
        merchant_id: env.ECPAY_MERCHANT_ID,
        provider_mode: 'test',
      },
    });
    expect(query.eq).toHaveBeenCalledWith('provider_mode', 'test');
    expect(query.eq).toHaveBeenCalledWith('merchant_trade_no', order.merchantTradeNo);

    await expect(adapter.processNotification({
      order,
      providerEventId: 'trade-1:1:sim0',
      tradeNo: 'trade-1',
      merchantId: env.ECPAY_MERCHANT_ID,
      tradeAmountTwd: 399,
      rtnCode: 1,
      rtnMessage: 'Succeeded',
      simulatePaid: false,
      paymentDate: '2026-07-19T04:00:00.000Z',
      payload: { MerchantTradeNo: order.merchantTradeNo },
    })).resolves.toBe('processed');
    expect(rpc).toHaveBeenNthCalledWith(2, 'process_ecpay_payment_notification', {
      p_merchant_trade_no: order.merchantTradeNo,
      p_provider_event_id: 'trade-1:1:sim0',
      p_trade_no: 'trade-1',
      p_merchant_id: env.ECPAY_MERCHANT_ID,
      p_provider_mode: 'test',
      p_trade_amount_twd: 399,
      p_rtn_code: 1,
      p_rtn_message: 'Succeeded',
      p_simulate_paid: false,
      p_payment_date: '2026-07-19T04:00:00.000Z',
      p_payload: { MerchantTradeNo: order.merchantTradeNo },
    });
  });
});

describe('ECPay server notification', () => {
  it('queries ECPay and acknowledges only after the trusted paid order is processed', async () => {
    const checkoutRepository = repository();
    const fetcher = queryTradeFetcher();
    const response = await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload()),
      {
        env,
        repository: checkoutRepository,
        verifySignature: () => true,
        queryTradeInfoFetcher: fetcher,
        queryTradeInfoNow: new Date('2026-07-19T04:00:00.000Z'),
      }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('1|OK');
    expect(checkoutRepository.findOrderByMerchantTradeNo).toHaveBeenCalledWith(
      order.merchantTradeNo,
      env.ECPAY_MERCHANT_ID,
      'test'
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
      })
    );
    const requestOptions = vi.mocked(fetcher).mock.calls[0]?.[1];
    const requestPayload = Object.fromEntries(
      new URLSearchParams(String(requestOptions?.body)).entries()
    );
    expect(requestPayload).toMatchObject({
      MerchantID: env.ECPAY_MERCHANT_ID,
      MerchantTradeNo: order.merchantTradeNo,
      PlatformID: '',
    });
    expect(verifyECPayCheckMacValue(requestPayload, env)).toBe(true);
    expect(checkoutRepository.processNotification).toHaveBeenCalledTimes(1);
  });

  it('settles against the persisted order amount after a later catalogue price change', async () => {
    const pendingLegacyPriceOrder = { ...order, amountTwd: 499 };
    const checkoutRepository = repository(pendingLegacyPriceOrder);
    const response = await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload({ TradeAmt: '499' })),
      {
        env,
        repository: checkoutRepository,
        verifySignature: () => true,
        queryTradeInfoFetcher: queryTradeFetcher(queryTradePayload({ TradeAmt: '499' })),
      }
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('1|OK');
    expect(checkoutRepository.processNotification).toHaveBeenCalledWith(
      expect.objectContaining({ tradeAmountTwd: 499 })
    );
  });

  it('rejects merchant and amount mismatches without acknowledgement or activation', async () => {
    for (const payload of [
      webhookPayload({ MerchantID: 'wrong' }),
      webhookPayload({ TradeAmt: '1' }),
    ]) {
      const checkoutRepository = repository();
      const response = await handleECPayBillingWebhook(
        formRequest('/api/billing/ecpay/webhook', payload),
        { env, repository: checkoutRepository, verifySignature: () => true }
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).not.toBe('1|OK');
      expect(checkoutRepository.processNotification).not.toHaveBeenCalled();
    }
  });

  it('keeps simulated and real success event ids separate so simulation cannot poison payment', async () => {
    const checkoutRepository = repository();
    const fetcher = queryTradeFetcher();
    await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload({ SimulatePaid: '1' })),
      {
        env,
        repository: checkoutRepository,
        verifySignature: () => true,
        queryTradeInfoFetcher: fetcher,
      }
    );
    await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload({ SimulatePaid: '0' })),
      {
        env,
        repository: checkoutRepository,
        verifySignature: () => true,
        queryTradeInfoFetcher: fetcher,
      }
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(checkoutRepository.processNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        providerEventId: 'test:3002607:SR20260719PAY01:260719000000001:rtn1:sim1',
        simulatePaid: true,
      })
    );
    expect(checkoutRepository.processNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerEventId: 'test:3002607:SR20260719PAY01:260719000000001:rtn1:sim0',
        simulatePaid: false,
      })
    );
  });

  it('returns the same exact acknowledgement for an idempotent duplicate', async () => {
    const response = await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload()),
      {
        env,
        repository: repository(order, 'duplicate'),
        verifySignature: () => true,
        queryTradeInfoFetcher: queryTradeFetcher(),
      }
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('1|OK');
  });

  it('does not acknowledge when durable notification processing fails', async () => {
    const checkoutRepository = repository();
    vi.mocked(checkoutRepository.processNotification).mockRejectedValueOnce(
      new Error('database unavailable')
    );
    const response = await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload()),
      {
        env,
        repository: checkoutRepository,
        verifySignature: () => true,
        queryTradeInfoFetcher: queryTradeFetcher(),
      }
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toBe('1|OK');
  });

  it('fails closed when the signed ECPay query does not confirm the exact paid trade', async () => {
    for (const queryPayload of [
      queryTradePayload({ CheckMacValue: 'BAD' }),
      queryTradePayload({ MerchantID: 'wrong' }),
      queryTradePayload({ MerchantTradeNo: 'WRONGORDER' }),
      queryTradePayload({ TradeNo: 'WRONGTRADE' }),
      queryTradePayload({ TradeAmt: '1' }),
      queryTradePayload({ TradeStatus: '0' }),
    ]) {
      const checkoutRepository = repository();
      const response = await handleECPayBillingWebhook(
        formRequest('/api/billing/ecpay/webhook', webhookPayload()),
        {
          env,
          repository: checkoutRepository,
          verifySignature: () => true,
          queryTradeInfoFetcher: queryTradeFetcher(queryPayload),
        }
      );
      expect(response.status).toBe(502);
      expect(await response.text()).not.toBe('1|OK');
      expect(checkoutRepository.processNotification).not.toHaveBeenCalled();
    }
  });

  it('fails closed when ECPay trade query is unavailable', async () => {
    const checkoutRepository = repository();
    const response = await handleECPayBillingWebhook(
      formRequest('/api/billing/ecpay/webhook', webhookPayload()),
      {
        env,
        repository: checkoutRepository,
        verifySignature: () => true,
        queryTradeInfoFetcher: queryTradeFetcher({}, 503),
      }
    );
    expect(response.status).toBe(502);
    expect(await response.text()).not.toBe('1|OK');
    expect(checkoutRepository.processNotification).not.toHaveBeenCalled();
  });
});

describe('ECPay browser result', () => {
  it('redirects signed success to pending without activating a subscription', async () => {
    const response = await handleECPayBrowserResult(
      formRequest('/api/billing/ecpay/result', webhookPayload()),
      { env, verifySignature: () => true }
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${env.NEXT_PUBLIC_APP_URL}/settings/billing?payment=pending&trade=${order.merchantTradeNo}`
    );
  });

  it('keeps draining signed results after new ECPay checkout is disabled', async () => {
    const response = await handleECPayBrowserResult(
      formRequest('/api/billing/ecpay/result', webhookPayload()),
      {
        env: {
          ...env,
          ENABLE_BILLING: 'false',
          BILLING_PROVIDER: 'stripe',
        },
        verifySignature: () => true,
      }
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${env.NEXT_PUBLIC_APP_URL}/settings/billing?payment=pending&trade=${order.merchantTradeNo}`
    );
  });

  it('redirects invalid or simulated browser results to failed', async () => {
    const response = await handleECPayBrowserResult(
      formRequest('/api/billing/ecpay/result', webhookPayload({ SimulatePaid: '1' })),
      { env, verifySignature: () => true }
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('payment=failed');
  });

  it('does not start status tracking for a malformed signed merchant trade number', async () => {
    const response = await handleECPayBrowserResult(
      formRequest(
        '/api/billing/ecpay/result',
        webhookPayload({ MerchantTradeNo: '../invalid' })
      ),
      { env, verifySignature: () => true }
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${env.NEXT_PUBLIC_APP_URL}/settings/billing?payment=failed`
    );
  });

  it('redirects the provider back link to pending status tracking', async () => {
    const response = await handleECPayBrowserBack(
      new NextRequest(
        `${env.NEXT_PUBLIC_APP_URL}/api/billing/ecpay/result?back=1&trade=${order.merchantTradeNo}`
      )
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${env.NEXT_PUBLIC_APP_URL}/settings/billing?payment=pending&trade=${order.merchantTradeNo}`
    );
  });

  it('fails closed for missing or malformed provider back-link trade numbers', async () => {
    for (const target of [
      `${env.NEXT_PUBLIC_APP_URL}/api/billing/ecpay/result?back=1`,
      `${env.NEXT_PUBLIC_APP_URL}/api/billing/ecpay/result?back=1&trade=../invalid`,
    ]) {
      const response = await handleECPayBrowserBack(new NextRequest(target));
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        `${env.NEXT_PUBLIC_APP_URL}/settings/billing?payment=failed`
      );
    }
  });
});
