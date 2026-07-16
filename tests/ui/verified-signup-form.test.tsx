import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  resend: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMocks,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: authMocks }),
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess?.('captcha-token')}>
      完成安全驗證
    </button>
  ),
}));

import { VerifiedSignupForm } from '@/components/auth/verified-signup-form';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('VerifiedSignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signUp.mockResolvedValue({ data: { session: null, user: { id: 'user-1' } }, error: null });
    authMocks.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: 'verified-session' },
        user: { id: 'user-1' },
      },
      error: null,
    });
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          email_confirmed_at: '2026-07-15T00:00:00.000Z',
          phone: null,
          phone_confirmed_at: null,
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('keeps the Email/password registration form visible but fail closed while Email OTP is unavailable', () => {
    render(
      <VerifiedSignupForm
        emailEnabled={false}
        phoneEnabled={false}
        showEmailWhenUnavailable
        initialPlan="basic"
        turnstileSiteKey=""
        googleSignupHref="/auth/google?plan=basic"
      />
    );

    const credentialsForm = screen.getByTestId('verified-signup-form');
    const unavailableNotice = screen.getByTestId('email-signup-unavailable-notice');
    const googleOption = screen.getByTestId('google-signup-option');

    expect(unavailableNotice).toHaveTextContent('信箱驗證服務準備中');
    expect(unavailableNotice).toHaveTextContent('驗證碼寄送正在設定，目前暫停輸入與送出');
    expect(screen.getByLabelText('電子信箱')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('電子信箱')).toBeDisabled();
    expect(screen.getByLabelText(/^密碼/)).toBeDisabled();
    expect(screen.getByLabelText('確認密碼')).toBeDisabled();
    expect(screen.getByLabelText('推薦碼')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: '完成安全驗證' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '信箱註冊即將開放' })).toBeDisabled();
    expect(within(googleOption).getByRole('link', { name: '使用 Google 繼續' }))
      .toHaveAttribute('href', '/auth/google?plan=basic');
    expect(
      credentialsForm.compareDocumentPosition(googleOption)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.submit(credentialsForm);

    expect(authMocks.signUp).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '信箱驗證服務準備中，目前暫時無法寄送驗證碼。'
    );
  });

  it('does not render an unavailable registration form without the explicit fallback prop', () => {
    const { container } = render(
      <VerifiedSignupForm
        emailEnabled={false}
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey=""
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(authMocks.signUp).not.toHaveBeenCalled();
  });

  it('uses one combined identity field, preserves referral metadata, and verifies Email OTP', async () => {
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled
        initialPlan="growth"
        turnstileSiteKey="site-key"
        googleSignupHref="/auth/google?plan=growth"
      />
    );

    expect(screen.getByLabelText(/手機號碼或電子信箱/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '註冊' })).toBeDisabled();
    const credentialsForm = screen.getByTestId('verified-signup-form');
    const googleOption = screen.getByTestId('google-signup-option');
    const googleLink = within(googleOption).getByRole('link', { name: '使用 Google 繼續' });
    expect(googleLink).toHaveAttribute('href', '/auth/google?plan=growth');
    expect(within(googleLink).getByTestId('google-sign-in-icon')).toBeInTheDocument();
    expect(
      credentialsForm.compareDocumentPosition(googleOption)
      & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/手機號碼或電子信箱/), {
      target: { value: ' Owner@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('推薦碼'), { target: { value: ' FRIEND-88 ' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    await waitFor(() => expect(authMocks.signUp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Password8',
      options: {
        captchaToken: 'captcha-token',
        data: { signup_channel: 'email', referral_code: 'FRIEND-88' },
      },
    }));
    expect(await screen.findByRole('heading', {
      name: '請查收並輸入手機或信箱中的驗證碼',
    })).toBeInTheDocument();
    expect(screen.getByText('Owner@Example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新傳送（60）' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '返回上一步' })).toBeInTheDocument();
    expect(screen.queryByTestId('google-signup-option')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/手機或信箱驗證碼/), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    await waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        email: 'owner@example.com',
        token: '123456',
        type: 'signup',
      });
      expect(navigationMocks.replace).toHaveBeenCalledWith('/signup/complete?plan=growth');
    });
  });

  it('automatically resolves Taiwan phone input without provider tabs', async () => {
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/手機號碼或電子信箱/), {
      target: { value: '0912-345-678' },
    });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    await waitFor(() => expect(authMocks.signUp).toHaveBeenCalledWith({
      phone: '+886912345678',
      password: 'Password8',
      options: {
        captchaToken: 'captcha-token',
        channel: 'sms',
        data: { signup_channel: 'phone', referral_code: undefined },
      },
    }));
    expect(screen.getByLabelText(/手機或信箱驗證碼/)).toBeInTheDocument();
  });

  it('returns from OTP to the combined identity step', async () => {
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/手機號碼或電子信箱/), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    expect(await screen.findByRole('button', { name: '返回上一步' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回上一步' }));

    expect(screen.getByLabelText(/手機號碼或電子信箱/)).toHaveValue('owner@example.com');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('keeps resend behind cooldown and a fresh CAPTCHA while coalescing rapid clicks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-16T00:00:00.000Z'));
    const pendingResend = deferred<{ data: Record<string, never>; error: null }>();
    authMocks.resend.mockReturnValue(pendingResend.promise);

    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    });

    expect(screen.getByRole('button', { name: '重新傳送（60）' })).toBeDisabled();
    expect(screen.queryByText('重新傳送前，請先完成安全驗證。')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(60_000));

    expect(screen.getByText('重新傳送前，請先完成安全驗證。')).toBeInTheDocument();
    const resendButton = screen.getByRole('button', { name: '重新傳送' });
    expect(resendButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    expect(resendButton).toBeEnabled();

    fireEvent.click(resendButton);
    fireEvent.click(resendButton);
    expect(authMocks.resend).toHaveBeenCalledTimes(1);
    expect(authMocks.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'owner@example.com',
      options: { captchaToken: 'captcha-token' },
    });

    await act(async () => {
      pendingResend.resolve({ data: {}, error: null });
      await pendingResend.promise;
    });

    expect(screen.getByRole('button', { name: '重新傳送（60）' })).toBeDisabled();
  });

  it('fails closed and signs out when confirmation is disabled and signup returns a session', async () => {
    authMocks.signUp.mockResolvedValue({
      data: { session: { access_token: 'unexpected-session' }, user: { id: 'user-1' } },
      error: null,
    });
    authMocks.signOut.mockResolvedValue({ error: null });
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(screen.getByRole('alert')).toHaveTextContent('此驗證方式目前尚未開放，請改用其他方式。');
    expect(screen.queryByRole('heading', {
      name: '請查收並輸入手機或信箱中的驗證碼',
    })).not.toBeInTheDocument();
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });

  it('rejects an OTP result whose authenticated identity does not match the requested destination', async () => {
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'different@example.com',
          email_confirmed_at: '2026-07-15T00:00:00.000Z',
          phone: null,
          phone_confirmed_at: null,
        },
      },
      error: null,
    });
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    await screen.findByRole('heading', { name: '請查收並輸入手機或信箱中的驗證碼' });

    fireEvent.change(screen.getByLabelText(/信箱驗證碼/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(screen.getByRole('alert')).toHaveTextContent('驗證服務暫時無法使用，請稍後再試。');
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });

  it('clears the newly verified session when the authenticated user cannot be confirmed', async () => {
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('network error'),
    });
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    await screen.findByRole('heading', { name: '請查收並輸入手機或信箱中的驗證碼' });

    fireEvent.change(screen.getByLabelText(/信箱驗證碼/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });

  it('requires verifyOtp to create a new session before trusting getUser', async () => {
    authMocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: { id: 'user-1' } },
      error: null,
    });
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    await screen.findByRole('heading', { name: '請查收並輸入手機或信箱中的驗證碼' });

    fireEvent.change(screen.getByLabelText(/信箱驗證碼/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('驗證服務暫時無法使用');
    expect(authMocks.getUser).not.toHaveBeenCalled();
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });

  it('coalesces rapid credential submissions into one signup request', async () => {
    const pendingSignup = deferred<{
      data: { session: null; user: { id: string } };
      error: null;
    }>();
    authMocks.signUp.mockReturnValue(pendingSignup.promise);
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    const form = screen.getByTestId('verified-signup-form');

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(authMocks.signUp).toHaveBeenCalledTimes(1);
    pendingSignup.resolve({ data: { session: null, user: { id: 'user-1' } }, error: null });
    expect(await screen.findByRole('heading', {
      name: '請查收並輸入手機或信箱中的驗證碼',
    })).toBeInTheDocument();
  });

  it('coalesces rapid OTP submissions into one verification request', async () => {
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled={false}
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText(/電子信箱/), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText(/^密碼/), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText(/確認密碼/), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '註冊' }));
    await screen.findByRole('heading', { name: '請查收並輸入手機或信箱中的驗證碼' });

    const pendingVerification = deferred<{
      data: {
        session: { access_token: string };
        user: { id: string };
      };
      error: null;
    }>();
    authMocks.verifyOtp.mockReturnValue(pendingVerification.promise);
    fireEvent.change(screen.getByLabelText(/信箱驗證碼/), { target: { value: '123456' } });
    const form = screen.getByTestId('verified-signup-otp-form');

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(authMocks.verifyOtp).toHaveBeenCalledTimes(1);
    pendingVerification.resolve({
      data: {
        session: { access_token: 'verified-session' },
        user: { id: 'user-1' },
      },
      error: null,
    });
    await waitFor(() => expect(navigationMocks.replace)
      .toHaveBeenCalledWith('/signup/complete?plan=basic'));
  });
});
