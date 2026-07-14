export const CUSTOMER_POST_LOGIN_PATH = '/analytics' as const;
export const PLATFORM_ADMIN_POST_LOGIN_PATH = '/internal' as const;

export type PostLoginRedirectPath =
  | typeof CUSTOMER_POST_LOGIN_PATH
  | typeof PLATFORM_ADMIN_POST_LOGIN_PATH
  | string;

function isInternalPath(pathname: string): boolean {
  return pathname === '/internal' || pathname.startsWith('/internal/');
}

function normalizeLocalRedirectPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }

  if (trimmed.startsWith('/login')) {
    return null;
  }

  return trimmed;
}

export function getPostLoginRedirect(input: {
  isAdmin?: boolean;
  requestedPath?: unknown;
} = {}): PostLoginRedirectPath {
  const isPlatformAdmin = input.isAdmin === true;
  const requestedPath = normalizeLocalRedirectPath(input.requestedPath);

  if (isPlatformAdmin) {
    if (requestedPath && isInternalPath(requestedPath)) {
      return requestedPath;
    }

    return CUSTOMER_POST_LOGIN_PATH;
  }

  if (requestedPath && !isInternalPath(requestedPath)) {
    return requestedPath;
  }

  return CUSTOMER_POST_LOGIN_PATH;
}
