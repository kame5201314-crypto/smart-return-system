/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

import {
  buildReturnImageStoragePath,
  extractReturnImageStoragePath,
  attachReturnImageSignedUrls,
  removeReturnImageObjects,
} from '@/lib/storage/return-images';

interface StorageMockOptions {
  signError?: { message: string } | null;
  signData?: Array<{ path: string; signedUrl: string | null }> | null;
  removeError?: { message: string } | null;
}

function buildAdminMock(options: StorageMockOptions = {}) {
  const createSignedUrls = vi.fn(async (paths: string[], ttl: number) => {
    if (options.signError) return { data: null, error: options.signError };
    if (options.signData !== undefined) return { data: options.signData, error: null };
    return {
      data: paths.map((p) => ({ path: p, signedUrl: `https://signed.example/${p}?ttl=${ttl}` })),
      error: null,
    };
  });
  const remove = vi.fn(async () => ({ data: [], error: options.removeError || null }));
  const from = vi.fn(() => ({ createSignedUrls, remove }));
  return { client: { storage: { from } }, from, createSignedUrls, remove };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractReturnImageStoragePath', () => {
  it('prefers storage_path when present', () => {
    expect(
      extractReturnImageStoragePath({
        storage_path: 'orgs/o1/returns/r1/x.jpg',
        image_url: 'https://h/storage/v1/object/public/return-images/legacy/y.jpg',
      })
    ).toBe('orgs/o1/returns/r1/x.jpg');
  });

  it('falls back to a legacy public URL', () => {
    expect(
      extractReturnImageStoragePath({
        image_url: 'https://h/storage/v1/object/public/return-images/returns/r1/a.jpg?download=1',
      })
    ).toBe('returns/r1/a.jpg');
  });

  it('falls back to a signed URL marker', () => {
    expect(
      extractReturnImageStoragePath({
        image_url: 'https://h/storage/v1/object/sign/return-images/orgs/o1/returns/r1/b.jpg?token=abc',
      })
    ).toBe('orgs/o1/returns/r1/b.jpg');
  });

  it('returns null when no path can be derived', () => {
    expect(extractReturnImageStoragePath({})).toBeNull();
    expect(extractReturnImageStoragePath({ image_url: 'https://cdn.example/unrelated.jpg' })).toBeNull();
    expect(extractReturnImageStoragePath(null)).toBeNull();
  });
});

describe('buildReturnImageStoragePath', () => {
  it('includes the org prefix when an org id is given', () => {
    const path = buildReturnImageStoragePath({
      orgId: 'o1',
      returnRequestId: 'r1',
      imageType: 'product_damage',
      extension: 'PNG',
      uniqueSuffix: 'fixed',
    });
    expect(path).toBe('orgs/o1/returns/r1/product_damage_fixed.png');
  });

  it('omits the org prefix when no org id is given (legacy compatible)', () => {
    const path = buildReturnImageStoragePath({
      returnRequestId: 'r1',
      imageType: 'other',
      extension: 'jpg',
      uniqueSuffix: 'fixed',
    });
    expect(path).toBe('returns/r1/other_fixed.jpg');
  });
});

describe('attachReturnImageSignedUrls', () => {
  it('replaces image_url with signed URLs in place', async () => {
    const mock = buildAdminMock();
    createAdminClientMock.mockReturnValue(mock.client);

    const images = [
      { id: '1', image_url: 'old-1', storage_path: 'orgs/o1/returns/r1/1.jpg' },
      { id: '2', image_url: 'old-2', storage_path: 'orgs/o1/returns/r1/2.jpg' },
    ];
    const result = await attachReturnImageSignedUrls(images);

    expect(result).toBe(images); // mutated in place
    expect(images[0].image_url).toBe('https://signed.example/orgs/o1/returns/r1/1.jpg?ttl=3600');
    expect(images[1].image_url).toBe('https://signed.example/orgs/o1/returns/r1/2.jpg?ttl=3600');
    expect(mock.createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it('preserves the existing image_url when signing fails (no hard break)', async () => {
    const mock = buildAdminMock({ signError: { message: 'boom' } });
    createAdminClientMock.mockReturnValue(mock.client);

    const images = [{ id: '1', image_url: 'keep-me', storage_path: 'orgs/o1/returns/r1/1.jpg' }];
    await attachReturnImageSignedUrls(images);

    expect(images[0].image_url).toBe('keep-me');
  });

  it('does not call storage when no row has a derivable path', async () => {
    const mock = buildAdminMock();
    createAdminClientMock.mockReturnValue(mock.client);

    const images = [{ id: '1', image_url: 'https://cdn.example/unrelated.jpg', storage_path: null }];
    await attachReturnImageSignedUrls(images);

    expect(mock.createSignedUrls).not.toHaveBeenCalled();
    expect(images[0].image_url).toBe('https://cdn.example/unrelated.jpg');
  });

  it('is a no-op for empty input', async () => {
    const mock = buildAdminMock();
    createAdminClientMock.mockReturnValue(mock.client);
    await expect(attachReturnImageSignedUrls([])).resolves.toEqual([]);
    expect(mock.from).not.toHaveBeenCalled();
  });
});

describe('removeReturnImageObjects', () => {
  it('removes the deduped derived paths (best effort)', async () => {
    const mock = buildAdminMock();
    createAdminClientMock.mockReturnValue(mock.client);

    const result = await removeReturnImageObjects([
      { storage_path: 'orgs/o1/returns/r1/1.jpg', image_url: null },
      { storage_path: 'orgs/o1/returns/r1/1.jpg', image_url: null }, // duplicate
      { storage_path: null, image_url: 'https://h/storage/v1/object/public/return-images/returns/r1/2.jpg' },
    ]);

    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith(['orgs/o1/returns/r1/1.jpg', 'returns/r1/2.jpg']);
    expect(result.error).toBeNull();
    expect(result.removed).toEqual(['orgs/o1/returns/r1/1.jpg', 'returns/r1/2.jpg']);
  });

  it('returns the error without throwing when storage removal fails', async () => {
    const mock = buildAdminMock({ removeError: { message: 'storage down' } });
    createAdminClientMock.mockReturnValue(mock.client);

    const result = await removeReturnImageObjects([{ storage_path: 'orgs/o1/returns/r1/1.jpg' }]);
    expect(result.error).toBe('storage down');
    expect(result.removed).toEqual([]);
  });

  it('does not call storage when there are no derivable paths', async () => {
    const mock = buildAdminMock();
    createAdminClientMock.mockReturnValue(mock.client);

    const result = await removeReturnImageObjects([{ storage_path: null, image_url: null }]);
    expect(mock.remove).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: [], error: null });
  });
});
