import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const headerMocks = vi.hoisted(() => ({
  headers: new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}));

const cookieMocks = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
}));

const rateLimitMocks = vi.hoisted(() => ({
  check: vi.fn(),
  failure: vi.fn(),
  success: vi.fn(),
}));

const turnstileMocks = vi.hoisted(() => ({ verify: vi.fn() }));
const adminSessionMocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => headerMocks.headers,
  cookies: async () => cookieMocks,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/auth/admin-login-rate-limit', () => ({
  buildAdminLoginRateLimitKey: ({ loginId, clientIp }: { loginId: string; clientIp: string }) =>
    `${loginId}:${clientIp}`,
  checkAdminLoginRateLimit: rateLimitMocks.check,
  getClientIpFromHeaders: () => '203.0.113.9',
  recordAdminLoginFailure: rateLimitMocks.failure,
  recordAdminLoginSuccess: rateLimitMocks.success,
}));
vi.mock('@/lib/auth/turnstile-verification', () => ({
  verifyPasswordLoginTurnstile: turnstileMocks.verify,
}));
vi.mock('@/lib/auth/admin-session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/admin-session')>();
  return { ...original, createAdminSessionToken: adminSessionMocks.create };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { signIn } from '@/lib/actions/auth';

function configureCaptcha(captchaReady: boolean) {
  vi.stubEnv('SAAS_AUTH_CAPTCHA_READY', captchaReady ? 'true' : 'false');
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', captchaReady ? 'site-key' : '');
}

describe('legacy admin auth action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'strong-admin-password');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'admin-session-secret');
    configureCaptcha(false);
    rateLimitMocks.check.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    turnstileMocks.verify.mockResolvedValue({ ok: true });
    adminSessionMocks.create.mockResolvedValue('admin-session-token');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('preserves legacy behavior while the CAPTCHA rollout flag is closed', async () => {
    const result = await signIn('admin', 'strong-admin-password', '/internal');

    expect(result).toEqual({ success: true, redirectTo: '/internal' });
    expect(turnstileMocks.verify).not.toHaveBeenCalled();
    expect(cookieMocks.set).toHaveBeenCalledTimes(1);
  });

  it('fails closed and records a failure when server-side verification is rejected', async () => {
    turnstileMocks.verify.mockResolvedValue({ ok: false, reason: 'challenge_rejected' });
    configureCaptcha(true);

    const result = await signIn(
      'admin',
      'strong-admin-password',
      '/internal',
      'invalid-token'
    );

    expect(result).toEqual({
      success: false,
      error: '安全驗證失敗，請重新完成驗證後再試。',
    });
    expect(turnstileMocks.verify).toHaveBeenCalledWith({
      token: 'invalid-token',
      remoteIp: '203.0.113.9',
    });
    expect(rateLimitMocks.failure).toHaveBeenCalledTimes(1);
    expect(cookieMocks.set).not.toHaveBeenCalled();
  });

  it('creates the admin cookie only after server verification succeeds', async () => {
    configureCaptcha(true);

    const result = await signIn(
      'admin',
      'strong-admin-password',
      '/internal',
      'verified-token'
    );

    expect(result.success).toBe(true);
    expect(turnstileMocks.verify).toHaveBeenCalledTimes(1);
    expect(cookieMocks.set).toHaveBeenCalledTimes(1);
    expect(rateLimitMocks.success).toHaveBeenCalledTimes(1);
  });

  it('does not spend a Turnstile token after the rate limit is already locked', async () => {
    rateLimitMocks.check.mockReturnValue({ allowed: false, retryAfterSeconds: 60 });
    configureCaptcha(true);

    const result = await signIn('admin', 'strong-admin-password', '/internal', 'token');

    expect(result.success).toBe(false);
    expect(turnstileMocks.verify).not.toHaveBeenCalled();
    expect(cookieMocks.set).not.toHaveBeenCalled();
  });
});
