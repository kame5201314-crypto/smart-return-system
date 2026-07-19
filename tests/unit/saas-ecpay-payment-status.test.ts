/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleGetECPayPaymentStatus } from '@/app/api/saas/billing/payment-status/route';
import type {
  ECPayCheckoutRepository,
  ECPayPaymentOrder,
} from '@/lib/saas/billing-ecpay';
import { SaaSOrgContextError } from '@/lib/saas/org-context';

const env = {
  ECPAY_MERCHANT_ID: 'merchant1',
  ECPAY_HASH_KEY: 'test-hash-key',
  ECPAY_HASH_IV: 'test-hash-iv',
  ECPAY_MODE: 'test',
};

const paymentOrder: ECPayPaymentOrder = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: '22222222-2222-4222-8222-222222222222',
  actorUserId: '33333333-3333-4333-8333-333333333333',
  provider: 'ecpay',
  providerMode: 'test',
  plan: 'basic',
  amountTwd: 399,
  merchantId: env.ECPAY_MERCHANT_ID,
  merchantTradeNo: 'SR20260720PAY01',
  status: 'pending',
  createdAt: '2026-07-20T00:00:00.000Z',
};

function request(trade = paymentOrder.merchantTradeNo): NextRequest {
  return new NextRequest(
    `https://smart-return-system-saas.vercel.app/api/saas/billing/payment-status?trade=${encodeURIComponent(trade)}`
  );
}

function repository(order: ECPayPaymentOrder | null = paymentOrder): ECPayCheckoutRepository {
  return {
    createOrder: vi.fn(),
    findOrderByMerchantTradeNo: vi.fn(async () => order),
    processNotification: vi.fn(),
  };
}

function context(role: 'owner' | 'admin' | 'staff' = 'owner') {
  return {
    orgId: paymentOrder.orgId,
    role,
  };
}

describe('ECPay payment status route', () => {
  it('rejects invalid trade numbers before loading tenant data', async () => {
    const loadContext = vi.fn(async () => context());
    const paymentRepository = repository();
    const response = await handleGetECPayPaymentStatus(request('../not-a-trade'), {
      env,
      repository: paymentRepository,
      loadContext,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_trade' });
    expect(loadContext).not.toHaveBeenCalled();
    expect(paymentRepository.findOrderByMerchantTradeNo).not.toHaveBeenCalled();
  });

  it('requires an authenticated organization principal', async () => {
    const paymentRepository = repository();
    const response = await handleGetECPayPaymentStatus(request(), {
      env,
      repository: paymentRepository,
      loadContext: async () => {
        throw new SaaSOrgContextError('unauthenticated', 401, 'Authentication required.');
      },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(paymentRepository.findOrderByMerchantTradeNo).not.toHaveBeenCalled();
  });

  it('allows only owners and administrators', async () => {
    const paymentRepository = repository();
    const response = await handleGetECPayPaymentStatus(request(), {
      env,
      repository: paymentRepository,
      loadContext: async () => context('staff'),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'role_forbidden' });
    expect(paymentRepository.findOrderByMerchantTradeNo).not.toHaveBeenCalled();
  });

  it('does not disclose or mutate an order from another organization', async () => {
    const paymentRepository = repository({
      ...paymentOrder,
      orgId: '44444444-4444-4444-8444-444444444444',
    });
    const response = await handleGetECPayPaymentStatus(request(), {
      env,
      repository: paymentRepository,
      loadContext: async () => context('admin'),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'payment_not_found' });
    expect(paymentRepository.processNotification).not.toHaveBeenCalled();
  });

  it.each([
    'pending',
    'paid',
    'failed',
    'manual_review',
    'expired',
    'cancelled',
    'refunded',
  ])('returns the scoped read-only %s status without settlement', async (status) => {
    const paymentRepository = repository({ ...paymentOrder, status });
    const response = await handleGetECPayPaymentStatus(request(), {
      env,
      repository: paymentRepository,
      loadContext: async () => context('owner'),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ success: true, status });
    expect(paymentRepository.findOrderByMerchantTradeNo).toHaveBeenCalledWith(
      paymentOrder.merchantTradeNo,
      env.ECPAY_MERCHANT_ID,
      'test'
    );
    expect(paymentRepository.createOrder).not.toHaveBeenCalled();
    expect(paymentRepository.processNotification).not.toHaveBeenCalled();
  });

  it('keeps status lookup available without billing feature flags but requires provider identity', async () => {
    const paymentRepository = repository();
    const response = await handleGetECPayPaymentStatus(request(), {
      env: { ECPAY_MODE: 'test' },
      repository: paymentRepository,
      loadContext: async () => context(),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'provider_not_ready' });
    expect(paymentRepository.findOrderByMerchantTradeNo).not.toHaveBeenCalled();
  });
});
