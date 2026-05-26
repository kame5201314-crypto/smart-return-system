/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  handleStartPlatformTenantPreview,
} from '@/app/api/internal/saas/orgs/[id]/preview/route';
import {
  handleClearPlatformTenantPreview,
  handleGetPlatformTenantPreview,
} from '@/app/api/internal/saas/tenant-preview/route';
import {
  createPlatformTenantPreviewToken,
  loadPlatformTenantPreviewMode,
  PLATFORM_TENANT_PREVIEW_COOKIE,
  verifyPlatformTenantPreviewToken,
} from '@/lib/saas/platform-tenant-preview';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import type { PlatformAdminDataRepository } from '@/lib/saas/platform-admin-data';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';

const platformAdminContext: PlatformAdminContext = {
  userId: '22222222-2222-4222-8222-222222222222',
  userEmail: 'owner@example.com',
  isPlatformAdmin: true,
  platformRole: 'owner',
  permissions: getPlatformAdminPermissions('owner'),
  featureFlags: resolveSaaSFeatureFlags({
    env: {
      ENABLE_MULTI_TENANT_ADMIN: 'true',
    },
    orgPlan: 'enterprise',
  }),
};

function createRepository(): PlatformAdminDataRepository {
  return {
    listOrganizations: vi.fn(async () => []),
    getOrganization: vi.fn(async () => ({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Demo Store',
      slug: 'demo-store',
      plan: 'growth',
      status: 'active',
      ownerEmail: 'owner@example.com',
      memberCount: 2,
      createdAt: '2026-05-26T00:00:00.000Z',
      featureFlags: {},
      billingEmail: null,
      taxId: null,
      members: [],
    })),
    listBillingEvents: vi.fn(async () => []),
    listOrganizationUsage: vi.fn(async () => ({})),
    listOrganizationSubscriptions: vi.fn(async () => ({})),
    listOrganizationNames: vi.fn(async () => ({})),
    listAuditLogs: vi.fn(async () => []),
  };
}

describe('SaaS platform tenant preview', () => {
  it('creates and verifies a signed tenant preview token', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'tenant-preview-secret');

    const { token, payload } = await createPlatformTenantPreviewToken({
      access: platformAdminContext,
      organization: {
        id: 'org-1',
        name: 'Demo Store',
        slug: 'demo-store',
      },
      now: new Date('2026-05-26T00:00:00.000Z'),
    });

    await expect(
      verifyPlatformTenantPreviewToken(token, new Date('2026-05-26T00:10:00.000Z'))
    ).resolves.toMatchObject({
      orgId: 'org-1',
      orgName: 'Demo Store',
      adminUserId: platformAdminContext.userId,
      platformRole: 'owner',
    });
    await expect(
      verifyPlatformTenantPreviewToken(token, new Date((payload.exp + 1) * 1000))
    ).resolves.toBeNull();
  });

  it('starts preview only after platform admin access and organization lookup pass', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'tenant-preview-secret');
    const repository = createRepository();

    const response = await handleStartPlatformTenantPreview(' org-1 ', {
      requireAccess: async () => platformAdminContext,
      repository,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        orgName: 'Demo Store',
        previewPath: '/analytics',
      },
    });
    expect(response.headers.get('set-cookie')).toContain(PLATFORM_TENANT_PREVIEW_COOKIE);
    expect(repository.getOrganization).toHaveBeenCalledWith({ orgId: 'org-1' });
  });

  it('does not query organizations when platform admin access is denied', async () => {
    const repository = createRepository();

    const response = await handleStartPlatformTenantPreview('org-1', {
      requireAccess: async () => {
        throw new PlatformAdminAccessError(
          'permission_denied',
          403,
          'Platform admin permission is required: view_organizations.'
        );
      },
      repository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'permission_denied',
    });
    expect(repository.getOrganization).not.toHaveBeenCalled();
  });

  it('loads ready preview mode for signed cookies after admin access passes', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'tenant-preview-secret');
    const { token } = await createPlatformTenantPreviewToken({
      access: platformAdminContext,
      organization: {
        id: 'org-1',
        name: 'Demo Store',
        slug: 'demo-store',
      },
      now: new Date('2026-05-26T00:00:00.000Z'),
    });

    const result = await loadPlatformTenantPreviewMode({
      requireAccess: async () => platformAdminContext,
      getToken: token,
      now: new Date('2026-05-26T00:01:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      preview: {
        orgId: 'org-1',
        orgName: 'Demo Store',
        exitPath: '/internal/orgs',
      },
    });
  });

  it('returns hidden preview mode for missing or invalid tokens', async () => {
    await expect(
      loadPlatformTenantPreviewMode({
        requireAccess: async () => platformAdminContext,
        getToken: null,
      })
    ).resolves.toEqual({
      state: 'hidden',
      reason: 'missing',
    });

    await expect(
      loadPlatformTenantPreviewMode({
        requireAccess: async () => platformAdminContext,
        getToken: 'invalid-token',
      })
    ).resolves.toEqual({
      state: 'hidden',
      reason: 'invalid',
    });
  });

  it('exposes guarded preview state and clear handlers for future UI', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'tenant-preview-secret');
    const { token } = await createPlatformTenantPreviewToken({
      access: platformAdminContext,
      organization: {
        id: 'org-1',
        name: 'Demo Store',
        slug: null,
      },
    });

    const getResponse = await handleGetPlatformTenantPreview({
      requireAccess: async () => platformAdminContext,
      getToken: token,
    });
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        state: 'ready',
      },
    });

    const clearResponse = await handleClearPlatformTenantPreview({
      requireAccess: async () => platformAdminContext,
    });
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.headers.get('set-cookie')).toContain(PLATFORM_TENANT_PREVIEW_COOKIE);
    await expect(clearResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        state: 'hidden',
        reason: 'cleared',
      },
    });
  });
});
