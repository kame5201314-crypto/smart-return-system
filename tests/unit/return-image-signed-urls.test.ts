import { describe, expect, it, vi } from 'vitest';

import {
  buildReturnImageStorageReference,
  getReturnImageStoragePath,
  signReturnImageUrl,
  signReturnImageUrls,
} from '@/lib/storage/return-images';

function buildStorageClient() {
  const createSignedUrl = vi.fn(async (path: string) => ({
    data: { signedUrl: `https://storage.example/signed/${path}` },
    error: null,
  }));

  return {
    client: {
      storage: {
        from: vi.fn(() => ({ createSignedUrl })),
      },
    },
    createSignedUrl,
  };
}

describe('return image signed URL helpers', () => {
  it('stores new image references without public storage URLs', () => {
    expect(buildReturnImageStorageReference('returns/org-a/request-a/photo.jpg'))
      .toBe('storage://return-images/returns/org-a/request-a/photo.jpg');
  });

  it('prefers storage_path when present', () => {
    expect(getReturnImageStoragePath({
      image_url: 'https://legacy.example/public.jpg',
      storage_path: 'returns/org-a/request-a/photo.jpg',
    })).toBe('returns/org-a/request-a/photo.jpg');
  });

  it('extracts storage path from stored storage references', () => {
    expect(getReturnImageStoragePath({
      image_url: 'storage://return-images/returns/org-a/request-a/photo.jpg',
      storage_path: null,
    })).toBe('returns/org-a/request-a/photo.jpg');
  });

  it('signs images before returning them to UI surfaces', async () => {
    const { client, createSignedUrl } = buildStorageClient();

    const signed = await signReturnImageUrl(client, {
      id: 'image-1',
      image_url: 'storage://return-images/returns/org-a/request-a/photo.jpg',
      storage_path: null,
    });

    expect(createSignedUrl).toHaveBeenCalledWith('returns/org-a/request-a/photo.jpg', 3600);
    expect(signed).toEqual({
      id: 'image-1',
      image_url: 'https://storage.example/signed/returns/org-a/request-a/photo.jpg',
      storage_path: 'returns/org-a/request-a/photo.jpg',
    });
  });

  it('keeps legacy public URLs as fallback when there is no storage path', async () => {
    const { client, createSignedUrl } = buildStorageClient();

    const signed = await signReturnImageUrls(client, [{
      image_url: 'https://legacy.example/public.jpg',
      storage_path: null,
    }]);

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(signed[0]?.image_url).toBe('https://legacy.example/public.jpg');
  });
});
