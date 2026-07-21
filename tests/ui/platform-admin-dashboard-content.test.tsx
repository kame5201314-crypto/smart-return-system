import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlatformAdminDashboardContent } from '@/components/internal/platform-admin-dashboard-content';
import type { PlatformAdminDashboardView } from '@/lib/saas/ui-backend-contracts';

const dashboard: PlatformAdminDashboardView = {
  generatedAt: '2026-07-18T00:00:00.000Z',
  organizations: {
    totalOrganizations: 5,
    activeOrTrialingOrganizations: 4,
    pausedOrPastDueOrganizations: 1,
    trialingOrganizations: 2,
    attentionOrganizations: 1,
    estimatedActiveMrrTwd: 1398,
    trialPipelineMrrTwd: 1198,
    atRiskOrganizations: 1,
    aiLimitReachedOrganizations: 0,
  },
  atRisk: {
    summary: {
      totalAlerts: 1,
      criticalAlerts: 1,
      warningAlerts: 0,
      affectedOrganizations: 1,
      billingAlerts: 1,
      trialAlerts: 0,
      quotaAlerts: 0,
      teamAlerts: 0,
    },
    topAlerts: [
      {
        id: 'past-due-org-1',
        orgId: 'org-1',
        orgName: '測試租戶',
        ownerEmail: 'owner@example.com',
        plan: 'basic',
        status: 'past_due',
        type: 'past_due',
        severity: 'critical',
        category: 'billing',
        message: '付款已逾期。',
        metric: null,
        dueAt: '2026-07-16T00:00:00.000Z',
        daysUntilDue: -2,
      },
    ],
  },
  trialConversion: {
    summary: {
      totalOrganizations: 5,
      trialingOrganizations: 2,
      trialEndingSoonOrganizations: 1,
      convertedActiveOrganizations: 2,
      expiredTrialOrganizations: 1,
      onboardingIncompleteOrganizations: 1,
      conversionRatePercent: 40,
    },
    followUpOrganizations: [],
  },
  billingEvents: {
    summary: {
      totalEvents: 3,
      receivedEvents: 1,
      processedEvents: 1,
      failedEvents: 1,
      ignoredEvents: 0,
    },
    recentEvents: [],
  },
};

describe('PlatformAdminDashboardContent', () => {
  afterEach(cleanup);

  it('turns risk data into specific operational actions', () => {
    render(<PlatformAdminDashboardContent data={dashboard} />);

    expect(screen.getByText('優先待辦（1）')).toBeInTheDocument();
    expect(screen.getByText('已逾期 2 天')).toBeInTheDocument();
    expect(screen.getByText('帳號：owner@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /測試租戶.*提醒補款/ }))
      .toHaveAttribute('href', '/internal/orgs/org-1');
    expect(screen.getAllByRole('link', { name: /測試租戶.*提醒補款/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: '查看全部租戶：5 個' }))
      .toHaveAttribute('href', '/internal/orgs');
    expect(screen.getByRole('link', { name: '查看試用中租戶：2 個' }))
      .toHaveAttribute('href', '/internal/orgs?filter=trialing');
    expect(screen.getByRole('link', { name: '查看需關注租戶：1 個' }))
      .toHaveAttribute('href', '/internal/orgs?filter=attention');
    expect(screen.getByText('試用轉換')).toBeInTheDocument();
    expect(screen.getByText('帳務處理')).toBeInTheDocument();
  });

  it('explains when the priority list is truncated and links to affected tenants', () => {
    render(
      <PlatformAdminDashboardContent
        data={{
          ...dashboard,
          atRisk: {
            ...dashboard.atRisk,
            summary: { ...dashboard.atRisk.summary, totalAlerts: 3 },
          },
        }}
      />
    );

    expect(screen.getByText('另有 2 項警示未列出。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看全部受影響租戶' }))
      .toHaveAttribute('href', '/internal/orgs?filter=attention');
  });
});
