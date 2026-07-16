import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const authActionMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
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
  signIn: authActionMocks.signIn,
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess?.('login-captcha-token')}>
      完成登入安全驗證
    </button>
  ),
}));

import { LoginPageContent } from '@/components/auth/login-page-content';

describe('LoginPageContent', () => {
  beforeEach(() => {
    navigationMocks.search = '';
    window.history.replaceState({}, '', '/login');
    vi.clearAllMocks();
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
    const retryLink = screen.getByRole('link', { name: '重新使用 Google 登入' });
    expect(retryLink).toHaveAttribute(
      'href',
      '/auth/google?next=%2Freturns&plan=growth'
    );
    expect(within(retryLink).getByTestId('google-sign-in-icon')).toBeInTheDocument();
    expect(toastMocks.error).toHaveBeenCalledWith(
      '登入流程已失效，請重新使用 Google 登入'
    );
  });

  it('passes a fresh CAPTCHA token to merchant password login when Auth CAPTCHA is enabled', async () => {
    authActionMocks.signIn.mockResolvedValue({ success: true, redirectTo: '/analytics' });
    render(
      <LoginPageContent
        googleAuthEnabled={false}
        captchaRequired
        captchaReady
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText('電子信箱／手機號碼'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    expect(screen.getByRole('button', { name: '登入' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '完成登入安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(authActionMocks.signIn).toHaveBeenCalledWith(
      'owner@example.com',
      'Password8',
      undefined,
      'login-captcha-token'
    ));
    expect(navigationMocks.push).toHaveBeenCalledWith('/analytics');
  });

  it('also challenges the platform login page so Supabase admin principals are not locked out', async () => {
    navigationMocks.search = 'next=%2Finternal';
    window.history.replaceState({}, '', '/login?next=%2Finternal');
    authActionMocks.signIn.mockResolvedValue({ success: true, redirectTo: '/internal' });
    render(
      <LoginPageContent
        googleAuthEnabled={false}
        captchaRequired
        captchaReady
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText('電子信箱／手機號碼'), {
      target: { value: 'operator@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成登入安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(authActionMocks.signIn).toHaveBeenCalledWith(
      'operator@example.com',
      'Password8',
      '/internal',
      'login-captcha-token'
    ));
  });

  it('shows recovery only for merchant login and reports a completed reset', () => {
    navigationMocks.search = 'password_reset=success';
    render(<LoginPageContent googleAuthEnabled={false} passwordRecoveryEnabled />);

    expect(screen.getByRole('link', { name: '忘記密碼？使用驗證碼復原' }))
      .toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('status')).toHaveTextContent('密碼已更新，請使用新密碼登入。');
    expect(toastMocks.success).toHaveBeenCalledWith('密碼已更新，請使用新密碼登入。');
  });

  it('never exposes merchant password recovery on the platform admin login', () => {
    navigationMocks.search = 'next=%2Finternal';
    render(<LoginPageContent googleAuthEnabled={false} passwordRecoveryEnabled />);

    expect(screen.queryByRole('link', { name: '忘記密碼？使用驗證碼復原' }))
      .not.toBeInTheDocument();
  });

  it('shows a clear account registration action and preserves the selected plan', () => {
    navigationMocks.search = 'plan=growth';
    render(
      <LoginPageContent
        googleAuthEnabled
        googleSignupEnabled
        accountRegistrationEnabled
      />
    );

    expect(screen.getByRole('link', { name: '註冊新帳號' }))
      .toHaveAttribute('href', '/signup?plan=growth');
    expect(screen.getByText(/可使用 Google 註冊/)).toBeInTheDocument();
  });

  it('places password login before the branded Google login action', () => {
    render(<LoginPageContent googleAuthEnabled />);

    const passwordLoginButton = screen.getByRole('button', { name: '登入' });
    const googleLoginLink = screen.getByRole('link', { name: '使用 Google 登入' });

    expect(
      passwordLoginButton.compareDocumentPosition(googleLoginLink)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(googleLoginLink).getByTestId('google-sign-in-icon'))
      .toHaveAttribute('src', expect.stringContaining('google-sign-in-light-square.png'));
  });

  it('does not forward an unsupported plan or expose merchant signup to platform admins', () => {
    navigationMocks.search = 'plan=enterprise';
    const { rerender } = render(
      <LoginPageContent googleAuthEnabled accountRegistrationEnabled />
    );

    expect(screen.getByRole('link', { name: '註冊新帳號' }))
      .toHaveAttribute('href', '/signup');

    navigationMocks.search = 'next=%2Finternal&plan=growth';
    rerender(<LoginPageContent googleAuthEnabled accountRegistrationEnabled />);

    expect(screen.queryByRole('link', { name: '註冊新帳號' }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 登入' }))
      .not.toBeInTheDocument();
  });
});
