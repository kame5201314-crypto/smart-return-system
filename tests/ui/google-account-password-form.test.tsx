import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  setGoogleAccountPassword: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => navigationMocks }));
vi.mock('@/lib/actions/account-password', () => actionMocks);

import { GoogleAccountPasswordForm } from '@/components/auth/google-account-password-form';

describe('GoogleAccountPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.setGoogleAccountPassword.mockResolvedValue({ success: true });
  });

  afterEach(() => cleanup());

  it('rejects weak passwords before calling the server action', async () => {
    const { container } = render(<GoogleAccountPasswordForm />);
    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'password' } });
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'password' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('8 至 72 碼');
    expect(actionMocks.setGoogleAccountPassword).not.toHaveBeenCalled();
  });

  it('sets a password through the authenticated action and returns to login', async () => {
    const { container } = render(<GoogleAccountPasswordForm />);
    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'Password9' } });
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'Password9' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(actionMocks.setGoogleAccountPassword)
      .toHaveBeenCalledWith('Password9', 'Password9'));
    expect(navigationMocks.replace).toHaveBeenCalledWith('/login?password_setup=success');
    expect(navigationMocks.refresh).toHaveBeenCalled();
  });

  it('shows a server safety warning without claiming success', async () => {
    actionMocks.setGoogleAccountPassword.mockResolvedValue({
      success: false,
      error: '驗證流程已失效，請重新使用 Google 驗證。',
    });
    const { container } = render(<GoogleAccountPasswordForm />);
    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'Password9' } });
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'Password9' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('驗證流程已失效');
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });
});
