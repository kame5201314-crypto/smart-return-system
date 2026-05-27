import {
  CUSTOMER_POST_LOGIN_PATH,
  PLATFORM_ADMIN_POST_LOGIN_PATH,
  type PostLoginRedirectPath,
} from '@/lib/auth/post-login-redirect';
import { normalizeInternalNextPath } from '@/lib/auth/internal-login-redirect';

export function resolveAuthenticatedLoginRedirect(input: {
  isPlatformAdminAuthenticated: boolean;
  requestedPath?: unknown;
}): PostLoginRedirectPath {
  if (!input.isPlatformAdminAuthenticated) {
    return CUSTOMER_POST_LOGIN_PATH;
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
  if (input.pathname !== '/admin' || !input.isAuthenticated) {
    return null;
  }

  if (input.isPlatformAdminAuthenticated) {
    return null;
  }

  return CUSTOMER_POST_LOGIN_PATH;
}
