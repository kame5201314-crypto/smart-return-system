import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieGet: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  verifyAdminSession: vi.fn(),
  isExplicitAdmin: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/auth/admin-session', () => ({
  ADMIN_SESSION_COOKIE: 'admin_session',
  ADMIN_UUID: '00000000-0000-0000-0000-000000000001',
  verifyAdminSessionToken: mocks.verifyAdminSession,
}));

vi.mock('@/lib/auth/platform-admin-identity', () => ({
  isExplicitPlatformAdminPrincipal: mocks.isExplicitAdmin,
}));

import { requireRouteAuth } from '@/lib/auth/route-auth';

describe('route auth surface isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: mocks.cookieGet });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.verifyAdminSession.mockResolvedValue({ username: 'admin' });
    mocks.isExplicitAdmin.mockReturnValue(false);
  });

  it('uses the merchant Supabase principal when both sessions coexist', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'valid-admin-session' });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'merchant-user', email: 'merchant@example.test' } },
      error: null,
    });

    await expect(requireRouteAuth()).resolves.toEqual({
      ok: true,
      status: 200,
      userId: 'merchant-user',
      userEmail: 'merchant@example.test',
      isAdmin: false,
    });
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.verifyAdminSession).not.toHaveBeenCalled();
  });

  it('uses the legacy admin session only for an admin-required route', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'valid-admin-session' });

    await expect(requireRouteAuth({ requireAdmin: true })).resolves.toEqual({
      ok: true,
      status: 200,
      userId: '00000000-0000-0000-0000-000000000001',
      userEmail: undefined,
      isAdmin: true,
    });
    expect(mocks.verifyAdminSession).toHaveBeenCalledWith('valid-admin-session');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('does not treat an admin-only cookie as a merchant session', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'valid-admin-session' });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireRouteAuth()).resolves.toEqual({
      ok: false,
      status: 401,
      error: 'Unauthorized',
      isAdmin: false,
    });
    expect(mocks.verifyAdminSession).not.toHaveBeenCalled();
  });

  it('still accepts an explicit Supabase platform admin when no legacy cookie exists', async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.verifyAdminSession.mockResolvedValue(null);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'platform-user', email: 'owner@example.test' } },
      error: null,
    });
    mocks.isExplicitAdmin.mockReturnValue(true);

    await expect(requireRouteAuth({ requireAdmin: true })).resolves.toEqual({
      ok: true,
      status: 200,
      userId: 'platform-user',
      userEmail: 'owner@example.test',
      isAdmin: true,
    });
  });
});
