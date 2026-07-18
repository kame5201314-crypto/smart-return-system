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
      google_auth_ui: false,
      google_trial_signup: false,
      email_otp_signup: false,
      phone_otp_signup: false,
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
        trialEnd: null,
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

  it('shows account and trial status while online billing actions are disabled', async () => {
    const context = buildContext({
      orgStatus: 'trialing',
      featureFlags: {
        ...buildContext().featureFlags,
        billing: false,
      },
    });
    const billingRepository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'Trial Store',
        plan: 'basic',
        status: 'trialing',
        billingEmail: 'owner@example.com',
        taxId: null,
      })),
      getSubscription: vi.fn(async () => ({
        provider: 'manual',
        currentPeriodStart: '2026-07-18T00:00:00.000Z',
        currentPeriodEnd: '2026-07-21T00:00:00.000Z',
        trialEnd: '2026-07-21T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      })),
      getLatestInvoice: vi.fn(async () => null),
    };

    const result = await loadBillingSettingsView({
      getContext: vi.fn(async () => context),
      billingRepository,
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        org: {
          name: 'Trial Store',
          plan: 'basic',
          status: 'trialing',
        },
        subscription: {
          currentPeriodEnd: '2026-07-21T00:00:00.000Z',
          trialEnd: '2026-07-21T00:00:00.000Z',
        },
        actions: {
          canUpdateBilling: false,
          canCancelRenewal: false,
        },
      },
    });
    expect(result.state === 'ready' ? result.data.actions.disabledReason : null)
      .toContain('線上帳務與自助付款目前尚未開放');
    expect(billingRepository.getOrganizationBilling).toHaveBeenCalledWith({ orgId: 'org-1' });
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
        message:
          '線上帳務與自助付款目前尚未開放。如需升級方案、調整付款資訊或取消續訂，請聯絡客服，由專人協助處理。',
      },
    });
  });

  it('uses friendly Traditional Chinese copy when billing data is empty', async () => {
    const result = await loadBillingSettingsView({
      ...createBaseDeps(),
      billingRepository: {
        getOrganizationBilling: vi.fn(async () => null),
        getSubscription: vi.fn(async () => null),
        getLatestInvoice: vi.fn(async () => null),
      },
    });

    expect(result).toMatchObject({
      state: 'empty',
      data: null,
      message: '目前找不到帳務資料，請稍後再試；如需協助，請聯絡客服確認方案狀態。',
      context: {
        orgId: 'org-1',
      },
    });
  });

  it('does not expose billing repository errors to the settings page', async () => {
    const result = await loadBillingSettingsView({
      ...createBaseDeps(),
      billingRepository: {
        getOrganizationBilling: vi.fn(async () => {
          throw new Error('relation subscriptions does not exist');
        }),
        getSubscription: vi.fn(async () => null),
        getLatestInvoice: vi.fn(async () => null),
      },
    });

    expect(result).toEqual({
      state: 'error',
      data: null,
      message: '帳務資料暫時無法載入，請稍後再試；如持續發生，請聯絡客服。',
    });
    expect(JSON.stringify(result)).not.toContain('subscriptions');
  });

  it('localizes billing role guard copy', async () => {
    const result = await loadBillingSettingsView({
      getContext: vi.fn(async () => {
        throw new SaaSOrgContextError(
          'role_forbidden',
          403,
          'Owner or admin role is required.'
        );
      }),
    });

    expect(result).toEqual({
      state: 'gated',
      data: null,
      gated: {
        reason: 'role_required',
        message: '需要商家擁有者或管理員權限才能查看帳務設定。',
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

  it('keeps phone-only verified owners in the ready team settings state', async () => {
    const result = await loadTeamSettingsView({
      ...createBaseDeps(),
      teamRepository: {
        getOrganizationPlan: vi.fn(async () => ({ id: 'org-1', plan: 'basic' })),
        listMembers: vi.fn(async () => [
          {
            id: 'phone-owner',
            userId: 'owner-user',
            email: '已驗證手機帳號',
            displayName: null,
            role: 'owner',
            status: 'active',
            joinedAt: '2026-07-16T00:00:00.000Z',
          },
        ]),
        listInvites: vi.fn(async () => []),
      },
      now: new Date('2026-07-16T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        members: [
          {
            id: 'phone-owner',
            email: '已驗證手機帳號',
            role: 'owner',
            status: 'active',
          },
        ],
      },
    });
  });

  it('shows one seat and disables invites for a self-service Beta trial', async () => {
    const result = await loadTeamSettingsView({
      ...createBaseDeps(buildContext({
        orgStatus: 'trialing',
        plan: 'basic',
        planDefinition: getSaaSPlanDefinition('basic'),
      })),
      trialSeatRepository: {
        hasSelfServiceTrialClaim: vi.fn(async () => true),
      },
      teamRepository: {
        getOrganizationPlan: vi.fn(async () => ({ id: 'org-1', plan: 'basic' })),
        listMembers: vi.fn(async () => [{
          id: 'owner-member',
          userId: 'user-1',
          email: 'owner@example.com',
          displayName: null,
          role: 'owner',
          status: 'active',
          joinedAt: '2026-07-17T00:00:00.000Z',
        }]),
        listInvites: vi.fn(async () => []),
      },
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        seatLimit: 1,
        actions: {
          canInvite: false,
          canChangeRoles: true,
          disabledReason: 'Beta trial workspaces support one member only.',
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
