/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleECPayBillingWebhook } from '@/app/api/billing/ecpay/webhook/route';
import {
  buildBillingEventRecord,
  buildECPayCheckMacValue,
  createBillingEventsRepository,
  resolveBillingProviderConfig,
  resolveBillingWebhookState,
  resolveECPayWebhookEvent,
  verifyECPayCheckMacValue,
  type BillingEventsQueryClient,
} from '@/lib/saas/billing';
import {
  type ECPayCheckoutRepository,
  type ECPayPaymentOrder,
} from '@/lib/saas/billing-ecpay';

const completeECPayEnv = {
  ENABLE_BILLING: 'true',
  BILLING_PROVIDER: 'ecpay',
  ECPAY_MERCHANT_ID: 'merchant-1',
  ECPAY_HASH_KEY: 'hash-key',
  ECPAY_HASH_IV: 'hash-iv',
  ECPAY_MODE: 'test',
};

const ecpayOfficialChecksumEnv = {
  ...completeECPayEnv,
  ECPAY_HASH_KEY: 'pwFHCqoQZGmho4w6',
  ECPAY_HASH_IV: 'EkRm7iFT261dpevs',
};

const ecpayOfficialChecksumPayload = {
  CustomField1: '',
  CustomField2: '',
  CustomField3: '',
  CustomField4: '',
  MerchantID: '3002607',
  MerchantTradeNo: 'ECPay1738978034',
  PaymentDate: '2025/02/08 09:32:20',
  PaymentType: 'Credit_CreditCard',
  PaymentTypeChargeFee: '1',
  RtnCode: '1',
  RtnMsg: '交易成功',
  SimulatePaid: '0',
  StoreID: '',
  TradeAmt: '30',
  TradeDate: '2025/02/08 09:27:18',
  TradeNo: '2502080927183709',
};

const ecpayOfficialCheckMacValue =
  'C66199663DD43BF01058218601BEE874315E5FF57A1FE112A9114AC3701947BA';

function buildWebhookRequest(body: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/billing/ecpay/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
}

const paymentOrder: ECPayPaymentOrder = {
  id: 'order-1',
  orgId: 'org-1',
  actorUserId: 'user-1',
  provider: 'ecpay',
  providerMode: 'test',
  plan: 'basic',
  amountTwd: 399,
  merchantId: 'merchant-1',
  merchantTradeNo: 'SRPAYMENT1',
  status: 'pending',
  createdAt: '2026-07-19T00:00:00.000Z',
};

function createRepository(
  result: 'processed' | 'duplicate' | 'ignored' | 'failed' = 'processed'
): ECPayCheckoutRepository {
  return {
    createOrder: vi.fn(async () => paymentOrder),
    findOrderByMerchantTradeNo: vi.fn(async () => paymentOrder),
    processNotification: vi.fn(async () => result),
  };
}

function buildSignedWebhookPayload(
  overrides: Partial<Record<string, string>> = {}
): Record<string, string> {
  const payload = {
    MerchantID: completeECPayEnv.ECPAY_MERCHANT_ID,
    MerchantTradeNo: paymentOrder.merchantTradeNo,
    TradeAmt: String(paymentOrder.amountTwd),
    RtnCode: '1',
    RtnMsg: 'Succeeded',
    SimulatePaid: '0',
    TradeNo: 'gateway-trade-1',
    PaymentDate: '2026/07/19 12:00:00',
    ...overrides,
  };
  return {
    ...payload,
    CheckMacValue: buildECPayCheckMacValue({
      payload,
      hashKey: completeECPayEnv.ECPAY_HASH_KEY,
      hashIv: completeECPayEnv.ECPAY_HASH_IV,
    }),
  };
}

