import { beforeEach, describe, expect, it } from 'vitest';

import {
  ADMIN_LOGIN_RATE_LIMIT_LOCKOUT_MS,
  ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES,
  buildAdminLoginRateLimitKey,
  checkAdminLoginRateLimit,
  getClientIpFromHeaders,
  recordAdminLoginFailure,
  recordAdminLoginSuccess,
  resetAdminLoginRateLimitForTests,
} from '@/lib/auth/admin-login-rate-limit';

describe('admin login rate limit', () => {
  beforeEach(() => {
    resetAdminLoginRateLimitForTests();
  });

  it('locks a login id and client ip after repeated failures', () => {
    const key = buildAdminLoginRateLimitKey({
      loginId: 'Admin',
      clientIp: '203.0.113.10',
    });
    const now = new Date('2026-05-28T00:00:00.000Z');

    for (let index = 1; index < ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES; index += 1) {
      expect(recordAdminLoginFailure(key, now).allowed).toBe(true);
    }

    const locked = recordAdminLoginFailure(key, now);
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(checkAdminLoginRateLimit(key, now).allowed).toBe(false);
  });

  it('reopens after the lockout expires', () => {
    const key = buildAdminLoginRateLimitKey({
      loginId: 'admin',
      clientIp: '203.0.113.10',
    });
    const now = new Date('2026-05-28T00:00:00.000Z');

    for (let index = 0; index < ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES; index += 1) {
      recordAdminLoginFailure(key, now);
    }

    expect(checkAdminLoginRateLimit(key, now).allowed).toBe(false);
    expect(
      checkAdminLoginRateLimit(
        key,
        new Date(now.getTime() + ADMIN_LOGIN_RATE_LIMIT_LOCKOUT_MS + 1)
      ).allowed
    ).toBe(true);
  });

  it('clears failures after a successful admin login', () => {
    const key = buildAdminLoginRateLimitKey({
      loginId: 'admin',
      clientIp: '203.0.113.10',
    });

    recordAdminLoginFailure(key);
    expect(checkAdminLoginRateLimit(key).failedAttempts).toBe(1);

    recordAdminLoginSuccess(key);
    expect(checkAdminLoginRateLimit(key).failedAttempts).toBe(0);
  });

  it('uses the first forwarded client ip', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 198.51.100.20',
    });

    expect(getClientIpFromHeaders(headers)).toBe('203.0.113.10');
  });
});
