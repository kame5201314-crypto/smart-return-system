/**
 * Public customer-portal tenant resolver.
 *
 * The portal is unauthenticated, so the tenant is identified by an org SLUG
 * (e.g. from /portal/[orgSlug] or a signed link), never by a client-supplied
 * org id. This module resolves a slug to a real org id server-side and fails
 * closed: an empty/malformed/unknown slug yields null so callers refuse the
 * request instead of falling back to a cross-tenant query.
 *
 * Server-only: uses the service-role admin client.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PortalOrg {
  orgId: string;
  slug: string;
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** Normalize a raw slug; returns null if it is not a syntactically valid slug. */
export function normalizePortalOrgSlug(rawSlug: string | null | undefined): string | null {
  const slug = String(rawSlug ?? '').trim().toLowerCase();
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return null;
  }
  return slug;
}

/**
 * Resolve an org slug to its org id. Fails closed (returns null) for an
 * empty/invalid/unknown slug or on any lookup error.
 */
export async function resolvePortalOrg(
  rawSlug: string | null | undefined
): Promise<PortalOrg | null> {
  const slug = normalizePortalOrgSlug(rawSlug);
  if (!slug) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = (await supabase
      .from('organizations')
      .select('id, slug')
      .eq('slug', slug)
      .maybeSingle()) as { data: { id: string; slug: string } | null; error: unknown };

    if (error || !data?.id) {
      return null;
    }
    return { orgId: data.id, slug: data.slug };
  } catch {
    return null;
  }
}
