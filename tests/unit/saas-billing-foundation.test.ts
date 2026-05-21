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
  type BillingEventsRepository,
  type BillingEventsQueryClient,
} from '@/lib/saas/billing';

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

function createRepository(result: 'created' | 'duplicate' = 'created'): BillingEventsRepository {
  return {
    recordEvent: vi.fn(async () => ({ status: result })),
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

  it('returns 404 for ECPay webhook when billing is disabled', async () => {
    const repository = createRepository();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest({ MerchantTradeNo: 'trade-1' }),
      {
        env: {},
        repository,
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'billing_disabled',
    });
    expect(repository.recordEvent).not.toHaveBeenCalled();
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
    expect(repository.recordEvent).not.toHaveBeenCalled();
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
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it('records ECPay webhook events after default CheckMacValue verification passes', async () => {
    const repository = createRepository();
    const payload = {
      ...ecpayOfficialChecksumPayload,
      CheckMacValue: ecpayOfficialCheckMacValue,
    };
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest(payload),
      {
        env: ecpayOfficialChecksumEnv,
        repository,
        resolveOrgId: () => 'org-1',
      }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: true,
      provider: 'ecpay',
      eventStatus: 'created',
    });
    expect(repository.recordEvent).toHaveBeenCalledWith({
      orgId: 'org-1',
      provider: 'ecpay',
      providerEventId: 'ECPay1738978034',
      eventType: 'ecpay.payment_succeeded',
      payload,
    });
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
        resolveOrgId: () => 'org-1',
      }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'signature_required',
    });
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it('records verified ECPay webhook events through the injected repository', async () => {
    const repository = createRepository();
    const response = await handleECPayBillingWebhook(
      buildWebhookRequest({
        MerchantTradeNo: 'trade-1',
        RtnCode: '1',
        CustomField1: 'org-1',
      }),
      {
        env: completeECPayEnv,
        repository,
        verifySignature: () => true,
      }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: true,
      provider: 'ecpay',
      eventStatus: 'created',
    });
    expect(repository.recordEvent).toHaveBeenCalledWith({
      orgId: 'org-1',
      provider: 'ecpay',
      providerEventId: 'trade-1',
      eventType: 'ecpay.payment_succeeded',
      payload: {
        MerchantTradeNo: 'trade-1',
        RtnCode: '1',
        CustomField1: 'org-1',
      },
    });
  });
});
