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
  createPlatformTenantPreviewAuditRepository,
  createPlatformTenantPreviewToken,
  loadPlatformTenantPreviewMode,
  PLATFORM_TENANT_PREVIEW_COOKIE,
  type PlatformTenantPreviewAuditRepository,
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

const auditLogId = '33333333-3333-4333-8333-333333333333';

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

function createAuditRepository(): PlatformTenantPreviewAuditRepository {
  return {
    recordPreviewAudit: vi.fn(async () => ({
      auditLogId,
    })),
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
    const auditRepository = createAuditRepository();

    const response = await handleStartPlatformTenantPreview(' org-1 ', {
      requireAccess: async () => platformAdminContext,
      repository,
      auditRepository,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        orgName: 'Demo Store',
        previewPath: '/analytics',
        auditLogId,
      },
    });
    expect(response.headers.get('set-cookie')).toContain(PLATFORM_TENANT_PREVIEW_COOKIE);
    expect(repository.getOrganization).toHaveBeenCalledWith({ orgId: 'org-1' });
    expect(auditRepository.recordPreviewAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'platform.tenant_preview_started',
      access: platformAdminContext,
      target: {
        orgId: '11111111-1111-4111-8111-111111111111',
        orgName: 'Demo Store',
        orgSlug: 'demo-store',
      },
      reason: 'started',
    }));
  });

  it('does not query organizations when platform admin access is denied', async () => {
    const repository = createRepository();
    const auditRepository = createAuditRepository();

    const response = await handleStartPlatformTenantPreview('org-1', {
      requireAccess: async () => {
        throw new PlatformAdminAccessError(
          'permission_denied',
          403,
          'Platform admin permission is required: view_organizations.'
        );
      },
      repository,
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'permission_denied',
    });
    expect(repository.getOrganization).not.toHaveBeenCalled();
    expect(auditRepository.recordPreviewAudit).not.toHaveBeenCalled();
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
    const auditRepository = createAuditRepository();
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
      getToken: token,
      auditRepository,
    });
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.headers.get('set-cookie')).toContain(PLATFORM_TENANT_PREVIEW_COOKIE);
    await expect(clearResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        state: 'hidden',
        reason: 'cleared',
        auditLogId,
      },
    });
    expect(auditRepository.recordPreviewAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'platform.tenant_preview_cleared',
      access: platformAdminContext,
      target: {
        orgId: 'org-1',
        orgName: 'Demo Store',
        orgSlug: null,
      },
      reason: 'cleared',
    }));
  });

  it('wraps the service-role audit insert for tenant preview events', async () => {
    const insertedRows: Record<string, unknown>[] = [];
    const insertBuilder = {
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: { id: auditLogId },
          error: null,
        })),
      })),
    };
    const tableBuilder = {
      insert: vi.fn((row: Record<string, unknown>) => {
        insertedRows.push(row);
        return insertBuilder;
      }),
    };
    const client = {
      from: vi.fn(() => tableBuilder),
    };
    const repository = createPlatformTenantPreviewAuditRepository(client as never);

    await expect(repository.recordPreviewAudit({
      action: 'platform.tenant_preview_started',
      access: platformAdminContext,
      target: {
        orgId: 'org-1',
        orgName: 'Demo Store',
        orgSlug: 'demo-store',
      },
      previewExpiresAt: '2026-05-26T01:00:00.000Z',
      reason: 'started',
    })).resolves.toEqual({ auditLogId });

    expect(client.from).toHaveBeenCalledWith('audit_logs');
    expect(tableBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      org_id: 'org-1',
      actor_user_id: platformAdminContext.userId,
      action: 'platform.tenant_preview_started',
      target_type: 'organization',
      target_id: 'org-1',
      metadata: expect.objectContaining({
        actor_user_id: platformAdminContext.userId,
        actor_email: 'owner@example.com',
        platform_role: 'owner',
        org_name: 'Demo Store',
      }),
    }));
    expect(insertedRows).toHaveLength(1);
  });
});
