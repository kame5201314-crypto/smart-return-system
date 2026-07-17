import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  signInWithOtp: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  verifyPasswordRecoveryOtp: vi.fn(),
}));

const readinessFetchMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => navigationMocks }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: authMocks }),
}));
vi.mock('@/lib/actions/password-recovery', () => actionMocks);
vi.mock('@/components/auth/auth-turnstile', () => ({
  AuthTurnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess?.('captcha-token')}>
      完成安全驗證
    </button>
  ),
}));

import { PasswordRecoveryForm } from '@/components/auth/password-recovery-form';

describe('PasswordRecoveryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', readinessFetchMock);
    readinessFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { emailEnabled: true, phoneEnabled: true },
      }),
    } as Response);
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    authMocks.signInWithOtp.mockResolvedValue({ error: null });
    actionMocks.verifyPasswordRecoveryOtp.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('normalizes email, sends a generic response, and exchanges the OTP for a recovery proof', async () => {
    render(
      <PasswordRecoveryForm emailEnabled phoneEnabled turnstileSiteKey="site-key" />
    );

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: ' Owner@Example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    await waitFor(() => expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'owner@example.com',
      { captchaToken: 'captcha-token' }
    ));
    expect(await screen.findByText('如果帳號存在且可使用此驗證方式，我們已寄出驗證碼。'))
      .toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '驗證帳號' }));

    await waitFor(() => expect(actionMocks.verifyPasswordRecoveryOtp).toHaveBeenCalledWith(
      'email',
      'owner@example.com',
      '123456'
    ));
    expect(navigationMocks.replace).toHaveBeenCalledWith('/reset-password');
  });

  it('requests phone recovery without allowing account creation', async () => {
    render(
      <PasswordRecoveryForm emailEnabled phoneEnabled turnstileSiteKey="site-key" />
    );

    fireEvent.click(screen.getByRole('tab', { name: '手機號碼' }));
    fireEvent.change(screen.getByLabelText('手機號碼'), { target: { value: '0912-345-678' } });
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    await waitFor(() => expect(authMocks.signInWithOtp).toHaveBeenCalledWith({
      phone: '+886912345678',
      options: {
        captchaToken: 'captcha-token',
        channel: 'sms',
        shouldCreateUser: false,
      },
    }));
  });

  it('masks account-existence errors behind the same generic response', async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: new Error('User not found') });
    render(
      <PasswordRecoveryForm emailEnabled phoneEnabled={false} turnstileSiteKey="site-key" />
    );

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'missing@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    expect(await screen.findByText('如果帳號存在且可使用此驗證方式，我們已寄出驗證碼。'))
      .toBeInTheDocument();
    expect(screen.queryByText(/User not found/i)).not.toBeInTheDocument();
  });

  it('does not navigate when the server rejects the recovery proof', async () => {
    actionMocks.verifyPasswordRecoveryOtp.mockResolvedValue({
      success: false,
      error: '帳號復原流程已失效，請重新取得驗證碼。',
    });
    render(
      <PasswordRecoveryForm emailEnabled phoneEnabled={false} turnstileSiteKey="site-key" />
    );

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));
    await screen.findByText('輸入驗證碼');
    fireEvent.change(screen.getByLabelText('信箱驗證碼'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '驗證帳號' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('帳號復原流程已失效');
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });

  it('stops a stale recovery page before Supabase when its channel is closed', async () => {
    readinessFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { emailEnabled: false, phoneEnabled: true },
      }),
    } as Response);
    render(
      <PasswordRecoveryForm emailEnabled phoneEnabled turnstileSiteKey="site-key" />
    );

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '帳號復原服務狀態已更新'
    );
    expect(authMocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('fails closed before Supabase when readiness cannot be trusted', async () => {
    readinessFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { emailEnabled: 'yes' } }),
    } as Response);
    render(
      <PasswordRecoveryForm
        emailEnabled
        phoneEnabled={false}
        turnstileSiteKey="site-key"
      />
    );

    fireEvent.change(screen.getByLabelText('電子信箱'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '完成安全驗證' }));
    fireEvent.click(screen.getByRole('button', { name: '傳送驗證碼' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '目前無法確認帳號復原服務狀態'
    );
    expect(authMocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
