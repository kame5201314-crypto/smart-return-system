/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

process.env.UPLOAD_SESSION_SECRET = 'upload-session-secret-for-tests-1234567890';

import { POST } from '@/app/api/v1/upload/session/route';

describe('POST /api/v1/upload/session', () => {
  it('creates a new upload session token when draftId is not provided', async () => {
    const response = await POST(new Request('http://localhost/api/v1/upload/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.draftId).toMatch(/^[a-f0-9-]{32,36}$/i);
    expect(payload.sessionToken).toBeTypeOf('string');
    expect(payload.allowedFolders).toContain('product-photos');
    expect(payload.allowedFolders).toContain('shipping-labels');
  });

  it('reuses provided draftId to allow short-lived session refresh', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5c';
    const response = await POST(new Request('http://localhost/api/v1/upload/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId }),
    }) as never);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.draftId).toBe(draftId);
    expect(payload.sessionToken).toBeTypeOf('string');
  });
});

