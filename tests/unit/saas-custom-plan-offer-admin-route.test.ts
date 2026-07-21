/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  handleCancelCustomPlanOffer,
  handleCreateCustomPlanOffer,
  handleListCustomPlanOffers,
} from '@/app/api/internal/saas/custom-plan-offers/route';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import type { CustomPlanOfferRepository } from '@/lib/saas/custom-plan-offers';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';

const orgId = '11111111-1111-4111-8111-111111111111';
const offerId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '33333333-3333-4333-8333-333333333333';

const access: PlatformAdminContext = {
  userId: actorUserId,
  userEmail: 'billing@example.com',
  isPlatformAdmin: true,
  platformRole: 'billing',
  permissions: getPlatformAdminPermissions('billing'),
  featureFlags: resolveSaaSFeatureFlags({
    env: { ENABLE_MULTI_TENANT_ADMIN: 'true' },
    orgPlan: 'enterprise',
  }),
};

const offer = {
  id: offerId,
  orgId,
  title: '朋友測試專案',
  description: '一次預付一個月。',
  amountTwd: 899,
  plan: 'basic',
  billingPeriodMonths: 1,
  status: 'active',
  expiresAt: '2026-07-27T12:00:00.000Z',
  paymentOrderId: null,
  createdBy: actorUserId,
  cancelledBy: null,
  cancellationReason: null,
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
};

function createRepository() {
  return {
    createOffer: vi.fn(async () => offer),
    cancelOffer: vi.fn(async () => ({ ...offer, status: 'cancelled' })),
    listOffers: vi.fn(async () => [offer]),
    createPaymentOrder: vi.fn(),
  } as unknown as CustomPlanOfferRepository;
}

describe('custom plan offer internal API', () => {
  it('lists offers only after platform billing access is granted', async () => {
    const repository = createRepository();
    const response = await handleListCustomPlanOffers(
      new NextRequest(`http://localhost/api/internal/saas/custom-plan-offers?orgId=${orgId}`),
      { requireAccess: async () => access, repository }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({
      success: true,
      data: { offers: [{ id: offerId, orgId, amountTwd: 899 }] },
    });
    expect(repository.listOffers).toHaveBeenCalledWith({ orgId, limit: 20 });
  });

  it('checks access before parsing tenant input or reading offers', async () => {
    const repository = createRepository();
    const response = await handleListCustomPlanOffers(
      new NextRequest('http://localhost/api/internal/saas/custom-plan-offers?orgId=invalid'),
      {
        requireAccess: async () => {
          throw new PlatformAdminAccessError(
            'permission_denied',
            403,
            'Platform admin permission is required: manage_billing_operations.'
          );
        },
        repository,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ success: false, code: 'permission_denied' });
    expect(repository.listOffers).not.toHaveBeenCalled();
  });

  it('creates a server-validated private offer without accepting payment secrets', async () => {
    const repository = createRepository();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const response = await handleCreateCustomPlanOffer(
      new NextRequest('http://localhost/api/internal/saas/custom-plan-offers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgId,
          title: ' 朋友測試專案 ',
          description: ' 一次預付一個月。 ',
          amountTwd: 899,
          expiresAt,
          merchantId: 'must-not-be-accepted',
          hashKey: 'must-not-be-accepted',
          hashIv: 'must-not-be-accepted',
        }),
      }),
      { requireAccess: async () => access, repository }
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, data: { offer: { id: offerId } } });
    expect(repository.createOffer).toHaveBeenCalledWith(expect.objectContaining({
      orgId,
      actorUserId,
      actorMetadata: expect.objectContaining({
        actorKind: 'authenticated_platform_admin',
        platformRole: 'billing',
        actorFingerprintSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      title: '朋友測試專案',
      description: '一次預付一個月。',
      amountTwd: 899,
    }));
    const input = vi.mocked(repository.createOffer).mock.calls[0]![0] as Record<string, unknown>;
    expect(input).not.toHaveProperty('merchantId');
    expect(input).not.toHaveProperty('hashKey');
    expect(input).not.toHaveProperty('hashIv');
    expect(JSON.stringify(input)).not.toContain(access.userEmail);
  });

  it('rejects invalid pricing before repository writes', async () => {
    const repository = createRepository();
    const response = await handleCreateCustomPlanOffer(
      new NextRequest('http://localhost/api/internal/saas/custom-plan-offers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgId,
          title: '朋友測試專案',
          amountTwd: 1,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      }),
      { requireAccess: async () => access, repository }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, code: 'invalid_request' });
    expect(repository.createOffer).not.toHaveBeenCalled();
  });

  it('cancels an active offer with actor identity and an audit reason', async () => {
    const repository = createRepository();
    const response = await handleCancelCustomPlanOffer(
      new NextRequest('http://localhost/api/internal/saas/custom-plan-offers', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          offerId,
          reason: ' 客戶需求調整，重新報價 ',
        }),
      }),
      { requireAccess: async () => access, repository }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { offer: { id: offerId, status: 'cancelled' } },
    });
    expect(repository.cancelOffer).toHaveBeenCalledWith({
      offerId,
      actorUserId,
      actorMetadata: expect.objectContaining({
        actorKind: 'authenticated_platform_admin',
        platformRole: 'billing',
        actorFingerprintSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
      reason: '客戶需求調整，重新報價',
    });
  });
});
