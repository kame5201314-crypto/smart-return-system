import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({ pathname: '/analytics' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMocks.pathname,
}));

import { WorkspaceAccessBannerContent } from '@/components/saas/workspace-access-banner-content';

const notice = {
  kind: 'trial_expired' as const,
  title: '試用期已到期，如需繼續使用，請前往系統訂閱升級方案。',
};

describe('WorkspaceAccessBannerContent', () => {
  beforeEach(() => {
    navigationMocks.pathname = '/analytics';
  });

  afterEach(() => {
    cleanup();
  });

  it('offers only the in-app billing upgrade action', () => {
    render(<WorkspaceAccessBannerContent notice={notice} />);

    expect(screen.getByText(notice.title)).toBeInTheDocument();
    expect(screen.getByText(notice.title).tagName).toBe('P');
    expect(screen.getByRole('link', { name: '升級方案' })).toHaveAttribute(
      'href',
      '/settings/billing#plans'
    );
    expect(screen.queryByText('聯絡客服')).not.toBeInTheDocument();
  });

  it('does not repeat the access banner on the billing page', () => {
    navigationMocks.pathname = '/settings/billing';

    render(<WorkspaceAccessBannerContent notice={notice} />);

    expect(screen.queryByText(notice.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '升級方案' })).not.toBeInTheDocument();
  });
});
