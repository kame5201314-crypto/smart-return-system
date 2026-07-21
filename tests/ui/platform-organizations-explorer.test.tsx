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
  requiresAttention: true,
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
    attentionOrganizations: 1,
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
      requiresAttention: false,
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
    attentionOrganizations: 2,
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

    fireEvent.change(screen.getByLabelText('搜尋租戶'), { target: { value: 'healthy@example.com' } });

    expect(screen.getByText('共 2 個租戶；符合 1 筆，目前顯示 1 筆')).toBeInTheDocument();
    expect(screen.queryByText('待補款品牌')).not.toBeInTheDocument();
    expect(screen.queryByText('健康品牌')).not.toBeInTheDocument();
    expect(screen.getAllByText('healthy@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Google 註冊').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: '管理租戶：healthy@example.com' }).length).toBeGreaterThan(0);
  });

  it('filters the list to tenants that need attention', () => {
    render(<PlatformOrganizationsExplorer data={data} />);

    fireEvent.change(screen.getByLabelText('租戶狀態'), { target: { value: 'attention' } });

    expect(screen.getByText('共 2 個租戶；符合 1 筆，目前顯示 1 筆')).toBeInTheDocument();
    expect(screen.getAllByText('待補款品牌').length).toBeGreaterThan(0);
    expect(screen.queryByText('健康品牌')).not.toBeInTheDocument();
  });

  it('separates past-due tenants from suspended read-only tenants', () => {
    render(<PlatformOrganizationsExplorer data={dataWithSuspended} />);

    fireEvent.click(screen.getByRole('button', { name: '已停權 1' }));

    expect(screen.getByText('共 3 個租戶；符合 1 筆，目前顯示 1 筆')).toBeInTheDocument();
    expect(screen.getAllByText('已停權品牌').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已停權（唯讀）').length).toBeGreaterThan(0);
    expect(screen.getAllByText('信箱註冊').length).toBeGreaterThan(0);
    expect(screen.queryByText('待補款品牌')).not.toBeInTheDocument();
  });

  it('uses the backend attention flag for the initial filter and visibly presses the chip', () => {
    const trialEndingData: PlatformOrganizationListView = {
      summary: {
        ...data.summary,
        totalOrganizations: 1,
        pausedOrPastDueOrganizations: 0,
        trialingOrganizations: 1,
        attentionOrganizations: 1,
        atRiskOrganizations: 0,
      },
      organizations: [
        {
          ...baseOrg,
          id: 'org-trial-ending',
          name: '即將到期品牌',
          slug: 'trial-ending-brand',
          status: 'trialing',
          trialEnd: '2026-07-24T00:00:00.000Z',
          daysUntilTrialEnd: 3,
          requiresAttention: true,
          health: {
            ...baseOrg.health,
            riskLevel: 'healthy',
            riskReasons: [],
          },
        },
      ],
    };

    render(<PlatformOrganizationsExplorer data={trialEndingData} initialFilter="attention" />);

    const attentionChip = screen.getByRole('button', { name: '需關注 1' });
    expect(attentionChip).toHaveAttribute('aria-pressed', 'true');
    expect(attentionChip).toHaveClass('ring-2');
    expect(screen.getByText('共 1 個租戶；符合 1 筆，目前顯示 1 筆')).toBeInTheDocument();
    expect(screen.getAllByText('即將到期品牌').length).toBeGreaterThan(0);
  });

  it('renders the first 20 tenants before expanding the remaining rows', () => {
    const healthyOrg = data.organizations[1];
    const organizations = Array.from({ length: 21 }, (_, index) => {
      const sequence = String(index + 1).padStart(2, '0');
      return {
        ...healthyOrg,
        id: `org-${sequence}`,
        name: `品牌 ${sequence}`,
        slug: `brand-${sequence}`,
        ownerEmail: `owner-${sequence}@example.com`,
        provisioningSource: 'manual' as const,
      };
    });
    const largeData: PlatformOrganizationListView = {
      summary: {
        ...data.summary,
        totalOrganizations: organizations.length,
        activeOrTrialingOrganizations: organizations.length,
        pausedOrPastDueOrganizations: 0,
        attentionOrganizations: 0,
        atRiskOrganizations: 0,
      },
      organizations,
    };

    render(<PlatformOrganizationsExplorer data={largeData} />);

    expect(screen.getByText('共 21 個租戶；符合 21 筆，目前顯示 20 筆')).toBeInTheDocument();
    expect(screen.queryByText('品牌 21')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '顯示其餘 1 筆' }));

    expect(screen.getAllByText('品牌 21').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '收合至前 20 筆' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('searches all matches before applying the 20-row display limit', () => {
    const healthyOrg = data.organizations[1];
    const organizations = Array.from({ length: 21 }, (_, index) => ({
      ...healthyOrg,
      id: `org-${index + 1}`,
      name: index === 20 ? '唯一第 21 筆' : `一般品牌 ${index + 1}`,
      slug: `brand-${index + 1}`,
      provisioningSource: 'manual' as const,
    }));
    const largeData: PlatformOrganizationListView = {
      summary: {
        ...data.summary,
        totalOrganizations: organizations.length,
        activeOrTrialingOrganizations: organizations.length,
        pausedOrPastDueOrganizations: 0,
        attentionOrganizations: 0,
        atRiskOrganizations: 0,
      },
      organizations,
    };

    render(<PlatformOrganizationsExplorer data={largeData} />);
    fireEvent.change(screen.getByLabelText('搜尋租戶'), {
      target: { value: '唯一第 21 筆' },
    });

    expect(screen.getByText('共 21 個租戶；符合 1 筆，目前顯示 1 筆')).toBeInTheDocument();
    expect(screen.getAllByText('唯一第 21 筆').length).toBeGreaterThan(0);
  });
});