describe('SaaS billing foundation', () => {
  it('keeps billing webhooks disabled by default', () => {
    expect(resolveBillingWebhookState('ecpay', {})).toMatchObject({
      billingEnabled: false,
      providerEnabled: false,
      activeProvider: null,
    });
  });

  it('detects missing ECPay credentials before webhook processing', () => {
    expect(
      resolveBillingProviderConfig('ecpay', {
        ECPAY_MERCHANT_ID: 'merchant-1',
      })
    ).toMatchObject({
      configured: false,
      missingEnv: ['ECPAY_HASH_KEY', 'ECPAY_HASH_IV', 'ECPAY_MODE'],
    });
  });

  it('builds idempotent billing event records for billing_events', () => {
    expect(
      buildBillingEventRecord({
        orgId: 'org-1',
        provider: 'ecpay',
        providerEventId: 'trade-1',
        eventType: 'ecpay.payment_succeeded',
        payload: {
          MerchantTradeNo: 'trade-1',
        },
      })
    ).toEqual({
      org_id: 'org-1',
      provider: 'ecpay',
      provider_event_id: 'trade-1',
      event_type: 'ecpay.payment_succeeded',
      status: 'received',
      payload: {
        MerchantTradeNo: 'trade-1',
      },
    });
  });

  it('allows billing event records to carry an explicit processing status', () => {
    expect(
      buildBillingEventRecord({
        orgId: 'org-1',
        provider: 'ecpay',
        providerEventId: 'trade-1',
        eventType: 'ecpay.payment_succeeded',
        status: 'processed',
        payload: {},
      })
    ).toMatchObject({
      status: 'processed',
    });
  });

  it('treats duplicate provider event inserts as idempotent duplicates', async () => {
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async () => ({
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
          },
        })),
      })),
    } as BillingEventsQueryClient;

    await expect(
      createBillingEventsRepository(client).recordEvent({
        orgId: 'org-1',
        provider: 'ecpay',
        providerEventId: 'trade-1',
        eventType: 'ecpay.payment_succeeded',
        payload: {},
      })
    ).resolves.toEqual({ status: 'duplicate' });
  });

  it('normalizes ECPay event ids and event types from webhook payloads', () => {
    expect(
      resolveECPayWebhookEvent({
        MerchantTradeNo: 'trade-1',
        RtnCode: '1',
      })
    ).toEqual({
      providerEventId: 'trade-1',
      eventType: 'ecpay.payment_succeeded',
    });

    expect(
      resolveECPayWebhookEvent({
        TradeNo: 'gateway-trade-1',
        RtnCode: '0',
      })
    ).toEqual({
      providerEventId: 'gateway-trade-1',
      eventType: 'ecpay.payment_failed',
    });
  });

  it('builds ECPay CheckMacValue with the official payment notification checksum example', () => {
    expect(
      buildECPayCheckMacValue({
        payload: ecpayOfficialChecksumPayload,
        hashKey: ecpayOfficialChecksumEnv.ECPAY_HASH_KEY,
        hashIv: ecpayOfficialChecksumEnv.ECPAY_HASH_IV,
      })
    ).toBe(ecpayOfficialCheckMacValue);
  });

  it('verifies ECPay CheckMacValue and ignores CheckMacValue itself during calculation', () => {
    expect(
      verifyECPayCheckMacValue(
        {
          ...ecpayOfficialChecksumPayload,
          CheckMacValue: ecpayOfficialCheckMacValue,
        },
        ecpayOfficialChecksumEnv
      )
    ).toBe(true);

    expect(
      verifyECPayCheckMacValue(
        {
          ...ecpayOfficialChecksumPayload,
          CheckMacValue: 'BAD',
        },
        ecpayOfficialChecksumEnv
      )
    ).toBe(false);
  });

  it('continues draining verified existing orders after new checkout is disabled', async () => {
    const repository = createRepository();
    const env = {
      ...completeECPayEnv,
      ENABLE_BILLING: 'false',
      BILLING_PROVIDER: 'stripe',
    };
    const payload = buildSignedWebhookPayload();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest(payload),
      {
        env,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('1|OK');
    expect(repository.processNotification).toHaveBeenCalledTimes(1);
  });

  it('returns 503 for ECPay webhook when billing is enabled without credentials', async () => {
    const repository = createRepository();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest({ MerchantTradeNo: 'trade-1' }),
      {
        env: {
          ENABLE_BILLING: 'true',
          BILLING_PROVIDER: 'ecpay',
        },
        repository,
      }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'credentials_missing',
    });
    expect(repository.processNotification).not.toHaveBeenCalled();
  });

  it('rejects ECPay webhook processing until signature verification passes', async () => {
    const repository = createRepository();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest({ MerchantTradeNo: 'trade-1' }),
      {
        env: completeECPayEnv,
        repository,
      }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'signature_required',
    });
    expect(repository.processNotification).not.toHaveBeenCalled();
  });

  it('records ECPay webhook events after default CheckMacValue verification passes', async () => {
    const repository = createRepository();
    const payload = buildSignedWebhookPayload();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest(payload),
      {
        env: completeECPayEnv,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('1|OK');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(repository.processNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        order: paymentOrder,
        providerEventId: 'test:merchant-1:SRPAYMENT1:gateway-trade-1:rtn1:sim0',
        tradeAmountTwd: 399,
        simulatePaid: false,
        payload,
      })
    );
  });

  it('does not record ECPay webhook events when default CheckMacValue verification fails', async () => {
    const repository = createRepository();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest({
        ...ecpayOfficialChecksumPayload,
        CheckMacValue: 'BAD',
      }),
      {
        env: ecpayOfficialChecksumEnv,
        repository,
      }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'signature_required',
    });
    expect(repository.processNotification).not.toHaveBeenCalled();
  });

  it('records verified ECPay webhook events through the injected repository', async () => {
    const repository = createRepository();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest(buildSignedWebhookPayload()),
      {
        env: completeECPayEnv,
        repository,
        verifySignature: () => true,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('1|OK');
    expect(repository.processNotification).toHaveBeenCalledTimes(1);
  });
});
