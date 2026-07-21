import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  pathname: '/settings/billing',
}));

vi.mock('next/navigation', () => ({
  redirect: navigationMocks.redirect,
  usePathname: () => navigationMocks.pathname,
}));

vi.mock('@/lib/actions/auth', () => ({
  getCurrentMerchantUser: () => Promise.resolve({
    id: 'user-1',
    email: 'owner@example.com',
    name: '測試店家',
    role: 'owner',
  }),
  signOut: vi.fn(),
}));

import AdminLayout from '@/app/(admin)/layout';
import BackupPage from '@/app/(admin)/settings/backup/page';
import SettingsPage from '@/app/(admin)/settings/page';

describe('SettingsPage', () => {
  afterEach(() => cleanup());

  it('opens the system subscription page directly from the merchant navigation', () => {
    render(<AdminLayout><div>頁面內容</div></AdminLayout>);

    const subscriptionLinks = screen.getAllByRole('link', { name: '系統訂閱' });
    expect(subscriptionLinks.length).toBeGreaterThan(0);
    subscriptionLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/settings/billing');
    });
    expect(screen.queryByRole('link', { name: '設定' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /資料.*備份/ })).not.toBeInTheDocument();
  });

  it('redirects legacy settings and backup routes to system subscriptions', () => {
    SettingsPage();
    BackupPage();

    expect(navigationMocks.redirect).toHaveBeenNthCalledWith(1, '/settings/billing');
    expect(navigationMocks.redirect).toHaveBeenNthCalledWith(2, '/settings/billing');
  });
});
