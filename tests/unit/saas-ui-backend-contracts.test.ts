import { describe, expect, it } from 'vitest';

import {
  buildPlatformBillingEventsView,
  buildPlatformOrganizationDetailView,
  buildPlatformOrganizationListView,
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
