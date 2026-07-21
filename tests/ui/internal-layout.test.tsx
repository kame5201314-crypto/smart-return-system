import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InternalLayout from '@/app/internal/layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/internal' }));
vi.mock('@/lib/actions/auth', () => ({ leavePlatformAdmin: vi.fn() }));

describe('InternalLayout', () => {
  afterEach(cleanup);

  it('uses a compact horizontal operations navigation with one active tab', () => {
    render(
      <InternalLayout>
        <h1>營運內容</h1>
      </InternalLayout>
    );

    const navigation = screen.getByRole('navigation', { name: '商業營運後台選單' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(2);
    expect(within(navigation).getByRole('link', { name: '總覽' })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByRole('link', { name: '租戶管理' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: /試用申請/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '商業營運後台' })).not.toBeInTheDocument();
    expect(screen.getByText('商業營運後台')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: '營運內容' })).toBeInTheDocument();
  });
});
