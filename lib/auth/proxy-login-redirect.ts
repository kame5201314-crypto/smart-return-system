import {
  PLATFORM_ADMIN_POST_LOGIN_PATH,
  type PostLoginRedirectPath,
} from '@/lib/auth/post-login-redirect';
import {
  buildInternalLoginRedirect,
  normalizeInternalNextPath,
} from '@/lib/auth/internal-login-redirect';

const CUSTOMER_ACCOUNT_GATE_PATH = '/signup/complete';

export function resolveAuthenticatedLoginRedirect(input: {
  isPlatformAdminAuthenticated: boolean;
  requestedPath?: unknown;
}): PostLoginRedirectPath {
  if (!input.isPlatformAdminAuthenticated) {
    // The completion page performs the membership lookup once, then routes
    // existing merchants to analytics and keeps membership-less users in the
    // required merchant-profile flow. This avoids a database query in proxy.
    return CUSTOMER_ACCOUNT_GATE_PATH;
  }

  if (
    typeof input.requestedPath === 'string' &&
    normalizeInternalNextPath(input.requestedPath) === input.requestedPath
  ) {
    return input.requestedPath;
  }

  return PLATFORM_ADMIN_POST_LOGIN_PATH;
}

export function resolveAuthenticatedAdminEntryRedirect(input: {
  pathname: string;
  isAuthenticated: boolean;
  isPlatformAdminAuthenticated: boolean;
}): PostLoginRedirectPath | null {
  const isAdminEntryPath =
    input.pathname === '/admin' ||
    input.pathname === '/internal' ||
    input.pathname.startsWith('/internal/');

  if (!isAdminEntryPath || !input.isAuthenticated) {
    return null;
  }

  if (input.isPlatformAdminAuthenticated) {
    return null;
  }

  return buildInternalLoginRedirect(input.pathname);
}
