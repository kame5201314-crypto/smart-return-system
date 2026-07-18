import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import InternalLayout from '@/app/internal/layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/internal' }));
vi.mock('@/lib/actions/auth', () => ({ leavePlatformAdmin: vi.fn() }));

describe('InternalLayout', () => {
  afterEach(cleanup);

  it('keeps trial applications out of the primary operations navigation', () => {
    render(
      <InternalLayout>
        <div>營運內容</div>
      </InternalLayout>
    );

    expect(screen.getAllByRole('link', { name: /總覽/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /租戶管理/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /試用申請/ })).not.toBeInTheDocument();
  });
});
