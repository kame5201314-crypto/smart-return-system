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

vi.mock('@/components/auth/auth-turnstile', () => ({
  AuthTurnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => (
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

  it('keeps one Google retry action beside the expired-flow message', () => {
    navigationMocks.search = 'error=google_auth_expired&next=%2Freturns&plan=growth';

    render(<LoginPageContent googleAuthEnabled />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Google 登入未完成，請再試一次。'
    );
    const retryLink = screen.getByRole('link', { name: '重新使用 Google 登入' });
    expect(retryLink).toHaveAttribute(
      'href',
      '/auth/google?next=%2Fanalytics&plan=basic'
    );
    expect(within(retryLink).getByTestId('google-sign-in-icon')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Google 登入/ })).toHaveLength(1);
    expect(toastMocks.error).not.toHaveBeenCalled();

    const passwordLoginButton = screen.getByRole('button', { name: '登入' });
    expect(
      passwordLoginButton.compareDocumentPosition(retryLink)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    expect(screen.getByRole('button', { name: '登入' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '完成登入安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(authActionMocks.signIn).toHaveBeenCalledWith({
      identifier: 'owner@example.com',
      password: 'Password8',
      surface: 'merchant',
      requestedPath: undefined,
      captchaToken: 'login-captcha-token',
    }));
    expect(navigationMocks.push).toHaveBeenCalledWith('/analytics');
  });

  it('returns an unverified account to the Email verification screen', async () => {
    authActionMocks.signIn.mockResolvedValue({
      success: false,
      error: '信箱尚未完成驗證，請輸入驗證碼後再登入。',
      verificationPath: '/signup?verify=email&identifier=owner%40example.com',
    });
    render(<LoginPageContent googleAuthEnabled={false} />);

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledWith(
      '/signup?verify=email&identifier=owner%40example.com'
    ));
    expect(toastMocks.error).toHaveBeenCalledWith(
      '信箱尚未完成驗證，請輸入驗證碼後再登入。'
    );
  });

  it('does not let an internal next parameter impersonate the platform-admin surface', async () => {
    navigationMocks.search = 'next=%2Finternal';
    window.history.replaceState({}, '', '/login?next=%2Finternal');
    authActionMocks.signIn.mockResolvedValue({ success: true, redirectTo: '/analytics' });
    render(
      <LoginPageContent
        googleAuthEnabled={false}
        captchaRequired
        captchaReady
        turnstileSiteKey="site-key"
      />
    );

    expect(screen.getByRole('heading', { name: 'AI退貨管理系統' })).toBeInTheDocument();
    expect(screen.getByText('登入', { selector: '[data-slot="card-title"]' }))
      .toBeInTheDocument();
    expect(screen.queryByText('平台管理後台登入')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'operator@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成登入安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(authActionMocks.signIn).toHaveBeenCalledWith({
      identifier: 'operator@example.com',
      password: 'Password8',
      surface: 'merchant',
      requestedPath: '/internal',
      captchaToken: 'login-captcha-token',
    }));
    expect(navigationMocks.push).toHaveBeenCalledWith('/analytics');
  });

  it('renders a dedicated platform-admin mode and submits its server-normalized destination', async () => {
    authActionMocks.signIn.mockResolvedValue({ success: true, redirectTo: '/internal/orgs' });
    render(
      <LoginPageContent
        mode="platform-admin"
        requestedPath="/internal/orgs"
        googleAuthEnabled
        accountRegistrationEnabled
      />
    );

    expect(screen.getByText('平台管理後台登入')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 繼續' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '建立帳號' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('管理員帳號或電子信箱'), {
      target: { value: 'operator@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(authActionMocks.signIn).toHaveBeenCalledWith({
      identifier: 'operator@example.com',
      password: 'Password8',
      surface: 'platform-admin',
      requestedPath: '/internal/orgs',
      captchaToken: undefined,
    }));
  });

  it('shows recovery only for merchant login and reports a completed reset', () => {
    navigationMocks.search = 'password_reset=success';
    render(<LoginPageContent googleAuthEnabled={false} passwordRecoveryEnabled />);

    expect(screen.getByRole('link', { name: '忘記密碼？' }))
      .toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('status')).toHaveTextContent('密碼已更新，請使用新密碼登入。');
    expect(toastMocks.success).toHaveBeenCalledWith('密碼已更新，請使用新密碼登入。');
  });

  it('confirms that a Google account password was added successfully', () => {
    navigationMocks.search = 'password_setup=success';
    render(<LoginPageContent googleAuthEnabled={false} />);

    expect(screen.getByRole('status'))
      .toHaveTextContent('密碼已設定，請使用信箱與新密碼登入。');
    expect(toastMocks.success)
      .toHaveBeenCalledWith('密碼已設定，請使用信箱與新密碼登入。');
  });

  it('never exposes merchant password recovery on the platform admin login', () => {
    navigationMocks.search = 'next=%2Finternal';
    render(
      <LoginPageContent
        mode="platform-admin"
        requestedPath="/internal"
        googleAuthEnabled={false}
        passwordRecoveryEnabled
      />
    );

    expect(screen.queryByRole('link', { name: '忘記密碼？' }))
      .not.toBeInTheDocument();
  });

  it('shows a clear account registration action and normalizes legacy Growth links', () => {
    navigationMocks.search = 'plan=growth';
    render(
      <LoginPageContent
        googleAuthEnabled
        googleSignupEnabled
        accountRegistrationEnabled
      />
    );

    expect(screen.getByRole('link', { name: '建立帳號' }))
      .toHaveAttribute('href', '/signup?plan=basic');
    expect(screen.queryByText('第一次使用 AI退貨管理系統？')).not.toBeInTheDocument();
    expect(screen.getByText('第一次使用 Google？驗證後會先完成商家資料。'))
      .toBeInTheDocument();
  });

  it('places password login before the branded Google login action', () => {
    render(<LoginPageContent googleAuthEnabled />);

    const passwordLoginButton = screen.getByRole('button', { name: '登入' });
    const googleLoginLink = screen.getByRole('link', { name: '使用 Google 繼續' });

    expect(
      passwordLoginButton.compareDocumentPosition(googleLoginLink)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(googleLoginLink).getByTestId('google-sign-in-icon'))
      .toHaveAttribute('src', expect.stringContaining('google-sign-in-light-square.png'));
  });

  it('hides every public Google entry and its promotional copy when the UI switch is closed', () => {
    render(<LoginPageContent googleAuthEnabled={false} accountRegistrationEnabled />);

    expect(screen.queryByRole('link', { name: '使用 Google 繼續' }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/第一次使用 Google/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI退貨管理系統' })).toBeInTheDocument();
    expect(screen.getByText('登入', { selector: '[data-slot="card-title"]' }))
      .toBeInTheDocument();
    expect(screen.getByLabelText('電子信箱')).toHaveAttribute('placeholder', 'name@example.com');
    expect(screen.queryByText(/手機號碼/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '建立帳號' }))
      .toHaveAttribute('href', '/signup');
    expect(screen.getByText('密碼會區分英文字母大小寫。')).toBeInTheDocument();
  });

  it('rejects phone numbers on the merchant password login surface', () => {
    render(<LoginPageContent googleAuthEnabled={false} />);

    const emailInput = screen.getByLabelText('電子信箱');
    fireEvent.change(emailInput, {
      target: { value: '0912345678' },
    });
    fireEvent.change(screen.getByLabelText('密碼'), {
      target: { value: 'Password8' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(emailInput).toBeInvalid();
    expect(authActionMocks.signIn).not.toHaveBeenCalled();
  });

  it('normalizes legacy plans and does not expose merchant signup to platform admins', () => {
    navigationMocks.search = 'plan=enterprise';
    const { rerender } = render(
      <LoginPageContent googleAuthEnabled accountRegistrationEnabled />
    );

    expect(screen.getByRole('link', { name: '建立帳號' }))
      .toHaveAttribute('href', '/signup?plan=basic');

    navigationMocks.search = 'next=%2Finternal&plan=growth';
    rerender(
      <LoginPageContent
        mode="platform-admin"
        requestedPath="/internal"
        googleAuthEnabled
        accountRegistrationEnabled
      />
    );

    expect(screen.queryByRole('link', { name: '建立帳號' }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '使用 Google 繼續' }))
      .not.toBeInTheDocument();
    expect(screen.getByLabelText('管理員帳號或電子信箱')).toBeInTheDocument();
  });
});
