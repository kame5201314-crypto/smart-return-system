/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleListPlatformBillingEvents } from '@/app/api/internal/saas/billing/events/route';
import { handleGetPlatformOrganization } from '@/app/api/internal/saas/orgs/[id]/route';
import { handleListPlatformOrganizations } from '@/app/api/internal/saas/orgs/route';
import type { PlatformAdminDataRepository } from '@/lib/saas/platform-admin-data';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

const platformAdminContext: PlatformAdminContext = {
  userId: 'admin-1',
  isPlatformAdmin: true,
  featureFlags: resolveSaaSFeatureFlags({
    env: {
      ENABLE_MULTI_TENANT_ADMIN: 'true',
    },
    orgPlan: 'enterprise',
  }),
};

function buildRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function createRepository(): PlatformAdminDataRepository {
  return {
    listOrganizations: vi.fn(async () => [
      {
        id: 'org-1',
        name: 'Demo Org',
        slug: 'demo-org',
        plan: 'growth',
        status: 'active',
        ownerEmail: 'owner@example.com',
        memberCount: 3,
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ]),
    getOrganization: vi.fn(async () => ({
      id: 'org-1',
      name: 'Demo Org',
      slug: 'demo-org',
      plan: 'growth',
      status: 'active',
      ownerEmail: 'owner@example.com',
      memberCount: 3,
      createdAt: '2026-05-20T00:00:00.000Z',
      featureFlags: {},
      billingEmail: 'billing@example.com',
      taxId: '12345678',
      members: [
        {
          id: 'member-1',
          email: 'owner@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
    })),
    listBillingEvents: vi.fn(async () => [
      {
        id: 'event-1',
        orgId: 'org-1',
        provider: 'ecpay',
        eventType: 'period_paid',
        status: 'processed',
        providerEventId: 'trade-1',
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ]),
    listOrganizationUsage: vi.fn(async () => ({
      'org-1': {
        returnsThisMonth: 12,
        aiUsedThisMonth: 4,
      },
    })),
    listOrganizationNames: vi.fn(async () => ({
      'org-1': 'Demo Org',
    })),
    listAuditLogs: vi.fn(async () => [
      {
        id: 'audit-1',
        action: 'org.created',
        actorEmail: null,
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ]),
  };
}

describe('SaaS platform admin API routes', () => {
  it('blocks organization list access before querying data when the platform flag is closed', async () => {
    const repository = createRepository();
    const response = await handleListPlatformOrganizations(
      buildRequest('/api/internal/saas/orgs'),
      {
        requireAccess: async () => {
          throw new PlatformAdminAccessError(
            'feature_disabled',
            403,
            'The multi-tenant admin feature flag is disabled.'
          );
        },
        repository,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'feature_disabled',
    });
    expect(repository.listOrganizations).not.toHaveBeenCalled();
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
  });

  it('lists organizations for platform admins and clamps limit to 100', async () => {
    const repository = createRepository();
    const response = await handleListPlatformOrganizations(
      buildRequest('/api/internal/saas/orgs?limit=999'),
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        organizations: [
          {
            id: 'org-1',
            plan: 'growth',
            usage: {
              returnsThisMonth: 12,
              aiUsedThisMonth: 4,
            },
          },
        ],
      },
    });
    expect(repository.listOrganizations).toHaveBeenCalledWith({ limit: 100 });
    expect(repository.listOrganizationUsage).toHaveBeenCalledWith({
      orgIds: ['org-1'],
      periodStart: expect.any(String),
    });
  });

  it('loads organization detail for platform admins', async () => {
    const repository = createRepository();
    const response = await handleGetPlatformOrganization(
      buildRequest('/api/internal/saas/orgs/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        organization: {
          id: 'org-1',
          usage: {
            returnsThisMonth: 12,
            aiUsedThisMonth: 4,
          },
        },
        members: [
          {
            role: 'owner',
          },
        ],
      },
    });
    expect(repository.getOrganization).toHaveBeenCalledWith({ orgId: 'org-1' });
    expect(repository.listOrganizationUsage).toHaveBeenCalledWith({
      orgIds: ['org-1'],
      periodStart: expect.any(String),
    });
    expect(repository.listAuditLogs).toHaveBeenCalledWith({
      orgId: 'org-1',
      limit: 20,
    });
  });

  it('returns 404 when an organization does not exist', async () => {
    const repository = createRepository();
    vi.mocked(repository.getOrganization).mockResolvedValueOnce(null);

    const response = await handleGetPlatformOrganization(
      buildRequest('/api/internal/saas/orgs/missing-org'),
      { params: Promise.resolve({ id: 'missing-org' }) },
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      error: 'Organization not found',
    });
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
  });

  it('lists billing events for platform admins', async () => {
    const repository = createRepository();
    const response = await handleListPlatformBillingEvents(
      buildRequest('/api/internal/saas/billing/events?limit=10'),
      {
        requireAccess: async () => platformAdminContext,
        repository,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        events: [
          {
            id: 'event-1',
            orgName: 'Demo Org',
            provider: 'ecpay',
            status: 'processed',
          },
        ],
      },
    });
    expect(repository.listBillingEvents).toHaveBeenCalledWith({ limit: 10 });
    expect(repository.listOrganizationNames).toHaveBeenCalledWith({ orgIds: ['org-1'] });
  });

  it('does not serve platform organization DTOs when usage snapshots are missing', async () => {
    const repository = createRepository();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(repository.listOrganizationUsage).mockResolvedValueOnce({});

    try {
      const response = await handleListPlatformOrganizations(
        buildRequest('/api/internal/saas/orgs'),
        {
          requireAccess: async () => platformAdminContext,
          repository,
        }
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        success: false,
        error: 'Failed to load organizations',
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
