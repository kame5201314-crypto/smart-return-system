/**
 * Shared helpers for the `return-images` storage bucket.
 *
 * Security goal (P0-3): stop depending on permanent public URLs as the read
 * source for return images. Reads are derived from `storage_path` and served
 * via short-lived signed URLs, so the bucket can be switched to private later
 * without breaking reads. This module changes ONLY application code; it does
 * not modify the Supabase bucket, policies, or run any migration.
 *
 * Server-only: this module uses the service-role admin client. It is imported
 * exclusively by server actions / route handlers and must never reach the
 * client bundle.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const RETURN_IMAGES_BUCKET = 'return-images';

/** Default lifetime for signed read URLs (seconds). */
export const RETURN_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export interface ReturnImageLike {
  image_url?: string | null;
  storage_path?: string | null;
}

/**
 * Build an org-prefixed storage path for a new return image.
 *
 * New objects are written under `orgs/{orgId}/returns/...` when an org id is
 * available. Older objects without the prefix stay fully readable because reads
 * key off the stored `storage_path` (see {@link extractReturnImageStoragePath}).
 */
export function buildReturnImageStoragePath(opts: {
  orgId?: string | null;
  returnRequestId: string;
  imageType: string;
  extension?: string | null;
  uniqueSuffix?: string;
}): string {
  const ext = (opts.extension || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const suffix =
    opts.uniqueSuffix || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const safeType = (opts.imageType || 'other').replace(/[^a-z0-9_]/gi, '') || 'other';
  const base = `returns/${opts.returnRequestId}/${safeType}_${suffix}.${ext}`;
  return opts.orgId ? `orgs/${opts.orgId}/${base}` : base;
}

/**
 * Resolve the storage object path for a return image row.
 * Prefers `storage_path`; falls back to parsing a legacy public/sign URL so
 * rows created before this change remain readable.
 */
export function extractReturnImageStoragePath(
  image: ReturnImageLike | null | undefined
): string | null {
  if (!image) return null;

  if (typeof image.storage_path === 'string' && image.storage_path.length > 0) {
    return image.storage_path;
  }

  const url = image.image_url;
  if (typeof url === 'string' && url.length > 0) {
    const markers = [
      `/object/public/${RETURN_IMAGES_BUCKET}/`,
      `/object/sign/${RETURN_IMAGES_BUCKET}/`,
    ];
    for (const marker of markers) {
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        return url.slice(idx + marker.length).split('?')[0];
      }
    }
  }

  return null;
}

/**
 * Create a single short-lived signed read URL from a storage path.
 * Returns null on failure so callers can fall back without throwing.
 */
export async function createReturnImageSignedUrl(
  storagePath: string,
  ttlSeconds: number = RETURN_IMAGE_SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(RETURN_IMAGES_BUCKET)
      .createSignedUrl(storagePath, ttlSeconds);

    if (error || !data?.signedUrl) {
      if (error) console.error('createReturnImageSignedUrl error:', error.message);
      return null;
    }
    return data.signedUrl;
  } catch (error) {
    console.error(
      'createReturnImageSignedUrl exception:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Replace each row's `image_url` with a fresh short-lived signed URL derived
 * from `storage_path`. Rows MUST already be authorized (org-scoped) by the
 * caller's query before this is called. On any signing failure the existing
 * `image_url` is preserved so reads never hard-break. Mutates in place and
 * returns the same array reference.
 */
export async function attachReturnImageSignedUrls<T extends ReturnImageLike>(
  images: T[] | null | undefined,
  ttlSeconds: number = RETURN_IMAGE_SIGNED_URL_TTL_SECONDS
): Promise<T[]> {
  if (!images || images.length === 0) return images ?? [];

  const entries = images.map((image) => ({
    image,
    path: extractReturnImageStoragePath(image),
  }));
  const paths = entries
    .map((entry) => entry.path)
    .filter((path): path is string => typeof path === 'string' && path.length > 0);

  if (paths.length === 0) return images;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(RETURN_IMAGES_BUCKET)
      .createSignedUrls(paths, ttlSeconds);

    if (error || !data) {
      if (error) console.error('attachReturnImageSignedUrls error:', error.message);
      return images;
    }

    const signedByPath = new Map<string, string>();
    for (const item of data) {
      if (item.signedUrl && typeof item.path === 'string') {
        signedByPath.set(item.path, item.signedUrl);
      }
    }

    for (const entry of entries) {
      if (entry.path && signedByPath.has(entry.path)) {
        (entry.image as ReturnImageLike).image_url = signedByPath.get(entry.path) as string;
      }
    }
  } catch (error) {
    console.error(
      'attachReturnImageSignedUrls exception:',
      error instanceof Error ? error.message : error
    );
  }

  return images;
}

/**
 * Best-effort removal of the backing Storage objects for the given return image
 * rows. Intended to be called AFTER the DB rows have been deleted so storage
 * does not retain orphaned PII-bearing files. Never throws.
 */
export async function removeReturnImageObjects(
  images: ReturnImageLike[] | null | undefined
): Promise<{ removed: string[]; error: string | null }> {
  const paths = Array.from(
    new Set(
      (images ?? [])
        .map((image) => extractReturnImageStoragePath(image))
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
    )
  );

  if (paths.length === 0) return { removed: [], error: null };

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(RETURN_IMAGES_BUCKET).remove(paths);
    if (error) {
      console.error('removeReturnImageObjects error:', error.message);
      return { removed: [], error: error.message };
    }
    return { removed: paths, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'remove failed';
    console.error('removeReturnImageObjects exception:', message);
    return { removed: [], error: message };
  }
}
