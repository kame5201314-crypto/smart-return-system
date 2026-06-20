/* @vitest-environment node */

import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/internal/schema-drift-alert/route';

const TOKEN = 'schema-drift-token-for-tests-1234567890';
const ENDPOINT = 'http://localhost/api/internal/schema-drift-alert';

function buildRequest(opts: { headerToken?: string; queryToken?: string; body?: unknown } = {}) {
  const url = opts.queryToken
    ? `${ENDPOINT}?token=${encodeURIComponent(opts.queryToken)}`
    : ENDPOINT;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.headerToken) headers['x-schema-drift-token'] = opts.headerToken;
  return new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.body ?? { drift: true }),
  });
}

describe('POST /api/internal/schema-drift-alert (fail-closed auth)', () => {
  const originalToken = process.env.SCHEMA_DRIFT_ALERT_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.SCHEMA_DRIFT_ALERT_TOKEN;
    } else {
      process.env.SCHEMA_DRIFT_ALERT_TOKEN = originalToken;
    }
  });

  it('fails closed with 503 when the alert token is not configured', async () => {
    delete process.env.SCHEMA_DRIFT_ALERT_TOKEN;
    const res = await POST(buildRequest({ headerToken: 'anything' }) as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects with 401 when the token is configured but no header is sent', async () => {
    process.env.SCHEMA_DRIFT_ALERT_TOKEN = TOKEN;
    const res = await POST(buildRequest() as never);
    expect(res.status).toBe(401);
  });

  it('rejects with 401 when the header token does not match', async () => {
    process.env.SCHEMA_DRIFT_ALERT_TOKEN = TOKEN;
    const res = await POST(buildRequest({ headerToken: 'wrong-token-value-1234567890' }) as never);
    expect(res.status).toBe(401);
  });

  it('does not authorize via a query-string token (header only)', async () => {
    process.env.SCHEMA_DRIFT_ALERT_TOKEN = TOKEN;
    const res = await POST(buildRequest({ queryToken: TOKEN }) as never);
    expect(res.status).toBe(401);
  });

  it('accepts a matching header token', async () => {
    process.env.SCHEMA_DRIFT_ALERT_TOKEN = TOKEN;
    const res = await POST(buildRequest({ headerToken: TOKEN }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
