import { describe, expect, it } from 'vitest';

import {
  buildClientRateLimitKey,
  createInMemoryRateLimiter,
  getClientIpForRateLimit,
} from '@/lib/security/request-rate-limit';

describe('request rate limit helper', () => {
  it('limits repeated requests within the same window', () => {
    const limiter = createInMemoryRateLimiter({
      maxRequests: 2,
      windowMs: 60_000,
    });
    const key = 'signup:203.0.113.10';
    const now = new Date('2026-05-28T00:00:00.000Z');

    expect(limiter.check(key, now).allowed).toBe(true);
    expect(limiter.check(key, now).allowed).toBe(true);

    const blocked = limiter.check(key, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('opens a key after the window expires', () => {
    const limiter = createInMemoryRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
    });
    const key = 'signup:203.0.113.10';
    const now = new Date('2026-05-28T00:00:00.000Z');

    expect(limiter.check(key, now).allowed).toBe(true);
    expect(limiter.check(key, now).allowed).toBe(false);
    expect(limiter.check(key, new Date(now.getTime() + 60_001)).allowed).toBe(true);
  });

  it('uses the first forwarded client ip', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 198.51.100.20',
    });

    expect(getClientIpForRateLimit(headers)).toBe('203.0.113.10');
  });

  it('builds scoped keys from ip and user agent', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'Example Browser',
    });

    expect(buildClientRateLimitKey({ scope: 'signup', headers })).toBe(
      'signup:203.0.113.10:example browser'
    );
  });
});
