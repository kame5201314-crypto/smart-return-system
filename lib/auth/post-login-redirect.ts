export const CUSTOMER_POST_LOGIN_PATH = '/analytics' as const;
export const PLATFORM_ADMIN_POST_LOGIN_PATH = '/internal' as const;

export type PostLoginRedirectPath =
  | typeof CUSTOMER_POST_LOGIN_PATH
  | typeof PLATFORM_ADMIN_POST_LOGIN_PATH;

export function isPlatformAdminProfileRole(role: unknown): boolean {
  return typeof role === 'string' && role.trim().toLowerCase() === 'admin';
}

export function getPostLoginRedirect(input: {
  isAdmin?: boolean;
  profileRole?: unknown;
} = {}): PostLoginRedirectPath {
  if (input.isAdmin === true || isPlatformAdminProfileRole(input.profileRole)) {
    return PLATFORM_ADMIN_POST_LOGIN_PATH;
  }

  return CUSTOMER_POST_LOGIN_PATH;
}
