import { describe, expect, it, vi } from 'vitest';

import {
  canBypassPasswordLoginTurnstileForLocalDevelopment,
  PASSWORD_LOGIN_TURNSTILE_ACTION,
  TURNSTILE_SITEVERIFY_URL,
  verifyPasswordLoginTurnstile,
} from '@/lib/auth/turnstile-verification';

const VALID_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_URL: 'https://smart-return.example.com',
  TURNSTILE_SECRET_KEY: 'real-turnstile-secret',
};

function jsonResponse(data: unknown, ok = true): Response {
  return { ok, json: async () => data } as Response;
}

describe('Turnstile server-side verification', () => {
  it('allows bypass only for an explicit loopback development URL', () => {
    expect(canBypassPasswordLoginTurnstileForLocalDevelopment({
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
    })).toBe(true);
    expect(canBypassPasswordLoginTurnstileForLocalDevelopment({
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3001',
    })).toBe(true);

    for (const env of [
      { NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://localhost:3001' },
      { NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'https://smart-return.example.com' },
      { NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://192.168.1.20:3001' },
      { NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'not-a-url' },
    ]) {
      expect(canBypassPasswordLoginTurnstileForLocalDevelopment(env)).toBe(false);
    }
  });

  it('rejects missing and oversized tokens before any network request', async () => {
    const fetcher = vi.fn();

    expect(await verifyPasswordLoginTurnstile(
      { token: '' },
      { env: VALID_ENV, fetcher }
    )).toEqual({ ok: false, reason: 'invalid_input' });
    expect(await verifyPasswordLoginTurnstile(
      { token: 'x'.repeat(2049) },
      { env: VALID_ENV, fetcher }
    )).toEqual({ ok: false, reason: 'invalid_input' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails closed for missing configuration and production test secrets', async () => {
    const fetcher = vi.fn();
    expect(await verifyPasswordLoginTurnstile(
      { token: 'token' },
      { env: { ...VALID_ENV, TURNSTILE_SECRET_KEY: '' }, fetcher }
    )).toEqual({ ok: false, reason: 'configuration_error' });
    expect(await verifyPasswordLoginTurnstile(
      { token: 'token' },
      {
        env: {
          ...VALID_ENV,
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
        },
        fetcher,
      }
    )).toEqual({ ok: false, reason: 'configuration_error' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('posts the token and valid IP, then validates action and trusted app hostname', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      action: PASSWORD_LOGIN_TURNSTILE_ACTION,
      hostname: 'smart-return.example.com',
    }));

    const result = await verifyPasswordLoginTurnstile(
      { token: 'verified-token', remoteIp: '203.0.113.7' },
      { env: VALID_ENV, fetcher }
    );

    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('real-turnstile-secret');
    expect(body.get('response')).toBe('verified-token');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('accepts a separately configured trusted platform-admin hostname', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      action: PASSWORD_LOGIN_TURNSTILE_ACTION,
      hostname: 'admin.smart-return.example.com',
    }));

    const result = await verifyPasswordLoginTurnstile(
      { token: 'verified-admin-token' },
      {
        env: {
          ...VALID_ENV,
          NEXT_PUBLIC_ADMIN_URL: 'https://admin.smart-return.example.com',
        },
        fetcher,
      }
    );

    expect(result).toEqual({ ok: true });
  });

  it('fails closed before Siteverify when a configured admin origin is invalid', async () => {
    const fetcher = vi.fn();

    for (const adminUrl of [
      'http://admin.smart-return.example.com',
      'https://user:pass@admin.smart-return.example.com',
      'https://admin.smart-return.example.com/path',
    ]) {
      expect(await verifyPasswordLoginTurnstile(
        { token: 'token' },
        { env: { ...VALID_ENV, NEXT_PUBLIC_ADMIN_URL: adminUrl }, fetcher }
      )).toEqual({ ok: false, reason: 'configuration_error' });
    }

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects challenge, action, and hostname mismatches', async () => {
    const cases = [
      [{ success: false }, 'challenge_rejected'],
      [{ success: true, action: 'other', hostname: 'smart-return.example.com' }, 'action_mismatch'],
      [{ success: true, action: PASSWORD_LOGIN_TURNSTILE_ACTION, hostname: 'evil.example.com' }, 'hostname_mismatch'],
    ] as const;

    for (const [payload, reason] of cases) {
      const result = await verifyPasswordLoginTurnstile(
        { token: 'token' },
        { env: VALID_ENV, fetcher: vi.fn().mockResolvedValue(jsonResponse(payload)) }
      );
      expect(result).toEqual({ ok: false, reason });
    }
  });

  it('fails closed on HTTP, JSON, and network errors without retrying', async () => {
    const httpFetcher = vi.fn().mockResolvedValue(jsonResponse({}, false));
    const jsonFetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('invalid json'); },
    } as unknown as Response);
    const networkFetcher = vi.fn().mockRejectedValue(new Error('network unavailable'));

    for (const fetcher of [httpFetcher, jsonFetcher, networkFetcher]) {
      expect(await verifyPasswordLoginTurnstile(
        { token: 'token' },
        { env: VALID_ENV, fetcher }
      )).toEqual({ ok: false, reason: 'provider_error' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('aborts a stalled provider request and fails closed', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }));
      const verification = verifyPasswordLoginTurnstile(
        { token: 'token' },
        { env: VALID_ENV, fetcher, timeoutMs: 250 }
      );

      await vi.advanceTimersByTimeAsync(250);
      expect(await verification).toEqual({ ok: false, reason: 'provider_error' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
