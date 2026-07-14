/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleListPlatformBillingEvents } from '@/app/api/internal/saas/billing/events/route';
import { handleGetPlatformOrganization } from '@/app/api/internal/saas/orgs/[id]/route';
import {
  handleCreateManualBetaOrganization,
  handleListPlatformOrganizations,
} from '@/app/api/internal/saas/orgs/route';
import type { PlatformAdminDataRepository } from '@/lib/saas/platform-admin-data';
import type { PlatformOrgProvisioningRepository } from '@/lib/saas/platform-admin-provisioning';
import {
  buildManualBetaOrganizationRpcArgs,
  createPlatformOrgProvisioningRepository,
  normalizeManualBetaOrganizationInput,
} from '@/lib/saas/platform-admin-provisioning';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

const platformAdminContext: PlatformAdminContext = {
  userId: 'admin-1',
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

function buildRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function buildJsonRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
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
    listOrganizationSubscriptions: vi.fn(async () => ({
      'org-1': {
        status: 'active',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: false,
      },
    })),
    listOrganizationSelfServiceTrialClaims: vi.fn(async () => ({})),
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

function createProvisioningRepository(): PlatformOrgProvisioningRepository {
  return {
    createManualBetaOrganization: vi.fn(async () => ({
      orgId: 'org-1',
      subscriptionId: 'subscription-1',
      ownerMembershipId: 'member-1',
      auditLogId: 'audit-1',
    })),
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

  it('blocks manual Beta organization provisioning before reading or persisting when the platform flag is closed', async () => {
    const provisioningRepository = createProvisioningRepository();
    const response = await handleCreateManualBetaOrganization(
      new NextRequest('http://localhost/api/internal/saas/orgs', {
        method: 'POST',
        body: '{bad json',
      }),
      {
        requireAccess: async () => {
          throw new PlatformAdminAccessError(
            'feature_disabled',
            403,
            'The multi-tenant admin feature flag is disabled.'
          );
        },
        provisioningRepository,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'feature_disabled',
    });
    expect(provisioningRepository.createManualBetaOrganization).not.toHaveBeenCalled();
  });

  it('creates manual Beta organizations for platform admins through the provisioning repository', async () => {
    const provisioningRepository = createProvisioningRepository();
    const response = await handleCreateManualBetaOrganization(
      buildJsonRequest('/api/internal/saas/orgs', {
        orgName: 'Demo Store',
        slug: 'demo-store',
        ownerEmail: 'OWNER@EXAMPLE.COM',
        ownerUserId: '11111111-1111-4111-8111-111111111111',
        plan: 'growth',
        billingEmail: 'BILLING@EXAMPLE.COM',
        taxId: '12345678',
        trialEnd: '2026-06-04',
      }),
      {
        requireAccess: async () => platformAdminContext,
        provisioningRepository,
      }
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        orgId: 'org-1',
        subscriptionId: 'subscription-1',
        ownerMembershipId: 'member-1',
        auditLogId: 'audit-1',
      },
    });
    expect(provisioningRepository.createManualBetaOrganization).toHaveBeenCalledWith({
      orgName: 'Demo Store',
      slug: 'demo-store',
      ownerEmail: 'owner@example.com',
      ownerUserId: '11111111-1111-4111-8111-111111111111',
      plan: 'growth',
      billingEmail: 'billing@example.com',
      taxId: '12345678',
      trialEnd: '2026-06-04T00:00:00.000Z',
      actorUserId: 'admin-1',
    });
  });

  it('rejects invalid manual Beta organization provisioning payloads', async () => {
    const provisioningRepository = createProvisioningRepository();
    const response = await handleCreateManualBetaOrganization(
      buildJsonRequest('/api/internal/saas/orgs', {
        orgName: 'Demo Store',
        slug: 'Bad Slug',
        ownerEmail: 'owner@example.com',
        plan: 'basic',
      }),
      {
        requireAccess: async () => platformAdminContext,
        provisioningRepository,
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'invalid_request',
    });
    expect(provisioningRepository.createManualBetaOrganization).not.toHaveBeenCalled();
  });

  it('maps manual Beta organization inputs to the provisioning RPC payload', () => {
    const input = normalizeManualBetaOrganizationInput(
      {
        orgName: 'Demo Store',
        slug: 'demo-store',
        ownerEmail: 'Owner@Example.com',
        ownerUserId: '11111111-1111-4111-8111-111111111111',
        plan: 'enterprise',
        billingEmail: 'Billing@Example.com',
        taxId: '12345678',
        trialEnd: '2026-06-04',
      },
      'admin-1'
    );

    expect(buildManualBetaOrganizationRpcArgs(input)).toEqual({
      p_org_name: 'Demo Store',
      p_slug: 'demo-store',
      p_plan: 'enterprise',
      p_owner_email: 'owner@example.com',
      p_owner_user_id: '11111111-1111-4111-8111-111111111111',
      p_billing_email: 'billing@example.com',
      p_tax_id: '12345678',
      p_trial_end: '2026-06-04T00:00:00.000Z',
      p_actor_user_id: 'admin-1',
    });
  });

  it('calls the manual Beta provisioning RPC through the repository', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        org_id: 'org-1',
        subscription_id: 'subscription-1',
        owner_membership_id: 'member-1',
        audit_log_id: 'audit-1',
      },
      error: null,
    }));
    const repository = createPlatformOrgProvisioningRepository({ rpc });

    await expect(
      repository.createManualBetaOrganization({
        orgName: 'Demo Store',
        slug: 'demo-store',
        ownerEmail: 'owner@example.com',
        plan: 'basic',
        actorUserId: 'admin-1',
      })
    ).resolves.toEqual({
      orgId: 'org-1',
      subscriptionId: 'subscription-1',
      ownerMembershipId: 'member-1',
      auditLogId: 'audit-1',
    });
    expect(rpc).toHaveBeenCalledWith('create_manual_beta_organization', {
      p_org_name: 'Demo Store',
      p_slug: 'demo-store',
      p_plan: 'basic',
      p_owner_email: 'owner@example.com',
      p_owner_user_id: null,
      p_billing_email: null,
      p_tax_id: null,
      p_trial_end: null,
      p_actor_user_id: 'admin-1',
    });
  });
});
