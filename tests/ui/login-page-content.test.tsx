import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  search: '',
  push: vi.fn(),
  refresh: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(navigationMocks.search),
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

vi.mock('@/lib/actions/auth', () => ({
  signIn: vi.fn(),
}));

import { LoginPageContent } from '@/components/auth/login-page-content';

describe('LoginPageContent', () => {
  beforeEach(() => {
    navigationMocks.search = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a persistent expired-flow message and preserves the retry destination', () => {
    navigationMocks.search = 'error=google_auth_expired&next=%2Freturns&plan=growth';

    render(<LoginPageContent googleAuthEnabled />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      '登入流程已失效，請重新使用 Google 登入'
    );
    expect(screen.getByRole('link', { name: '重新使用 Google 登入' })).toHaveAttribute(
      'href',
      '/auth/google?next=%2Freturns&plan=growth'
    );
    expect(toastMocks.error).toHaveBeenCalledWith(
      '登入流程已失效，請重新使用 Google 登入'
    );
  });
});
