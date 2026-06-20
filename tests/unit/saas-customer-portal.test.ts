/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => (key === 'x-forwarded-for' ? '10.0.0.1' : null),
  }),
}));

import { searchReturnForPortal, searchReturnsByPhone } from '@/lib/actions/customer-return.actions';

const ORGS: Record<string, { id: string; slug: string }> = {
  'store-a': { id: 'org-a', slug: 'store-a' },
  'store-b': { id: 'org-b', slug: 'store-b' },
};

interface ReturnFixture {
  id: string;
  org_id: string;
  request_number: string;
  status: string;
  channel_source: string | null;
  reason_detail: string | null;
  created_at: string;
  order: { order_number: string; customer_name: string | null; customer_phone: string };
  return_images: Array<{ id: string; image_url: string; storage_path: string; image_type: string | null }>;
}

const RETURNS: ReturnFixture[] = [
  {
    id: 'r1',
    org_id: 'org-a',
    request_number: 'RMA-A-1',
    status: 'pending_review',
    channel_source: 'official',
    reason_detail: 'broken',
    created_at: '2026-01-01T00:00:00.000Z',
    order: { order_number: 'OA1', customer_name: 'Alice', customer_phone: '0911111111' },
    return_images: [
      { id: 'img1', image_url: 'https://public.example/a.jpg', storage_path: 'orgs/org-a/returns/r1/1.jpg', image_type: 'product_damage' },
    ],
  },
  {
    id: 'r2',
    org_id: 'org-b',
    request_number: 'RMA-B-1',
    status: 'pending_review',
    channel_source: 'official',
    reason_detail: 'wrong size',
    created_at: '2026-01-02T00:00:00.000Z',
    order: { order_number: 'OB1', customer_name: 'Bob', customer_phone: '0922222222' },
    return_images: [],
  },
];

function makeBuilder(resolve: (filters: Record<string, unknown>) => { data: unknown; error: unknown }) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    },
    in: (col: string, vals: unknown) => {
      filters[col] = vals;
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => resolve(filters),
    single: async () => resolve(filters),
  };
  return builder;
}

function buildClient() {
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}` })),
    error: null,
  }));

  const client = {
    from: (table: string) => {
      if (table === 'organizations') {
        return makeBuilder((f) => ({ data: ORGS[String(f.slug)] ?? null, error: null }));
      }
      if (table === 'return_requests') {
        return makeBuilder((f) => {
          const match = RETURNS.find((r) => r.org_id === f.org_id && r.request_number === f.request_number);
          return { data: match ? structuredClone(match) : null, error: null };
        });
      }
      return makeBuilder(() => ({ data: null, error: null }));
    },
    storage: { from: () => ({ createSignedUrls }) },
  };

  return { client, createSignedUrls };
}

describe('customer portal secure lookup (searchReturnForPortal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { client } = buildClient();
    createAdminClientMock.mockReturnValue(client);
  });

  it('returns the matching return when orgSlug + phone + requestNumber all match', async () => {
    const result = await searchReturnForPortal({ orgSlug: 'store-a', phone: '0911111111', requestNumber: 'RMA-A-1' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].request_number).toBe('RMA-A-1');
    // The order phone must never be echoed back to the client.
    expect(JSON.stringify(result.data)).not.toContain('0911111111');
  });

  it('does not return data when the phone is wrong', async () => {
    const result = await searchReturnForPortal({ orgSlug: 'store-a', phone: '0900000000', requestNumber: 'RMA-A-1' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('does not return data when the request number is wrong', async () => {
    const result = await searchReturnForPortal({ orgSlug: 'store-a', phone: '0911111111', requestNumber: 'RMA-A-NOPE' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('fails closed when the orgSlug is unknown', async () => {
    const result = await searchReturnForPortal({ orgSlug: 'no-such-store', phone: '0911111111', requestNumber: 'RMA-A-1' });
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });

  it('cannot cross-tenant: org A slug cannot read org B return even with B phone + B number', async () => {
    const result = await searchReturnForPortal({ orgSlug: 'store-a', phone: '0922222222', requestNumber: 'RMA-B-1' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('returns return images as short-lived signed URLs (not the stored public URL)', async () => {
    const result = await searchReturnForPortal({ orgSlug: 'store-a', phone: '0911111111', requestNumber: 'RMA-A-1' });
    const image = result.data?.[0].return_images?.[0];
    expect(image?.image_url).toBe('https://signed.example/orgs/org-a/returns/r1/1.jpg');
    expect(image?.image_url).not.toContain('public.example');
  });

  it('legacy phone-only searchReturnsByPhone is fail-closed and returns no PII', async () => {
    const result = await searchReturnsByPhone('0911111111');
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain('已停用');
  });
});
