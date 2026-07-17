import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InternalMobileNav } from '@/components/internal/mobile-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/internal/orgs' }));

const items = [
  { href: '/internal', label: '總覽', description: '待處理事項', iconName: 'layoutDashboard' as const, exact: true },
  { href: '/internal/orgs', label: '租戶管理', description: '租戶與狀態', iconName: 'building' as const },
] as const;

describe('InternalMobileNav', () => {
  afterEach(cleanup);

  it('announces the current section and exposes an accessible collapsible menu', () => {
    render(<InternalMobileNav items={items} />);

    const trigger = screen.getByRole('button', { name: /管理選單.*租戶管理/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: '商業營運後台行動版選單' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /租戶管理/ })).toHaveAttribute('aria-current', 'page');
  });
});
