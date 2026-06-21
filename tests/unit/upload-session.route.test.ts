/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.UPLOAD_SESSION_SECRET = 'upload-session-secret-for-tests-1234567890';

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

import { POST } from '@/app/api/v1/upload/session/route';

function buildOrgClient(slugToOrg: Record<string, { id: string; slug: string }>) {
  function makeBuilder() {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      maybeSingle: async () => ({ data: slugToOrg[String(filters.slug)] ?? null, error: null }),
    };
    return builder;
  }
  return { from: () => makeBuilder() };
}

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/v1/upload/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/upload/session (tenant-bound)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClientMock.mockReturnValue(buildOrgClient({ 'store-a': { id: 'org-a', slug: 'store-a' } }));
  });

  it('fails closed with 400 INVALID_STORE when orgSlug is missing', async () => {
    const res = await POST(req({}) as never);
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe('INVALID_STORE');
  });

  it('fails closed with 400 INVALID_STORE for an unknown store slug', async () => {
    const res = await POST(req({ orgSlug: 'no-such-store' }) as never);
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe('INVALID_STORE');
  });

  it('issues an org-bound session token for a valid store slug', async () => {
    const res = await POST(req({ orgSlug: 'store-a' }) as never);
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.success).toBe(true);
    expect(payload.draftId).toMatch(/^[a-f0-9-]{32,36}$/i);
    expect(payload.sessionToken).toBeTypeOf('string');
    expect(payload.allowedFolders).toContain('product-photos');
    expect(payload.allowedFolders).toContain('shipping-labels');
  });

  it('reuses a provided draftId together with the store slug', async () => {
    const draftId = 'd7f16050-16d8-4d7f-ae4c-ec89b6a31f5c';
    const res = await POST(req({ draftId, orgSlug: 'store-a' }) as never);
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.success).toBe(true);
    expect(payload.draftId).toBe(draftId);
    expect(payload.sessionToken).toBeTypeOf('string');
  });
});
