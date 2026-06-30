/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import {
  PlatformAdminAccessError,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import type { PlatformAdminDataRepository } from '@/lib/saas/platform-admin-data';
import {
  loadPlatformAdminDashboardView,
  loadPlatformAtRiskAlertsView,
  loadPlatformBillingEventsView,
  loadPlatformOrganizationDetailView,
  loadPlatformOrganizationsView,
  loadPlatformTrialConversionView,
} from '@/lib/saas/platform-admin-live-data';

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
      featureFlags: {
        billing: true,
      },
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
    listOrganizationNames: vi.fn(async () => ({
      'org-1': 'Demo Org',
    })),
    listAuditLogs: vi.fn(async () => [
      {
        id: 'audit-1',
        action: 'org.updated',
        actorEmail: 'admin@example.com',
        createdAt: '2026-05-21T00:00:00.000Z',
      },
    ]),
  };
}

describe('SaaS platform admin live data loaders', () => {
  it('loads the platform admin dashboard contract in one guarded data pass', async () => {
    const repository = createRepository();
    const now = new Date('2026-05-25T00:00:00.000Z');

    const result = await loadPlatformAdminDashboardView({
      requireAccess: async () => platformAdminContext,
      repository,
      now,
      organizationLimit: 999,
      billingEventLimit: 10,
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        generatedAt: now.toISOString(),
        organizations: {
          totalOrganizations: 1,
          activeOrTrialingOrganizations: 1,
          estimatedActiveMrrTwd: expect.any(Number),
        },
        atRisk: {
          summary: {
            totalAlerts: 0,
            criticalAlerts: 0,
          },
          topAlerts: [],
        },
        trialConversion: {
          summary: {
            convertedActiveOrganizations: 1,
            conversionRatePercent: 100,
          },
          followUpOrganizations: [],
        },
        billingEvents: {
          summary: {
            totalEvents: 1,
            processedEvents: 1,
          },
          recentEvents: [
            {
              id: 'event-1',
              orgName: 'Demo Org',
              status: 'processed',
            },
          ],
        },
      },
      context: {
        userId: 'admin-1',
        isPlatformAdmin: true,
      },
    });
    expect(repository.listOrganizations).toHaveBeenCalledWith({ limit: 100 });
    expect(repository.listOrganizationUsage).toHaveBeenCalledWith({
      orgIds: ['org-1'],
      periodStart: '2026-05-01T00:00:00.000Z',
    });
    expect(repository.listOrganizationSubscriptions).toHaveBeenCalledWith({
      orgIds: ['org-1'],
    });
    expect(repository.listBillingEvents).toHaveBeenCalledWith({ limit: 10 });
    expect(repository.listOrganizationNames).toHaveBeenCalledWith({ orgIds: ['org-1'] });
  });

  it('returns empty dashboard state before querying dependent snapshots', async () => {
    const repository = createRepository();
    vi.mocked(repository.listOrganizations).mockResolvedValueOnce([]);

    const result = await loadPlatformAdminDashboardView({
      requireAccess: async () => platformAdminContext,
      repository,
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: 'No platform organizations were found.',
    });
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
    expect(repository.listOrganizationSubscriptions).not.toHaveBeenCalled();
    expect(repository.listBillingEvents).not.toHaveBeenCalled();
  });

  it('loads platform organization list after admin access passes', async () => {
    const repository = createRepository();
    const now = new Date('2026-05-22T12:00:00.000Z');

    const result = await loadPlatformOrganizationsView({
      requireAccess: async () => platformAdminContext,
      repository,
      limit: 999,
      now,
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        organizations: [
          {
            id: 'org-1',
            plan: 'growth',
            trialEnd: null,
            daysUntilTrialEnd: null,
            usage: {
              returnsThisMonth: 12,
              aiUsedThisMonth: 4,
            },
          },
        ],
      },
      context: {
        userId: 'admin-1',
        isPlatformAdmin: true,
      },
    });
    expect(repository.listOrganizations).toHaveBeenCalledWith({ limit: 100 });
    expect(repository.listOrganizationUsage).toHaveBeenCalledWith({
      orgIds: ['org-1'],
      periodStart: '2026-05-01T00:00:00.000Z',
    });
    expect(repository.listOrganizationSubscriptions).toHaveBeenCalledWith({
      orgIds: ['org-1'],
    });
  });

  it('returns gated state without querying when multi tenant admin is disabled', async () => {
    const repository = createRepository();

    const result = await loadPlatformOrganizationsView({
      requireAccess: async () => {
        throw new PlatformAdminAccessError(
          'feature_disabled',
          403,
          'The multi-tenant admin feature flag is disabled.'
        );
      },
      repository,
    });

    expect(result).toEqual({
      state: 'gated',
      data: null,
      gated: {
        reason: 'feature_disabled',
        message: 'The multi-tenant admin feature flag is disabled.',
        accessCode: 'feature_disabled',
      },
    });
    expect(repository.listOrganizations).not.toHaveBeenCalled();
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
    expect(repository.listOrganizationSubscriptions).not.toHaveBeenCalled();
  });

  it('marks unauthenticated platform admin access for page-level login redirects', async () => {
    const repository = createRepository();

    const result = await loadPlatformOrganizationsView({
      requireAccess: async () => {
        throw new PlatformAdminAccessError(
          'unauthenticated',
          401,
          'Platform admin authentication is required.'
        );
      },
      repository,
    });

    expect(result).toEqual({
      state: 'gated',
      data: null,
      gated: {
        reason: 'role_required',
        message: 'Platform admin authentication is required.',
        accessCode: 'unauthenticated',
      },
    });
    expect(repository.listOrganizations).not.toHaveBeenCalled();
    expect(repository.listOrganizationSubscriptions).not.toHaveBeenCalled();
  });

  it('returns empty state for platform organization list when no orgs exist', async () => {
    const repository = createRepository();
    vi.mocked(repository.listOrganizations).mockResolvedValueOnce([]);

    const result = await loadPlatformOrganizationsView({
      requireAccess: async () => platformAdminContext,
      repository,
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: 'No platform organizations were found.',
      context: {
        userId: 'admin-1',
      },
    });
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
    expect(repository.listOrganizationSubscriptions).not.toHaveBeenCalled();
  });

  it('loads platform organization detail with usage and audit logs', async () => {
    const repository = createRepository();

    const result = await loadPlatformOrganizationDetailView(' org-1 ', {
      requireAccess: async () => platformAdminContext,
      repository,
      now: new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        organization: {
          id: 'org-1',
          billingEmail: 'billing@example.com',
          trialEnd: null,
          daysUntilTrialEnd: null,
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
        recentAuditLogs: [
          {
            id: 'audit-1',
            action: 'org.updated',
          },
        ],
      },
    });
    expect(repository.getOrganization).toHaveBeenCalledWith({ orgId: 'org-1' });
    expect(repository.listOrganizationSubscriptions).toHaveBeenCalledWith({
      orgIds: ['org-1'],
    });
    expect(repository.listAuditLogs).toHaveBeenCalledWith({
      orgId: 'org-1',
      limit: 20,
    });
  });

  it('returns empty state for invalid or missing organization detail ids', async () => {
    const repository = createRepository();

    const result = await loadPlatformOrganizationDetailView('  ', {
      requireAccess: async () => platformAdminContext,
      repository,
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: 'A valid organization id is required.',
    });
    expect(repository.getOrganization).not.toHaveBeenCalled();
    expect(repository.listOrganizationSubscriptions).not.toHaveBeenCalled();
  });

  it('returns empty state when platform organization detail is not found', async () => {
    const repository = createRepository();
    vi.mocked(repository.getOrganization).mockResolvedValueOnce(null);

    const result = await loadPlatformOrganizationDetailView('missing-org', {
      requireAccess: async () => platformAdminContext,
      repository,
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: 'Organization not found.',
    });
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
    expect(repository.listOrganizationSubscriptions).not.toHaveBeenCalled();
    expect(repository.listAuditLogs).not.toHaveBeenCalled();
  });

  it('loads platform billing events with organization names', async () => {
    const repository = createRepository();

    const result = await loadPlatformBillingEventsView({
      requireAccess: async () => platformAdminContext,
      repository,
      limit: 10,
    });

    expect(result).toMatchObject({
      state: 'ready',
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

  it('loads platform at-risk alerts with usage and subscription snapshots', async () => {
    const repository = createRepository();
    vi.mocked(repository.listOrganizations).mockResolvedValueOnce([
      {
        id: 'org-1',
        name: 'Demo Org',
        slug: 'demo-org',
        plan: 'growth',
        status: 'trialing',
        ownerEmail: 'owner@example.com',
        memberCount: 5,
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ]);
    vi.mocked(repository.listOrganizationUsage).mockResolvedValueOnce({
      'org-1': {
        returnsThisMonth: 800,
        aiUsedThisMonth: 25,
      },
    });
    vi.mocked(repository.listOrganizationSubscriptions).mockResolvedValueOnce({
      'org-1': {
        status: 'trialing',
        currentPeriodEnd: '2026-05-24T00:00:00.000Z',
        trialEnd: '2026-05-24T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
    });

    const result = await loadPlatformAtRiskAlertsView({
      requireAccess: async () => platformAdminContext,
      repository,
      now: new Date('2026-05-25T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        summary: {
          totalAlerts: 4,
          criticalAlerts: 2,
          affectedOrganizations: 1,
        },
        alerts: [
          {
            type: 'trial_expired',
            severity: 'critical',
            daysUntilDue: -1,
          },
          {
            type: 'ai_100',
            severity: 'critical',
          },
          {
            type: 'returns_100',
            severity: 'warning',
          },
          {
            type: 'seats_full',
            severity: 'warning',
          },
        ],
      },
    });
    expect(repository.listOrganizations).toHaveBeenCalledWith({ limit: 50 });
    expect(repository.listOrganizationUsage).toHaveBeenCalledWith({
      orgIds: ['org-1'],
      periodStart: '2026-05-01T00:00:00.000Z',
    });
    expect(repository.listOrganizationSubscriptions).toHaveBeenCalledWith({
      orgIds: ['org-1'],
    });
  });

  it('loads platform trial conversion with subscription snapshots only', async () => {
    const repository = createRepository();
    vi.mocked(repository.listOrganizations).mockResolvedValueOnce([
      {
        id: 'org-1',
        name: 'Demo Org',
        slug: 'demo-org',
        plan: 'growth',
        status: 'trialing',
        ownerEmail: 'owner@example.com',
        memberCount: 3,
        createdAt: '2026-05-20T00:00:00.000Z',
        onboardingCompletedAt: null,
      },
      {
        id: 'org-2',
        name: 'Active Org',
        slug: 'active-org',
        plan: 'enterprise',
        status: 'active',
        ownerEmail: 'active@example.com',
        memberCount: 4,
        createdAt: '2026-05-18T00:00:00.000Z',
        onboardingCompletedAt: '2026-05-19T00:00:00.000Z',
      },
    ]);
    vi.mocked(repository.listOrganizationSubscriptions).mockResolvedValueOnce({
      'org-1': {
        status: 'trialing',
        currentPeriodEnd: '2026-05-28T00:00:00.000Z',
        trialEnd: '2026-05-28T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      'org-2': {
        status: 'active',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        trialEnd: '2026-05-20T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
    });

    const result = await loadPlatformTrialConversionView({
      requireAccess: async () => platformAdminContext,
      repository,
      now: new Date('2026-05-25T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        summary: {
          trialingOrganizations: 1,
          trialEndingSoonOrganizations: 1,
          convertedActiveOrganizations: 1,
          expiredTrialOrganizations: 0,
          onboardingIncompleteOrganizations: 1,
          conversionRatePercent: 50,
        },
        organizations: [
          {
            orgId: 'org-1',
            lifecycleState: 'trial_ending',
            needsFollowUp: true,
          },
          {
            orgId: 'org-2',
            lifecycleState: 'converted_active',
            needsFollowUp: false,
          },
        ],
      },
    });
    expect(repository.listOrganizationSubscriptions).toHaveBeenCalledWith({
      orgIds: ['org-1', 'org-2'],
    });
    expect(repository.listOrganizationUsage).not.toHaveBeenCalled();
  });

  it('returns empty state for platform billing events when no events exist', async () => {
    const repository = createRepository();
    vi.mocked(repository.listBillingEvents).mockResolvedValueOnce([]);

    const result = await loadPlatformBillingEventsView({
      requireAccess: async () => platformAdminContext,
      repository,
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: 'No platform billing events were found.',
    });
    expect(repository.listOrganizationNames).not.toHaveBeenCalled();
  });

  it('returns error state for repository or DTO failures', async () => {
    const repository = createRepository();
    vi.mocked(repository.listOrganizationUsage).mockResolvedValueOnce({});

    const result = await loadPlatformOrganizationsView({
      requireAccess: async () => platformAdminContext,
      repository,
    });

    expect(result).toEqual({
      state: 'error',
      data: null,
      message: 'Missing usage snapshot for organization: org-1',
    });
  });
});
