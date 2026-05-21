import { describe, expect, it } from 'vitest';

import {
  buildBillingSettingsView,
  buildPlatformBillingEventsView,
  buildPlatformOrganizationDetailView,
  buildPlatformOrganizationListView,
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
          seatsUsed: 10,
          returnsThisMonth: 1600,
          aiUsedThisMonth: 30,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
      })
    ).toMatchObject({
      plan: {
        code: 'growth',
        seatLimit: 10,
        monthlyReturnSoftLimit: 2000,
        aiMonthlyLimit: 30,
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

  it('builds billing settings view models from validated billing state', () => {
    expect(
      buildBillingSettingsView({
        org: {
          id: 'org-1',
          name: 'Demo Org',
          plan: 'pro',
          status: 'trialing',
        },
        subscription: {
          provider: 'manual',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-05-15T00:00:00.000Z',
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
        plan: 'pro',
        status: 'trialing',
      },
      subscription: {
        provider: 'manual',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-05-15T00:00:00.000Z',
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
    });
  });

  it('rejects invalid billing settings status values', () => {
    expect(() =>
      buildBillingSettingsView({
        org: {
          id: 'org-1',
          name: 'Demo Org',
          plan: 'basic',
          status: 'enabled',
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
      seatLimit: 10,
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
          returnsThisMonth: 42,
          aiUsedThisMonth: 7,
        },
      })
    ).toEqual({
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
          usage: {
            returnsThisMonth: 42,
            aiUsedThisMonth: 7,
          },
        },
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
