import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

const proofMocks = vi.hoisted(() => ({
  create: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: async () => cookieMocks }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: authMocks }),
}));
vi.mock('@/lib/auth/password-recovery-session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/password-recovery-session')>();
  return {
    ...original,
    createPasswordRecoverySessionToken: proofMocks.create,
    verifyPasswordRecoverySessionToken: proofMocks.verify,
  };
});

import {
  updateRecoveredPassword,
  verifyPasswordRecoveryOtp,
} from '@/lib/actions/password-recovery';
import { PASSWORD_RECOVERY_SESSION_COOKIE } from '@/lib/auth/password-recovery-session';

const CONFIRMED_USER = {
  id: 'user-1',
  email: 'owner@example.com',
  email_confirmed_at: '2026-07-16T00:00:00.000Z',
  phone: null,
  phone_confirmed_at: null,
};

describe('password recovery server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ENABLE_EMAIL_PASSWORD_RECOVERY', 'true');
    vi.stubEnv('ENABLE_PHONE_PASSWORD_RECOVERY', 'true');
    vi.stubEnv('SAAS_AUTH_CAPTCHA_READY', 'true');
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'real-site-key');
    vi.stubEnv('SAAS_EMAIL_OTP_PROVIDER_READY', 'true');
    vi.stubEnv('SAAS_PHONE_OTP_PROVIDER_READY', 'true');
    proofMocks.create.mockResolvedValue('signed-proof');
    proofMocks.verify.mockResolvedValue({ sub: 'user-1', purpose: 'password_recovery' });
    cookieMocks.get.mockReturnValue({ value: 'signed-proof' });
    authMocks.verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'recovery-session' }, user: CONFIRMED_USER },
      error: null,
    });
    authMocks.getUser.mockResolvedValue({ data: { user: CONFIRMED_USER }, error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('creates an HttpOnly proof only after a new matching recovery session exists', async () => {
    const result = await verifyPasswordRecoveryOtp('email', 'Owner@Example.com', '123456');

    expect(result).toEqual({ success: true });
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      token: '123456',
      type: 'recovery',
    });
    expect(proofMocks.create).toHaveBeenCalledWith('user-1');
    expect(cookieMocks.set).toHaveBeenCalledWith(
      PASSWORD_RECOVERY_SESSION_COOKIE,
      'signed-proof',
      expect.objectContaining({ httpOnly: true, maxAge: 600 })
    );
  });

  it('cannot bypass a closed recovery channel by calling the server action directly', async () => {
    vi.stubEnv('ENABLE_EMAIL_PASSWORD_RECOVERY', 'false');

    const result = await verifyPasswordRecoveryOtp('email', 'owner@example.com', '123456');

    expect(result.success).toBe(false);
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
  });

  it('fails closed when verification returns no new session', async () => {
    authMocks.verifyOtp.mockResolvedValue({ data: { session: null, user: CONFIRMED_USER }, error: null });

    const result = await verifyPasswordRecoveryOtp('email', 'owner@example.com', '123456');

    expect(result.success).toBe(false);
    expect(proofMocks.create).not.toHaveBeenCalled();
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it('clears a newly created session when the authenticated identity cannot be confirmed', async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('network') });

    const result = await verifyPasswordRecoveryOtp('email', 'owner@example.com', '123456');

    expect(result.success).toBe(false);
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(proofMocks.create).not.toHaveBeenCalled();
  });

  it('updates the password only with a proof bound to the current user and signs out globally', async () => {
    const result = await updateRecoveredPassword('Password9', 'Password9');

    expect(result).toEqual({ success: true });
    expect(authMocks.updateUser).toHaveBeenCalledWith({ password: 'Password9' });
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(cookieMocks.delete).toHaveBeenCalledWith(PASSWORD_RECOVERY_SESSION_COOKIE);
  });

  it('does not update when a regular login session has no matching recovery proof', async () => {
    proofMocks.verify.mockResolvedValue(null);

    const result = await updateRecoveredPassword('Password9', 'Password9');

    expect(result.success).toBe(false);
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });
});
