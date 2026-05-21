/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleECPayBillingWebhook } from '@/app/api/billing/ecpay/webhook/route';
import {
  buildBillingEventRecord,
  createBillingEventsRepository,
  resolveBillingProviderConfig,
  resolveBillingWebhookState,
  resolveECPayWebhookEvent,
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
      payload: {
        MerchantTradeNo: 'trade-1',
      },
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
