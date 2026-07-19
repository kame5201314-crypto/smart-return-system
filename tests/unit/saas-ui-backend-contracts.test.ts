import { describe, expect, it } from 'vitest';

import {
  buildBillingSettingsView,
  buildPlatformAtRiskAlertsView,
  buildPlatformBillingEventsView,
  buildPlatformOrganizationDetailView,
  buildPlatformOrganizationListView,
  buildPlatformTrialConversionView,
  buildTeamSettingsView,
  buildUsageSettingsView,
} from '@/lib/saas/ui-backend-contracts';
import type {
  PlatformBillingEventSummary,
  PlatformOrgDetail,
  PlatformOrgSummary,
} from '@/lib/saas/platform-admin-data';

const orgSummary: PlatformOrgSummary = {
  id: 'org-1',
  name: 'Demo Org',
  slug: 'demo-org',
  plan: 'growth',
  status: 'active',
  ownerEmail: 'owner@example.com',
  memberCount: 3,
  createdAt: '2026-05-20T00:00:00.000Z',
};

describe('SaaS UI/backend contracts', () => {
  it('builds usage settings view models from org.plan limits', () => {
    expect(
      buildUsageSettingsView({
        plan: 'growth',
        usage: {
          seatsUsed: 5,
          returnsThisMonth: 640,
          aiUsedThisMonth: 25,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
      })
    ).toMatchObject({
      plan: {
        code: 'growth',
        seatLimit: 5,
        monthlyReturnSoftLimit: 800,
        aiMonthlyLimit: 25,
      },
      warnings: [
        {
          type: 'returns_80',
        },
        {
          type: 'ai_100',
        },
        {
          type: 'seats_full',
        },
      ],
    });
  });

  it('keeps enterprise usage unlimited unless a finite limit exists', () => {
    expect(
      buildUsageSettingsView({
        plan: 'enterprise',
        usage: {
          seatsUsed: 999,
          returnsThisMonth: 99999,
          aiUsedThisMonth: 999,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
      }).warnings
    ).toEqual([]);
  });

  it('uses return soft-limit policy for 100 percent usage warnings', () => {
    expect(
      buildUsageSettingsView({
        plan: 'basic',
        usage: {
          seatsUsed: 1,
          returnsThisMonth: 300,
          aiUsedThisMonth: 0,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
      }).warnings
    ).toEqual([
      {
        type: 'returns_100',
        message: 'Return usage has reached the plan soft limit.',
      },
    ]);
  });

  it('builds billing settings view models from validated billing state', () => {
    expect(
      buildBillingSettingsView({
        org: {
          id: 'org-1',
          name: 'Demo Org',
          plan: 'growth',
          status: 'trialing',
          suspensionSource: null,
        },
        subscription: {
          provider: 'manual',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-05-15T00:00:00.000Z',
          trialEnd: '2026-05-15T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
        invoiceSummary: {
          latestInvoiceId: 'invoice-1',
          latestInvoiceStatus: 'issued',
          billingEmail: 'billing@example.com',
          taxId: '12345678',
        },
        actions: {
          canUpdateBilling: true,
          canCancelRenewal: false,
          disabledReason: 'Manual Beta accounts are managed by platform admin.',
        },
      })
    ).toEqual({
      org: {
        id: 'org-1',
        name: 'Demo Org',
        plan: 'growth',
        status: 'trialing',
        suspensionSource: null,
      },
      subscription: {
        provider: 'manual',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-05-15T00:00:00.000Z',
        trialEnd: '2026-05-15T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      invoiceSummary: {
        latestInvoiceId: 'invoice-1',
        latestInvoiceStatus: 'issued',
        billingEmail: 'billing@example.com',
        taxId: '12345678',
      },
      history: [],
      actions: {
        canUpdateBilling: true,
        canCancelRenewal: false,
        disabledReason: 'Manual Beta accounts are managed by platform admin.',
      },
    });
  });

  it.each([
    ['trial_expired', 'trial_expired'],
    ['billing', 'billing'],
    ['platform_admin', 'platform_admin'],
    [null, null],
  ] as const)('preserves authoritative billing suspension source %s', (source, expected) => {
    expect(
      buildBillingSettingsView({
        org: {
          id: 'org-suspended',
          name: 'Suspended Org',
          plan: 'basic',
          status: 'suspended',
          suspensionSource: source,
        },
        subscription: null,
        invoiceSummary: {
          latestInvoiceId: null,
          latestInvoiceStatus: null,
          billingEmail: null,
          taxId: null,
        },
        actions: {
          canUpdateBilling: true,
          canCancelRenewal: false,
        },
      }).org.suspensionSource
    ).toBe(expected);
  });

  it('rejects an unsupported billing suspension source at the UI contract boundary', () => {
    expect(() =>
      buildBillingSettingsView({
        org: {
          id: 'org-suspended',
          name: 'Suspended Org',
          plan: 'basic',
          status: 'suspended',
          suspensionSource: 'expired_trial_date' as never,
        },
        subscription: null,
        invoiceSummary: {
          latestInvoiceId: null,
          latestInvoiceStatus: null,
          billingEmail: null,
          taxId: null,
        },
        actions: {
          canUpdateBilling: true,
          canCancelRenewal: false,
        },
      })
    ).toThrow('Invalid billing suspension source: expired_trial_date');
  });

  it('accepts failed invoice status values from billing providers', () => {
    expect(
      buildBillingSettingsView({
        org: {
          id: 'org-1',
          name: 'Demo Org',
          plan: 'growth',
          status: 'active',
          suspensionSource: null,
        },
        subscription: null,
        invoiceSummary: {
          latestInvoiceId: 'invoice-1',
          latestInvoiceStatus: 'failed',
          billingEmail: null,
          taxId: null,
        },
        actions: {
          canUpdateBilling: true,
          canCancelRenewal: false,
        },
      }).invoiceSummary.latestInvoiceStatus
    ).toBe('failed');
  });

  it('normalizes validated payment and subscription history', () => {
    expect(
      buildBillingSettingsView({
        org: {
          id: 'org-1',
          name: 'Demo Org',
          plan: 'basic',
          status: 'active',
          suspensionSource: null,
        },
        subscription: null,
        invoiceSummary: {
          latestInvoiceId: null,
          latestInvoiceStatus: null,
          billingEmail: null,
          taxId: null,
        },
        history: [
          {
            id: 'order-1',
            plan: 'growth',
            provider: 'ecpay',
            amountTwd: 699,
            status: 'paid',
            paidAt: '2026-07-19T00:00:00.000Z',
            periodStart: '2026-07-19T00:00:00.000Z',
            periodEnd: '2026-08-19T00:00:00.000Z',
            createdAt: '2026-07-19T00:00:00.000Z',
          },
        ],
        actions: {
          canUpdateBilling: true,
          canCancelRenewal: false,
        },
      }).history
    ).toEqual([
      {
        id: 'order-1',
        plan: 'growth',
        provider: 'ecpay',
        amountTwd: 699,
        status: 'paid',
        paidAt: '2026-07-19T00:00:00.000Z',
        periodStart: '2026-07-19T00:00:00.000Z',
        periodEnd: '2026-08-19T00:00:00.000Z',
        createdAt: '2026-07-19T00:00:00.000Z',
      },
    ]);
  });

  it.each(['enterprise', 'legacy-plan'])(
    'rejects unsupported self-service payment plan %s',
    (plan) => {
      expect(() =>
        buildBillingSettingsView({
          org: {
            id: 'org-1',
            name: 'Demo Org',
            plan: 'basic',
            status: 'active',
            suspensionSource: null,
          },
          subscription: null,
          invoiceSummary: {
            latestInvoiceId: null,
            latestInvoiceStatus: null,
            billingEmail: null,
            taxId: null,
          },
          history: [
            {
              id: 'order-1',
              plan,
              provider: 'ecpay',
              amountTwd: 699,
              status: 'paid',
              paidAt: null,
              periodStart: null,
              periodEnd: null,
              createdAt: '2026-07-19T00:00:00.000Z',
            },
          ],
          actions: {
            canUpdateBilling: true,
            canCancelRenewal: false,
          },
        })
      ).toThrow(`Invalid self-service billing plan: ${plan}`);
    }
  );

  it('rejects invalid billing settings status values', () => {
    expect(() =>
      buildBillingSettingsView({
        org: {
          id: 'org-1',
          name: 'Demo Org',
          plan: 'basic',
          status: 'enabled',
          suspensionSource: null,
        },
        subscription: null,
        invoiceSummary: {
          latestInvoiceId: null,
          latestInvoiceStatus: null,
          billingEmail: null,
          taxId: null,
        },
        actions: {
          canUpdateBilling: false,
          canCancelRenewal: false,
        },
      })
    ).toThrow('Invalid organization status: enabled');
  });

  it('builds team settings view models with plan seat limits and invite guards', () => {
    expect(
      buildTeamSettingsView({
        orgId: 'org-1',
        plan: 'growth',
        members: [
          {
            id: 'member-1',
            email: 'owner@example.com',
            displayName: 'Owner',
            role: 'owner',
            status: 'active',
            joinedAt: '2026-05-01T00:00:00.000Z',
          },
          {
            id: 'member-2',
            email: 'viewer@example.com',
            displayName: null,
            role: 'viewer',
            status: 'disabled',
            joinedAt: null,
          },
        ],
        invites: [
          {
            id: 'invite-1',
            email: 'staff@example.com',
            role: 'staff',
            status: 'pending',
            expiresAt: '2026-05-28T00:00:00.000Z',
          },
        ],
        actions: {
          canInvite: true,
          canChangeRoles: true,
        },
      })
    ).toEqual({
      orgId: 'org-1',
      seatLimit: 5,
      members: [
        {
          id: 'member-1',
          userId: null,
          email: 'owner@example.com',
          displayName: 'Owner',
          role: 'owner',
          status: 'active',
          joinedAt: '2026-05-01T00:00:00.000Z',
          actions: {
            canChangeRole: false,
            canDisable: false,
            disabledReason: 'Team management action flags were not provided.',
          },
        },
        {
          id: 'member-2',
          userId: null,
          email: 'viewer@example.com',
          displayName: null,
          role: 'viewer',
          status: 'disabled',
          joinedAt: null,
          actions: {
            canChangeRole: false,
            canDisable: false,
            disabledReason: 'Team management action flags were not provided.',
          },
        },
      ],
      invites: [
        {
          id: 'invite-1',
          email: 'staff@example.com',
          role: 'staff',
          status: 'pending',
          expiresAt: '2026-05-28T00:00:00.000Z',
          actions: {
            canRevoke: false,
            canResend: false,
            disabledReason: 'Invite management action flags were not provided.',
          },
        },
      ],
      actions: {
        canInvite: true,
        canChangeRoles: true,
      },
    });
  });

  it('rejects owner invites for team settings contracts', () => {
    expect(() =>
      buildTeamSettingsView({
        orgId: 'org-1',
        plan: 'basic',
        members: [],
        invites: [
          {
            id: 'invite-1',
            email: 'owner@example.com',
            role: 'owner',
            status: 'pending',
            expiresAt: '2026-05-28T00:00:00.000Z',
          },
        ],
        actions: {
          canInvite: true,
          canChangeRoles: false,
        },
      })
    ).toThrow('Invalid invite role: owner');
  });

  it('disables team invites when active seats and pending invites reach the plan limit', () => {
    expect(
      buildTeamSettingsView({
        orgId: 'org-1',
        plan: 'basic',
        members: [
          {
            id: 'member-1',
            email: 'owner@example.com',
            displayName: null,
            role: 'owner',
            status: 'active',
            joinedAt: null,
          },
          {
            id: 'member-2',
            email: 'admin@example.com',
            displayName: null,
            role: 'admin',
            status: 'active',
            joinedAt: null,
          },
          {
            id: 'member-3',
            email: 'disabled@example.com',
            displayName: null,
            role: 'viewer',
            status: 'disabled',
            joinedAt: null,
          },
        ],
        invites: [
          {
            id: 'invite-1',
            email: 'staff@example.com',
            role: 'staff',
            status: 'pending',
            expiresAt: '2026-05-28T00:00:00.000Z',
          },
        ],
        actions: {
          canInvite: true,
          canChangeRoles: true,
        },
      }).actions
    ).toEqual({
      canInvite: false,
      canChangeRoles: true,
      disabledReason: 'Seat limit has been reached for this plan.',
    });
  });

  it('requires real usage snapshots for platform organization DTOs', () => {
    expect(() => buildPlatformOrganizationListView([orgSummary], {})).toThrow(
      'Missing usage snapshot for organization: org-1'
    );

    expect(
      buildPlatformOrganizationListView([orgSummary], {
        'org-1': {
          returnsThisMonth: 680,
          aiUsedThisMonth: 25,
        },
      })
    ).toEqual({
      summary: {
        totalOrganizations: 1,
        activeOrTrialingOrganizations: 1,
        pausedOrPastDueOrganizations: 0,
        trialingOrganizations: 0,
        estimatedActiveMrrTwd: 699,
        trialPipelineMrrTwd: 0,
        atRiskOrganizations: 1,
        aiLimitReachedOrganizations: 1,
      },
      organizations: [
        {
          id: 'org-1',
          name: 'Demo Org',
          slug: 'demo-org',
          plan: 'growth',
          status: 'active',
          ownerEmail: 'owner@example.com',
          memberCount: 3,
          createdAt: '2026-05-20T00:00:00.000Z',
          trialEnd: null,
          daysUntilTrialEnd: null,
          provisioningSource: 'manual',
          selfServiceTrialAI: null,
          usage: {
            returnsThisMonth: 680,
            aiUsedThisMonth: 25,
          },
          health: {
            riskLevel: 'at_risk',
            riskReasons: ['returns_high', 'ai_limit'],
            estimatedMrrTwd: 699,
            trialPipelineMrrTwd: 0,
            usagePercentages: {
              seats: 60,
              returns: 85,
              ai: 100,
            },
          },
        },
      ],
    });
  });

  it('exposes trial deadline fields on platform organization list items', () => {
    const trialOrg: PlatformOrgSummary = {
      id: 'org-2',
      name: 'Trial Store',
      slug: 'trial-store',
      plan: 'basic',
      status: 'trialing',
      ownerEmail: 'trial@example.com',
      memberCount: 1,
      createdAt: '2026-05-20T00:00:00.000Z',
    };

    expect(
      buildPlatformOrganizationListView(
        [trialOrg],
        {
          'org-2': {
            returnsThisMonth: 12,
            aiUsedThisMonth: 1,
          },
        },
        {
          subscriptionsByOrgId: {
            'org-2': {
              status: 'trialing',
              currentPeriodEnd: '2026-05-28T00:00:00.000Z',
              trialEnd: '2026-05-28T00:00:00.000Z',
              cancelAtPeriodEnd: false,
            },
          },
          now: new Date('2026-05-25T00:00:00.000Z'),
        }
      ).organizations[0]
    ).toMatchObject({
      id: 'org-2',
      status: 'trialing',
      trialEnd: '2026-05-28T00:00:00.000Z',
      daysUntilTrialEnd: 3,
    });
  });

  it('exposes self-service trial source and single-use AI progress', () => {
    const selfServiceOrg: PlatformOrgSummary = {
      id: 'org-self-service',
      name: 'Self-service Store',
      slug: 'self-service-store',
      plan: 'basic',
      status: 'trialing',
      ownerEmail: 'owner@example.com',
      memberCount: 1,
      createdAt: '2026-07-14T00:00:00.000Z',
    };

    expect(buildPlatformOrganizationListView(
      [selfServiceOrg],
      {
        'org-self-service': { returnsThisMonth: 0, aiUsedThisMonth: 0 },
      },
      {
        selfServiceTrialClaimsByOrgId: {
          'org-self-service': {
            orgId: 'org-self-service',
            createdAt: '2026-07-14T00:00:00.000Z',
            analysisReservedAt: '2026-07-14T01:00:00.000Z',
            analysisCompletedAt: null,
          },
        },
      }
    ).organizations[0]).toMatchObject({
      provisioningSource: 'google_self_service',
      selfServiceTrialAI: {
        limit: 1,
        used: 0,
        status: 'in_progress',
        completedAt: null,
      },
    });
  });

  it('builds platform at-risk alerts from usage, status, and trial deadlines', () => {
    const trialOrg: PlatformOrgSummary = {
      id: 'org-2',
      name: 'Trial Store',
      slug: 'trial-store',
      plan: 'basic',
      status: 'trialing',
      ownerEmail: 'trial@example.com',
      memberCount: 3,
      createdAt: '2026-05-20T00:00:00.000Z',
    };
    const pastDueOrg: PlatformOrgSummary = {
      id: 'org-3',
      name: 'Past Due Store',
      slug: 'past-due-store',
      plan: 'enterprise',
      status: 'past_due',
      ownerEmail: 'billing@example.com',
      memberCount: 2,
      createdAt: '2026-05-18T00:00:00.000Z',
    };

    expect(
      buildPlatformAtRiskAlertsView(
        [orgSummary, trialOrg, pastDueOrg],
        {
          'org-1': {
            returnsThisMonth: 680,
            aiUsedThisMonth: 25,
          },
          'org-2': {
            returnsThisMonth: 10,
            aiUsedThisMonth: 0,
          },
          'org-3': {
            returnsThisMonth: 20,
            aiUsedThisMonth: 2,
          },
        },
        {
          'org-2': {
            status: 'trialing',
            currentPeriodEnd: '2026-05-28T00:00:00.000Z',
            trialEnd: '2026-05-28T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
          'org-3': {
            status: 'past_due',
            currentPeriodEnd: '2026-05-20T00:00:00.000Z',
            trialEnd: null,
            cancelAtPeriodEnd: false,
          },
        },
        {
          now: new Date('2026-05-25T00:00:00.000Z'),
        }
      )
    ).toEqual({
      summary: {
        totalAlerts: 5,
        criticalAlerts: 2,
        warningAlerts: 3,
        affectedOrganizations: 3,
        billingAlerts: 1,
        trialAlerts: 1,
        quotaAlerts: 2,
        teamAlerts: 1,
      },
      alerts: [
        expect.objectContaining({
          id: 'org-3:past_due',
          type: 'past_due',
          severity: 'critical',
          category: 'billing',
          dueAt: '2026-05-27T00:00:00.000Z',
          daysUntilDue: 2,
        }),
        expect.objectContaining({
          id: 'org-1:ai_100',
          type: 'ai_100',
          severity: 'critical',
          category: 'quota',
          metric: {
            used: 25,
            limit: 25,
            percent: 100,
          },
        }),
        expect.objectContaining({
          id: 'org-2:trial_ending',
          type: 'trial_ending',
          severity: 'warning',
          category: 'trial',
          daysUntilDue: 3,
        }),
        expect.objectContaining({
          id: 'org-1:returns_80',
          type: 'returns_80',
          severity: 'warning',
          category: 'quota',
        }),
        expect.objectContaining({
          id: 'org-2:seats_full',
          type: 'seats_full',
          severity: 'warning',
          category: 'team',
        }),
      ],
    });
  });

  it('builds platform trial conversion view from organization and subscription snapshots', () => {
    const activeOrg: PlatformOrgSummary = {
      ...orgSummary,
      status: 'active',
      onboardingCompletedAt: '2026-05-21T00:00:00.000Z',
    };
    const trialEndingOrg: PlatformOrgSummary = {
      id: 'org-2',
      name: 'Trial Ending Store',
      slug: 'trial-ending-store',
      plan: 'basic',
      status: 'trialing',
      ownerEmail: 'trial@example.com',
      memberCount: 1,
      createdAt: '2026-05-20T00:00:00.000Z',
      onboardingCompletedAt: null,
    };
    const expiredTrialOrg: PlatformOrgSummary = {
      id: 'org-3',
      name: 'Expired Trial Store',
      slug: 'expired-trial-store',
      plan: 'growth',
      status: 'trialing',
      ownerEmail: 'expired@example.com',
      memberCount: 2,
      createdAt: '2026-05-10T00:00:00.000Z',
      onboardingCompletedAt: null,
    };
    const trialOrg: PlatformOrgSummary = {
      id: 'org-4',
      name: 'Fresh Trial Store',
      slug: 'fresh-trial-store',
      plan: 'enterprise',
      status: 'trialing',
      ownerEmail: 'fresh@example.com',
      memberCount: 2,
      createdAt: '2026-05-24T00:00:00.000Z',
      onboardingCompletedAt: '2026-05-24T12:00:00.000Z',
    };

    expect(
      buildPlatformTrialConversionView(
        [activeOrg, trialEndingOrg, expiredTrialOrg, trialOrg],
        {
          'org-1': {
            status: 'active',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
            trialEnd: '2026-05-22T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
          'org-2': {
            status: 'trialing',
            currentPeriodEnd: '2026-05-28T00:00:00.000Z',
            trialEnd: '2026-05-28T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
          'org-3': {
            status: 'trialing',
            currentPeriodEnd: '2026-05-20T00:00:00.000Z',
            trialEnd: '2026-05-20T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
          'org-4': {
            status: 'trialing',
            currentPeriodEnd: '2026-06-05T00:00:00.000Z',
            trialEnd: '2026-06-05T00:00:00.000Z',
            cancelAtPeriodEnd: false,
          },
        },
        {
          now: new Date('2026-05-25T00:00:00.000Z'),
        }
      )
    ).toEqual({
      summary: {
        totalOrganizations: 4,
        trialingOrganizations: 2,
        trialEndingSoonOrganizations: 1,
        convertedActiveOrganizations: 1,
        expiredTrialOrganizations: 1,
        onboardingIncompleteOrganizations: 2,
        conversionRatePercent: 25,
      },
      organizations: [
        expect.objectContaining({
          orgId: 'org-3',
          lifecycleState: 'trial_expired',
          daysUntilTrialEnd: -5,
          needsFollowUp: true,
        }),
        expect.objectContaining({
          orgId: 'org-2',
          lifecycleState: 'trial_ending',
          daysUntilTrialEnd: 3,
          onboardingCompleted: false,
          needsFollowUp: true,
        }),
        expect.objectContaining({
          orgId: 'org-4',
          lifecycleState: 'trialing',
          daysUntilTrialEnd: 11,
          onboardingCompleted: true,
          needsFollowUp: false,
        }),
        expect.objectContaining({
          orgId: 'org-1',
          lifecycleState: 'converted_active',
          onboardingCompleted: true,
          needsFollowUp: false,
        }),
      ],
    });
  });

  it('maps platform organization detail without leaking non-boolean feature flags', () => {
    const detail: PlatformOrgDetail = {
      ...orgSummary,
      featureFlags: {
        billing: true,
        debug_label: 'not-a-flag',
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
    };

    expect(
      buildPlatformOrganizationDetailView(detail, {
        usageByOrgId: {
          'org-1': {
            returnsThisMonth: 5,
            aiUsedThisMonth: 1,
          },
        },
        recentAuditLogs: [
          {
            id: 'audit-1',
            action: 'org.created',
            actorEmail: 'admin@example.com',
            createdAt: '2026-05-20T00:00:00.000Z',
          },
        ],
      })
    ).toMatchObject({
      organization: {
        id: 'org-1',
        featureFlags: {
          billing: true,
        },
        health: {
          riskLevel: 'healthy',
          estimatedMrrTwd: 699,
        },
      },
      members: [
        {
          role: 'owner',
          status: 'active',
          displayName: null,
          joinedAt: null,
        },
      ],
      recentAuditLogs: [
        {
          action: 'org.created',
        },
      ],
    });
  });

  it('normalizes platform billing events for UI contracts', () => {
    const event: PlatformBillingEventSummary = {
      id: 'event-1',
      orgId: 'org-1',
      provider: 'ecpay',
      eventType: 'period_paid',
      status: 'processed',
      providerEventId: 'trade-1',
      createdAt: '2026-05-20T00:00:00.000Z',
    };

    expect(
      buildPlatformBillingEventsView([event], {
        'org-1': 'Demo Org',
      })
    ).toEqual({
      events: [
        {
          id: 'event-1',
          orgId: 'org-1',
          orgName: 'Demo Org',
          provider: 'ecpay',
          eventType: 'period_paid',
          status: 'processed',
          providerEventId: 'trade-1',
          createdAt: '2026-05-20T00:00:00.000Z',
        },
      ],
    });
  });

  it('rejects unsupported status values instead of silently serving invalid UI data', () => {
    expect(() =>
      buildPlatformBillingEventsView([
        {
          id: 'event-1',
          orgId: 'org-1',
          provider: 'ecpay',
          eventType: 'period_paid',
          status: 'pending',
          providerEventId: null,
          createdAt: '2026-05-20T00:00:00.000Z',
        },
      ])
    ).toThrow('Invalid billing event status: pending');
  });
});
