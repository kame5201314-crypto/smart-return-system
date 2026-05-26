import { redirect } from 'next/navigation';

import type { PlatformAdminAccessErrorCode } from '@/lib/saas/platform-admin';

interface PlatformAdminGatedResult {
  state: string;
  gated?: {
    accessCode?: PlatformAdminAccessErrorCode;
  };
}

export function normalizeInternalNextPath(pathname: unknown): string {
  if (typeof pathname !== 'string') {
    return '/internal';
  }

  const trimmed = pathname.trim();
  if (
    (trimmed !== '/internal' && !trimmed.startsWith('/internal/')) ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return '/internal';
  }

  return trimmed;
}

export function buildInternalLoginRedirect(pathname: unknown): string {
  return `/login?next=${encodeURIComponent(normalizeInternalNextPath(pathname))}`;
}

export function getInternalLoginRedirectForPlatformAdminResult(
  result: PlatformAdminGatedResult,
  pathname: unknown
): string | null {
  if (result.state === 'gated' && result.gated?.accessCode === 'unauthenticated') {
    return buildInternalLoginRedirect(pathname);
  }

  return null;
}

export function redirectUnauthenticatedPlatformAdminResult(
  result: PlatformAdminGatedResult,
  pathname: unknown
): void {
  const redirectTo = getInternalLoginRedirectForPlatformAdminResult(result, pathname);
  if (redirectTo) {
    redirect(redirectTo);
  }
}
