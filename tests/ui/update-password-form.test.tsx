import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  updateRecoveredPassword: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => navigationMocks }));
vi.mock('@/lib/actions/password-recovery', () => actionMocks);

import { UpdatePasswordForm } from '@/components/auth/update-password-form';

describe('UpdatePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actionMocks.updateRecoveredPassword.mockResolvedValue({ success: true });
  });

  afterEach(() => cleanup());

  it('rejects weak or mismatched passwords before calling the server action', async () => {
    const { container } = render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'password' } });
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'password' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('8 至 72 碼');
    expect(actionMocks.updateRecoveredPassword).not.toHaveBeenCalled();
  });

  it('updates through the guarded server action and returns to login', async () => {
    const { container } = render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'Password9' } });
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'Password9' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(actionMocks.updateRecoveredPassword)
      .toHaveBeenCalledWith('Password9', 'Password9'));
    expect(navigationMocks.replace).toHaveBeenCalledWith('/login?password_reset=success');
    expect(navigationMocks.refresh).toHaveBeenCalled();
  });

  it('shows a server safety warning without claiming success', async () => {
    actionMocks.updateRecoveredPassword.mockResolvedValue({
      success: false,
      error: '密碼已更新，但無法自動登出所有裝置。請關閉瀏覽器並聯絡客服。',
    });
    const { container } = render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'Password9' } });
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'Password9' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('無法自動登出所有裝置');
    expect(navigationMocks.replace).not.toHaveBeenCalled();
  });
});
