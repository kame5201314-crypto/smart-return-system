import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: authMocks }),
}));

import { setGoogleAccountPassword } from '@/lib/actions/account-password';

const GOOGLE_USER = {
  id: 'user-1',
  email: 'owner@example.com',
  email_confirmed_at: '2026-07-17T00:00:00.000Z',
  identities: [{ provider: 'google' }],
  app_metadata: { provider: 'google', providers: ['google'] },
};

describe('Google account password action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PLATFORM_ADMIN_ROLES', '');
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', '');
    authMocks.getUser.mockResolvedValue({ data: { user: GOOGLE_USER }, error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('sets a password only after a confirmed Google session and signs out globally', async () => {
    const result = await setGoogleAccountPassword('Password9', 'Password9');

    expect(result).toEqual({ success: true });
    expect(authMocks.updateUser).toHaveBeenCalledWith({ password: 'Password9' });
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('rejects an unauthenticated or non-Google session', async () => {
    authMocks.getUser.mockResolvedValue({
      data: {
        user: {
          ...GOOGLE_USER,
          identities: [{ provider: 'email' }],
          app_metadata: { provider: 'email', providers: ['email'] },
        },
      },
      error: null,
    });

    const result = await setGoogleAccountPassword('Password9', 'Password9');

    expect(result).toEqual({
      success: false,
      error: '驗證流程已失效，請重新使用 Google 驗證。',
    });
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it('rejects platform administrator principals', async () => {
    vi.stubEnv('PLATFORM_ADMIN_ROLES', 'owner@example.com=owner');

    const result = await setGoogleAccountPassword('Password9', 'Password9');

    expect(result.success).toBe(false);
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it('rejects weak passwords before reading the session', async () => {
    const result = await setGoogleAccountPassword('password', 'password');

    expect(result.success).toBe(false);
    expect(authMocks.getUser).not.toHaveBeenCalled();
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });
});
