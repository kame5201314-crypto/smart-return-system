import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  afterEach(() => cleanup());

  it('requires credentials and CAPTCHA, verifies six digits, then continues to workspace setup', async () => {
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled
        initialPlan="growth"
        turnstileSiteKey="site-key"
      />
    );

    expect(screen.getByRole('tab', { name: '電子信箱' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '手機號碼' })).toHaveAttribute('aria-selected', 'false');

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: ' Owner@Example.com ' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    await waitFor(() => expect(authMocks.signUp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Password8',
      options: {
        captchaToken: 'captcha-token',
        data: { signup_channel: 'email', referral_code: undefined },
      },
    }));
    expect(await screen.findByText('輸入驗證碼')).toBeInTheDocument();
    expect(screen.getByText(/ow\*\*\*@example\.com/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '驗證並建立帳號' }));

    await waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        email: 'owner@example.com',
        token: '123456',
        type: 'signup',
      });
      expect(navigationMocks.replace).toHaveBeenCalledWith('/signup/complete?plan=growth');
    });
  });

  it('switches to Taiwan phone signup without opening email behavior', async () => {
    render(
      <VerifiedSignupForm
        emailEnabled
        phoneEnabled
        initialPlan="basic"
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: '手機號碼' }));
    fireEvent.change(screen.getByLabelText('手機號碼'), { target: { value: '0912-345-678' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    await waitFor(() => expect(authMocks.signUp).toHaveBeenCalledWith({
      phone: '+886912345678',
      password: 'Password8',
      options: {
        captchaToken: 'captcha-token',
        channel: 'sms',
        data: { signup_channel: 'phone', referral_code: undefined },
      },
    }));
    expect(screen.getByLabelText('手機驗證碼')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(screen.getByRole('alert')).toHaveTextContent('此驗證方式目前尚未開放，請改用其他方式。');
    expect(screen.queryByText('輸入驗證碼')).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));
    await screen.findByText('輸入驗證碼');

    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '驗證並建立帳號' }));

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

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));
    await screen.findByText('輸入驗證碼');

    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '驗證並建立帳號' }));

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

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));
    await screen.findByText('輸入驗證碼');

    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '驗證並建立帳號' }));

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

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    const form = screen.getByTestId('verified-signup-form');

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(authMocks.signUp).toHaveBeenCalledTimes(1);
    pendingSignup.resolve({ data: { session: null, user: { id: 'user-1' } }, error: null });
    expect(await screen.findByText('輸入驗證碼')).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('電子信箱'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'Password8' } });
    fireEvent.change(screen.getByLabelText('確認密碼'), { target: { value: 'Password8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));
    await screen.findByText('輸入驗證碼');

    const pendingVerification = deferred<{
      data: {
        session: { access_token: string };
        user: { id: string };
      };
      error: null;
    }>();
    authMocks.verifyOtp.mockReturnValue(pendingVerification.promise);
    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
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
