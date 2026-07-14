import { describe, expect, it, vi } from 'vitest';

import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import {
  loadBillingSettingsView,
  loadTeamSettingsView,
  loadUsageSettingsView,
  type SettingsLiveDataDependencies,
} from '@/lib/saas/settings-live-data';
import {
  SaaSOrgContextError,
  type SaaSOrgContext,
} from '@/lib/saas/org-context';

function buildContext(overrides: Partial<SaaSOrgContext> = {}): SaaSOrgContext {
  return {
    userId: 'user-1',
    orgId: 'org-1',
    orgName: 'Demo Store',
    orgSlug: 'demo-store',
    orgStatus: 'active',
    role: 'owner',
    plan: 'growth',
    planDefinition: getSaaSPlanDefinition('growth'),
    featureFlags: {
      public_signup: false,
      public_lead_capture: false,
      google_auth: false,
      google_trial_signup: false,
      billing: true,
      subscription_plan: false,
      ai_usage_limit: true,
      advanced_analytics: true,
      multi_tenant_admin: false,
      image_ai: false,
    },
    isPlatformAdmin: false,
    ...overrides,
  };
}

function createBaseDeps(context: SaaSOrgContext = buildContext()): SettingsLiveDataDependencies {
  return {
    getContext: vi.fn(async () => context),
  };
}

describe('SaaS settings live data loaders', () => {
  it('loads billing settings through org-scoped repositories', async () => {
    const getContext = vi.fn(async () => buildContext());
    const billingRepository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'Demo Store',
        plan: 'growth',
        status: 'active',
        billingEmail: 'billing@example.com',
        taxId: '12345678',
      })),
      getSubscription: vi.fn(async () => ({
        provider: 'manual',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      })),
      getLatestInvoice: vi.fn(async () => ({
        id: 'invoice-1',
        status: 'issued',
      })),
    };

    await expect(
      loadBillingSettingsView({
        getContext,
        billingRepository,
      })
    ).resolves.toMatchObject({
      state: 'ready',
      data: {
        org: {
          id: 'org-1',
          plan: 'growth',
        },
        invoiceSummary: {
          latestInvoiceStatus: 'issued',
          billingEmail: 'billing@example.com',
        },
      },
      context: {
        orgId: 'org-1',
        role: 'owner',
      },
    });

    expect(getContext).toHaveBeenCalledWith({
      requirements: {
        roles: ['owner', 'admin'],
        feature: 'billing',
      },
    });
    expect(billingRepository.getOrganizationBilling).toHaveBeenCalledWith({
      orgId: 'org-1',
    });
    expect(billingRepository.getSubscription).toHaveBeenCalledWith({
      orgId: 'org-1',
    });
    expect(billingRepository.getLatestInvoice).toHaveBeenCalledWith({
      orgId: 'org-1',
    });
  });

  it('maps feature guard failures to gated settings state', async () => {
    const result = await loadBillingSettingsView({
      getContext: vi.fn(async () => {
        throw new SaaSOrgContextError(
          'feature_forbidden',
          403,
          'SaaS feature billing is not enabled for this org.'
        );
      }),
      billingRepository: {
        getOrganizationBilling: vi.fn(),
        getSubscription: vi.fn(),
        getLatestInvoice: vi.fn(),
      },
    });

    expect(result).toEqual({
      state: 'gated',
      data: null,
      gated: {
        reason: 'feature_disabled',
        message: 'SaaS feature billing is not enabled for this org.',
      },
    });
  });

  it('loads usage settings for the authenticated organization and month', async () => {
    const now = new Date('2026-05-21T10:00:00.000Z');
    const usageRepository = {
      getOrganizationPlan: vi.fn(async () => ({
        id: 'org-1',
        plan: 'growth',
      })),
      listMembers: vi.fn(async () => [
        {
          id: 'member-1',
          status: 'active',
        },
      ]),
      listInvites: vi.fn(async () => [
        {
          id: 'invite-1',
          status: 'pending' as const,
        },
      ]),
      listReturns: vi.fn(async () => [{ id: 'return-1' }, { id: 'return-2' }]),
      listAIUsage: vi.fn(async () => [{ id: 'ai-1' }]),
    };

    const result = await loadUsageSettingsView({
      ...createBaseDeps(),
      usageRepository,
      now,
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        plan: {
          code: 'growth',
        },
        usage: {
          seatsUsed: 2,
          returnsThisMonth: 2,
          aiUsedThisMonth: 1,
          periodStart: '2026-05-01T00:00:00.000Z',
          periodEnd: '2026-06-01T00:00:00.000Z',
        },
      },
    });
    expect(usageRepository.listInvites).toHaveBeenCalledWith({
      orgId: 'org-1',
      now,
    });
    expect(usageRepository.listReturns).toHaveBeenCalledWith({
      orgId: 'org-1',
      period: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
    });
  });

  it('loads team settings while disabling manager actions for viewers', async () => {
    const teamRepository = {
      getOrganizationPlan: vi.fn(async () => ({
        id: 'org-1',
        plan: 'basic',
      })),
      listMembers: vi.fn(async () => [
        {
          id: 'member-1',
          email: 'viewer@example.com',
          displayName: null,
          role: 'viewer',
          status: 'active',
          joinedAt: '2026-05-01T00:00:00.000Z',
        },
      ]),
      listInvites: vi.fn(async () => []),
    };

    const result = await loadTeamSettingsView({
      ...createBaseDeps(
        buildContext({
          role: 'viewer',
        })
      ),
      teamRepository,
      now: new Date('2026-05-21T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        orgId: 'org-1',
        actions: {
          canInvite: false,
          canChangeRoles: false,
          disabledReason: 'Owner or admin role is required to manage team settings.',
        },
      },
    });
  });

  it('returns empty state instead of serving fake data when repositories miss the org', async () => {
    const result = await loadUsageSettingsView({
      ...createBaseDeps(),
      usageRepository: {
        getOrganizationPlan: vi.fn(async () => null),
        listMembers: vi.fn(async () => []),
        listInvites: vi.fn(async () => []),
        listReturns: vi.fn(async () => []),
        listAIUsage: vi.fn(async () => []),
      },
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: 'No usage settings were found for this organization.',
      context: {
        orgId: 'org-1',
      },
    });
  });

  it('maps repository failures to error state without throwing through UI loaders', async () => {
    const result = await loadTeamSettingsView({
      ...createBaseDeps(),
      teamRepository: {
        getOrganizationPlan: vi.fn(async () => {
          throw new Error('team query failed');
        }),
        listMembers: vi.fn(async () => []),
        listInvites: vi.fn(async () => []),
      },
    });

    expect(result).toEqual({
      state: 'error',
      data: null,
      message: 'team query failed',
    });
  });
});
