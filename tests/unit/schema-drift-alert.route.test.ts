/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/internal/schema-drift-alert/route';

const ORIGINAL_TOKEN = process.env.SCHEMA_DRIFT_ALERT_TOKEN;

function request(options: { headerToken?: string; queryToken?: string } = {}): Request {
  const url = new URL('https://example.com/api/internal/schema-drift-alert');
  if (options.queryToken) url.searchParams.set('token', options.queryToken);

  return new Request(url, {
    method: 'POST',
    headers: options.headerToken
      ? { 'content-type': 'application/json', 'x-schema-drift-token': options.headerToken }
      : { 'content-type': 'application/json' },
    body: JSON.stringify({ check: 'schema' }),
  });
}

describe('schema drift alert route authentication', () => {
  beforeEach(() => {
    delete process.env.SCHEMA_DRIFT_ALERT_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.SCHEMA_DRIFT_ALERT_TOKEN;
    } else {
      process.env.SCHEMA_DRIFT_ALERT_TOKEN = ORIGINAL_TOKEN;
    }
  });

  it('returns 503 when the server token is not configured', async () => {
    const response = await POST(request() as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Alert endpoint not configured',
    });
  });

  it('rejects missing, wrong, and query-string tokens', async () => {
    process.env.SCHEMA_DRIFT_ALERT_TOKEN = 'expected-test-token';

    for (const candidate of [
      request(),
      request({ headerToken: 'wrong-token' }),
      request({ queryToken: 'expected-test-token' }),
    ]) {
      const response = await POST(candidate as never);
      expect(response.status).toBe(401);
    }
  });

  it('accepts the configured token only from the request header', async () => {
    process.env.SCHEMA_DRIFT_ALERT_TOKEN = 'expected-test-token';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(request({ headerToken: 'expected-test-token' }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
