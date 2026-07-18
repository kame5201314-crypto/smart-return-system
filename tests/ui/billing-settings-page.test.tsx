import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const billingMocks = vi.hoisted(() => ({
  result: {
    state: 'ready' as const,
    data: {
      org: {
        id: 'org-1',
        name: '測試商店',
        plan: 'basic' as const,
        status: 'trialing' as const,
      },
      subscription: {
        provider: 'manual' as const,
        currentPeriodStart: '2026-07-18T00:00:00.000Z',
        currentPeriodEnd: '2026-07-21T00:00:00.000Z',
        trialEnd: '2026-07-21T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      invoiceSummary: {
        latestInvoiceStatus: null,
        billingEmail: 'owner@example.com',
        taxId: null,
      },
      actions: {
        canUpdateBilling: false,
        canCancelRenewal: false,
        disabledReason: '線上帳務目前尚未開放。',
      },
    },
  },
}));

vi.mock('@/lib/saas/settings-live-data', () => ({
  loadBillingSettingsView: () => billingMocks.result,
}));

import BillingSettingsPage from '@/app/(admin)/settings/billing/page';

async function renderPage() {
  render(await BillingSettingsPage());
}

describe('BillingSettingsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T00:00:00.000Z'));
    billingMocks.result.data.org.status = 'trialing';
    billingMocks.result.data.subscription.trialEnd = '2026-07-21T00:00:00.000Z';
    billingMocks.result.data.subscription.cancelAtPeriodEnd = false;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows only the essential plan, status, period, and support actions', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: '帳務與訂閱' })).toBeInTheDocument();
    expect(screen.getByText('測試商店')).toBeInTheDocument();
    expect(screen.getByText('試用版')).toBeInTheDocument();
    expect(screen.getByText('試用中')).toBeInTheDocument();
    expect(screen.getByText(/2026\/07\/21/)).toBeInTheDocument();
    expect(screen.getByText(/還剩 3 天/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '聯絡客服' })).toHaveAttribute('href', '/contact');

    expect(screen.queryByText('付款與週期')).not.toBeInTheDocument();
    expect(screen.queryByText('發票資料')).not.toBeInTheDocument();
    expect(screen.queryByText('訂閱狀態說明')).not.toBeInTheDocument();
    expect(screen.queryByText('查看方案')).not.toBeInTheDocument();
    expect(screen.queryByText('查看用量')).not.toBeInTheDocument();
  });

  it('keeps the scheduled cancellation warning inside the compact card', async () => {
    billingMocks.result.data.subscription.cancelAtPeriodEnd = true;

    await renderPage();

    expect(screen.getByText(/訂閱將於 2026\/07\/21 到期後結束/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '聯絡客服' })).toHaveLength(1);
  });

  it('shows an expired trial accurately instead of calling it due today', async () => {
    billingMocks.result.data.subscription.trialEnd = '2026-06-09T00:00:00.000Z';

    await renderPage();

    expect(screen.getByText('試用版')).toBeInTheDocument();
    expect(screen.getByText('試用已到期')).toBeInTheDocument();
    expect(screen.getByText(/2026\/06\/09.*已逾期 39 天/)).toBeInTheDocument();
    expect(screen.queryByText('今天到期')).not.toBeInTheDocument();
  });
});
