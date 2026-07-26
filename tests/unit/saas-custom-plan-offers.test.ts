/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { ADMIN_UUID } from '@/lib/auth/admin-session';
import {
  createCustomPlanOfferRepository,
  CustomPlanOfferError,
  isCustomPlanOfferId,
  normalizeCancelCustomPlanOfferInput,
  normalizeCreateCustomPlanOfferInput,
  type CustomPlanOfferQueryClient,
} from '@/lib/saas/custom-plan-offers';

const orgId = '11111111-1111-4111-8111-111111111111';
const offerId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '33333333-3333-4333-8333-333333333333';
const paymentOrderId = '44444444-4444-4444-8444-444444444444';
const operator = { userId: actorUserId, platformRole: 'billing' as const };
const actorMetadata = {
  actorKind: 'authenticated_platform_admin' as const,
  actorFingerprintSha256: 'a'.repeat(64),
  platformRole: 'billing' as const,
};

const offerRow = {
  id: offerId,
  org_id: orgId,
  title: '專屬入門方案',
  description: '包含一個月使用期',
  amount_twd: 899,
  plan: 'basic',
  billing_period_months: 1,
  status: 'active',
  expires_at: '2026-07-27T12:00:00.000Z',
  payment_order_id: null,
  created_by: actorUserId,
  cancelled_by: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: '2026-07-20T12:00:00.000Z',
  updated_at: '2026-07-20T12:00:00.000Z',
};

const orderRow = {
  id: paymentOrderId,
  org_id: orgId,
  created_by: actorUserId,
  provider: 'ecpay',
  provider_mode: 'test',
  plan: 'basic',
  amount_twd: 899,
  merchant_id: '3002607',
  merchant_trade_no: 'SRCUSTOM26072001',
  status: 'pending',
  created_at: '2026-07-20T12:00:00.000Z',
  metadata: {
    pricing_kind: 'custom_offer',
    custom_offer_id: offerId,
    custom_offer_title: '專屬入門方案',
    billing_period_months: 1,
  },
};

function queryClient(input: {
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
  rows?: unknown;
  queryError?: { code?: string; message?: string } | null;
}) {
  const maybeSingle = vi.fn(async () => ({
    data: Array.isArray(input.rows) ? input.rows[0] ?? null : input.rows ?? null,
    error: input.queryError ?? null,
  }));
  const result = Promise.resolve({
    data: input.rows ?? [],
    error: input.queryError ?? null,
  });
  const builder = Object.assign(result, {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  });
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  const select = vi.fn(() => builder);
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn(input.rpc ?? (async () => ({ data: offerRow, error: null })));
  return {
    client: { from, rpc } as unknown as CustomPlanOfferQueryClient,
    from,
    select,
    builder,
    maybeSingle,
    rpc,
  };
}

