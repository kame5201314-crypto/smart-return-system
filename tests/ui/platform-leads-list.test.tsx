import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PlatformLeadsEmptyState,
  PlatformLeadsList,
} from '@/components/internal/platform-leads-list';
import type { PlatformLeadRecord } from '@/lib/saas/platform-lead-management';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseLead: PlatformLeadRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  companyName: '測試商店',
  contactName: '王小明',
  email: 'owner@example.com',
  lineId: null,
  phone: null,
  preferredContactChannel: 'email',
  requestedPlan: 'basic',
  monthlyReturnBand: '30_100',
  message: null,
  status: 'new',
  orgId: null,
  metadata: {},
  contactedAt: null,
  followUpAt: null,
  processedAt: null,
  createdAt: '2026-07-14T00:00:00.000Z',
};

describe('PlatformLeadsList', () => {
  afterEach(cleanup);

  it('explains the empty-state workflow and provides clear next actions', () => {
    render(<PlatformLeadsEmptyState />);

    expect(screen.getByRole('status')).toHaveTextContent('目前沒有新的試用申請');
    expect(screen.getByText('收到申請')).toBeInTheDocument();
    expect(screen.getByText('追蹤試用')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /查看行銷頁/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /前往租戶管理/ })).toHaveAttribute('href', '/internal/orgs');
  });

  it('filters leads by lifecycle status and keeps action names tenant-specific', () => {
    render(
      <PlatformLeadsList
        leads={[
          baseLead,
          {
            ...baseLead,
            id: '22222222-2222-4222-8222-222222222222',
            companyName: '已聯絡品牌',
            status: 'contacted',
            contactedAt: '2026-07-15T00:00:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('測試商店')).toBeInTheDocument();
    expect(screen.getByText('已聯絡品牌')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '標記已聯絡：測試商店' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '已聯絡 1' }));

    expect(screen.queryByText('測試商店')).not.toBeInTheDocument();
    expect(screen.getByText('已聯絡品牌')).toBeInTheDocument();
  });
});
