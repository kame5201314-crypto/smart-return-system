import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PlatformOrganizationsExplorer } from '@/components/internal/platform-organizations-explorer';
import type { PlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';

const baseOrg: PlatformOrganizationListView['organizations'][number] = {
  id: 'org-attention',
  name: '待補款品牌',
  slug: 'attention-brand',
  plan: 'basic',
  status: 'past_due',
  ownerEmail: 'attention@example.com',
  memberCount: 1,
  createdAt: '2026-07-01T00:00:00.000Z',
  trialEnd: null,
  daysUntilTrialEnd: null,
  provisioningSource: 'manual',
  selfServiceTrialAI: null,
  usage: { returnsThisMonth: 20, aiUsedThisMonth: 1 },
  health: {
    riskLevel: 'at_risk',
    riskReasons: ['past_due'],
    estimatedMrrTwd: 0,
    trialPipelineMrrTwd: 0,
    usagePercentages: { seats: 20, returns: 20, ai: 20 },
  },
};

const data: PlatformOrganizationListView = {
  summary: {
    totalOrganizations: 2,
    activeOrTrialingOrganizations: 1,
    pausedOrPastDueOrganizations: 1,
    trialingOrganizations: 0,
    estimatedActiveMrrTwd: 699,
    trialPipelineMrrTwd: 0,
    atRiskOrganizations: 1,
    aiLimitReachedOrganizations: 0,
  },
  organizations: [
    baseOrg,
    {
      ...baseOrg,
      id: 'org-healthy',
      name: '健康品牌',
      slug: 'healthy-brand',
      plan: 'growth',
      status: 'active',
      ownerEmail: 'healthy@example.com',
      provisioningSource: 'google_self_service',
      health: {
        ...baseOrg.health,
        riskLevel: 'healthy',
        riskReasons: [],
        estimatedMrrTwd: 699,
      },
    },
  ],
};

const dataWithSuspended: PlatformOrganizationListView = {
  summary: {
    ...data.summary,
    totalOrganizations: 3,
    pausedOrPastDueOrganizations: 2,
    atRiskOrganizations: 2,
  },
  organizations: [
    ...data.organizations,
    {
      ...baseOrg,
      id: 'org-suspended',
      name: '已停權品牌',
      slug: 'suspended-brand',
      status: 'suspended',
      ownerEmail: 'suspended@example.com',
      provisioningSource: 'email_otp_self_service',
      health: {
        ...baseOrg.health,
        riskReasons: ['suspended'],
      },
    },
  ],
};

describe('PlatformOrganizationsExplorer', () => {
  afterEach(cleanup);

  it('searches tenants and exposes explicit tenant actions', () => {
    render(<PlatformOrganizationsExplorer data={data} />);

    fireEvent.change(screen.getByLabelText('搜尋租戶'), { target: { value: '健康品牌' } });

    expect(screen.getByText('顯示 1 / 2 個租戶')).toBeInTheDocument();
    expect(screen.queryByText('待補款品牌')).not.toBeInTheDocument();
    expect(screen.getAllByText('健康品牌').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Google 註冊').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '管理租戶：健康品牌' }).length).toBeGreaterThan(0);
  });

  it('filters the list to tenants that need attention', () => {
    render(<PlatformOrganizationsExplorer data={data} />);

    fireEvent.change(screen.getByLabelText('租戶狀態'), { target: { value: 'attention' } });

    expect(screen.getByText('顯示 1 / 2 個租戶')).toBeInTheDocument();
    expect(screen.getAllByText('待補款品牌').length).toBeGreaterThan(0);
    expect(screen.queryByText('健康品牌')).not.toBeInTheDocument();
  });

  it('separates past-due tenants from suspended read-only tenants', () => {
    render(<PlatformOrganizationsExplorer data={dataWithSuspended} />);

    fireEvent.click(screen.getByRole('button', { name: '已停權 1' }));

    expect(screen.getByText('顯示 1 / 3 個租戶')).toBeInTheDocument();
    expect(screen.getAllByText('已停權品牌').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已停權（唯讀）').length).toBeGreaterThan(0);
    expect(screen.getAllByText('信箱註冊').length).toBeGreaterThan(0);
    expect(screen.queryByText('待補款品牌')).not.toBeInTheDocument();
  });
});