describe('custom plan offer input contracts', () => {
  it('normalizes one private Basic offer and drops legacy admin fake UUIDs', () => {
    const now = new Date('2026-07-20T00:00:00.000Z');
    expect(normalizeCreateCustomPlanOfferInput({
      orgId,
      title: '  專屬入門方案  ',
      description: '  包含一個月使用期  ',
      amountTwd: 899,
      expiresAt: '2026-07-27T00:00:00.000Z',
      hashKey: 'must-not-pass-through',
    }, { userId: ADMIN_UUID, platformRole: 'owner' }, now)).toMatchObject({
      orgId,
      actorUserId: null,
      actorMetadata: {
        actorKind: 'legacy_admin',
        platformRole: 'owner',
      },
      title: '專屬入門方案',
      description: '包含一個月使用期',
      amountTwd: 899,
      expiresAt: '2026-07-27T00:00:00.000Z',
    });
    const legacy = normalizeCreateCustomPlanOfferInput({
      orgId,
      title: 'Legacy offer',
      amountTwd: 899,
      expiresAt: '2026-07-27T00:00:00.000Z',
    }, { userId: ADMIN_UUID, platformRole: 'owner' }, now);
    expect(legacy.actorMetadata.actorFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(legacy.actorMetadata.actorFingerprintSha256).not.toContain(ADMIN_UUID);
  });

  it('rejects unsafe prices, dates, ids, and cancellation reasons', () => {
    for (const amountTwd of [4, 200_000, 1.5]) {
      expect(() => normalizeCreateCustomPlanOfferInput({
        orgId,
        title: '專屬入門方案',
        amountTwd,
        expiresAt: '2026-07-27T00:00:00.000Z',
      }, operator, new Date('2026-07-20T00:00:00.000Z'))).toThrow(
        CustomPlanOfferError
      );
    }
    expect(() => normalizeCreateCustomPlanOfferInput({
      orgId,
      title: '專屬入門方案',
      amountTwd: 899,
      expiresAt: '2026-07-20T01:00:00.000Z',
    }, operator, new Date('2026-07-20T00:00:00.000Z'))).toThrow(
      'expiresAt must be between 61 minutes and 90 days from now.'
    );
    expect(() => normalizeCancelCustomPlanOfferInput({
      offerId: 'bad-id',
      reason: 'operator request',
    }, operator)).toThrow('offerId must be a valid UUID.');
    expect(() => normalizeCancelCustomPlanOfferInput({
      offerId,
      reason: 'no',
    }, operator)).toThrow('reason must contain 4-500 printable characters.');
    expect(isCustomPlanOfferId(offerId)).toBe(true);
    expect(isCustomPlanOfferId('../offer')).toBe(false);
    expect(() => normalizeCreateCustomPlanOfferInput({
      orgId,
      title: '#1',
      amountTwd: 899,
      expiresAt: '2026-07-27T00:00:00.000Z',
    }, operator, new Date('2026-07-20T00:00:00.000Z'))).toThrow(
      'title cannot contain the ECPay item separator #.'
    );
  });
});

describe('custom plan offer repository', () => {
  it('creates and cancels offers only through service-role RPC contracts', async () => {
    const fake = queryClient({});
    const repository = createCustomPlanOfferRepository(fake.client);
    await expect(repository.createOffer({
      orgId,
      actorUserId,
      actorMetadata,
      title: '專屬入門方案',
      description: null,
      amountTwd: 899,
      expiresAt: '2026-07-27T12:00:00.000Z',
    })).resolves.toMatchObject({ id: offerId, amountTwd: 899, plan: 'basic' });
    expect(fake.rpc).toHaveBeenNthCalledWith(1, 'create_custom_plan_offer', {
      p_org_id: orgId,
      p_actor_user_id: actorUserId,
      p_actor_metadata: {
        actor_kind: 'authenticated_platform_admin',
        actor_fingerprint_sha256: 'a'.repeat(64),
        platform_role: 'billing',
      },
      p_title: '專屬入門方案',
      p_description: null,
      p_amount_twd: 899,
      p_expires_at: '2026-07-27T12:00:00.000Z',
    });

    fake.rpc.mockResolvedValueOnce({
      data: {
        ...offerRow,
        status: 'cancelled',
        cancelled_by: actorUserId,
        cancelled_at: '2026-07-20T13:00:00.000Z',
        cancellation_reason: 'customer no longer needs it',
      },
      error: null,
    });
    await expect(repository.cancelOffer({
      offerId,
      actorUserId,
      actorMetadata,
      reason: 'customer no longer needs it',
    })).resolves.toMatchObject({ status: 'cancelled' });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, 'cancel_custom_plan_offer', {
      p_offer_id: offerId,
      p_actor_user_id: actorUserId,
      p_actor_metadata: {
        actor_kind: 'authenticated_platform_admin',
        actor_fingerprint_sha256: 'a'.repeat(64),
        platform_role: 'billing',
      },
      p_reason: 'customer no longer needs it',
    });
  });

  it('lists normalized offers and reports an unapplied schema as unavailable', async () => {
    const fake = queryClient({ rows: [offerRow] });
    await expect(
      createCustomPlanOfferRepository(fake.client).listOffers({ orgId, limit: 10 })
    ).resolves.toEqual([
      expect.objectContaining({ id: offerId, orgId, amountTwd: 899 }),
    ]);
    expect(fake.builder.eq).toHaveBeenCalledWith('org_id', orgId);
    expect(fake.builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(fake.builder.limit).toHaveBeenCalledWith(10);

    const missing = queryClient({
      rows: null,
      queryError: { code: '42P01', message: 'relation custom_plan_offers does not exist' },
    });
    await expect(
      createCustomPlanOfferRepository(missing.client).listOffers({ orgId })
    ).rejects.toMatchObject({
      code: 'feature_disabled',
      status: 503,
      message: 'Custom plan offers require SaaS database migration 049.',
    });
  });

  it.each([
    {
      code: 'PGRST202',
      message: 'Could not find the function public.create_custom_plan_offer in the schema cache',
    },
    {
      code: '42883',
      message: 'function cancel_custom_plan_offer(uuid, uuid, jsonb, text) does not exist',
    },
  ])('reports missing custom-offer RPCs as unavailable ($code)', async ({ code, message }) => {
    const fake = queryClient({
      rpc: async () => ({
        data: null,
        error: { code, message },
      }),
    });
    const repository = createCustomPlanOfferRepository(fake.client);

    await expect(repository.createOffer({
      orgId,
      actorUserId,
      actorMetadata,
      title: '專屬入門方案',
      description: null,
      amountTwd: 899,
      expiresAt: '2026-07-27T12:00:00.000Z',
    })).rejects.toMatchObject({
      code: 'feature_disabled',
      status: 503,
    });
  });

  it('creates checkout without accepting an amount, then loads SELECT-star metadata', async () => {
    const fake = queryClient({
      rows: orderRow,
      rpc: async () => ({ data: orderRow, error: null }),
    });
    const repository = createCustomPlanOfferRepository(fake.client);
    await expect(repository.createPaymentOrder({
      offerId,
      orgId,
      actorUserId,
      provider: 'ecpay',
      providerMode: 'test',
      merchantId: '3002607',
      merchantTradeNo: 'SRCUSTOM26072001',
      idempotencyKey: 'custom-offer-checkout-0001',
    })).resolves.toMatchObject({
      id: paymentOrderId,
      amountTwd: 899,
      metadata: {
        pricing_kind: 'custom_offer',
        custom_offer_id: offerId,
      },
    });
    const [, args] = fake.rpc.mock.calls[0]!;
    expect(fake.rpc).toHaveBeenCalledWith('create_custom_plan_payment_order',
      expect.objectContaining({
        p_offer_id: offerId,
        p_org_id: orgId,
        p_actor_user_id: actorUserId,
      })
    );
    expect(args).not.toHaveProperty('p_amount_twd');
    expect(fake.select).toHaveBeenCalledWith('*');
    expect(fake.builder.eq).toHaveBeenCalledWith('id', paymentOrderId);
  });

  it('maps structured offer and durable rate-limit failures to safe typed errors', async () => {
    const rateLimited = queryClient({
      rpc: async () => ({
        data: {
          status: 'rate_limited',
          error_code: 'checkout_rate_limited',
          retry_after_seconds: 73,
        },
        error: null,
      }),
    });
    const input = {
      offerId,
      orgId,
      actorUserId,
      provider: 'ecpay' as const,
      providerMode: 'test' as const,
      merchantId: '3002607',
      merchantTradeNo: 'SRCUSTOM26072001',
      idempotencyKey: 'custom-offer-checkout-0001',
    };
    await expect(
      createCustomPlanOfferRepository(rateLimited.client).createPaymentOrder(input)
    ).rejects.toMatchObject({
      code: 'checkout_rate_limited',
      status: 429,
      retryAfterSeconds: 73,
    });

    const expired = queryClient({
      rpc: async () => ({
        data: { status: 'offer_unavailable', error_code: 'offer_expired' },
        error: null,
      }),
    });
    await expect(
      createCustomPlanOfferRepository(expired.client).createPaymentOrder(input)
    ).rejects.toMatchObject({ code: 'offer_unavailable', status: 409 });

    const checkoutClosed = queryClient({
      rpc: async () => ({
        data: {
          status: 'offer_unavailable',
          error_code: 'offer_checkout_closed',
          payment_order_id: paymentOrderId,
        },
        error: null,
      }),
    });
    await expect(
      createCustomPlanOfferRepository(checkoutClosed.client).createPaymentOrder(input)
    ).rejects.toMatchObject({
      code: 'offer_unavailable',
      status: 409,
      message: 'This custom plan offer is no longer available.',
    });
  });
});
