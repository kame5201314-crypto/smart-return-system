import { getConfiguredAdminUsername } from '@/lib/auth/admin-login';
import { ADMIN_UUID } from '@/lib/auth/admin-session';
import { parsePlatformAdminRoleMap } from '@/lib/saas/platform-admin-roles';

type PlatformAdminIdentityEnv = Record<string, string | undefined>;

const PLACEHOLDER_ADMIN_EMAIL_ALIASES = new Set(['admin@example.com']);

interface PlatformAdminPrincipalInput {
  userId?: string | null;
  userEmail?: string | null;
  env?: PlatformAdminIdentityEnv;
}

function normalizePrincipal(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function configuredAdminEmailAliases(env: PlatformAdminIdentityEnv): string[] {
  const aliases = new Set<string>();
  const adminEmail = normalizePrincipal(env.ADMIN_EMAIL);
  const adminUsername = normalizePrincipal(getConfiguredAdminUsername(env));

  if (adminEmail && !PLACEHOLDER_ADMIN_EMAIL_ALIASES.has(adminEmail)) {
    aliases.add(adminEmail);
  }

  if (adminUsername?.includes('@') && !PLACEHOLDER_ADMIN_EMAIL_ALIASES.has(adminUsername)) {
    aliases.add(adminUsername);
  }

  return [...aliases];
}

export function isInternalAdminSessionPrincipal(userId: unknown): boolean {
  return normalizePrincipal(userId) === ADMIN_UUID;
}

export function isExplicitPlatformAdminPrincipal({
  userId,
  userEmail,
  env = process.env,
}: PlatformAdminPrincipalInput): boolean {
  if (isInternalAdminSessionPrincipal(userId)) {
    return true;
  }

  const normalizedEmail = normalizePrincipal(userEmail);
  const normalizedUserId = normalizePrincipal(userId);
  const principals = [normalizedEmail, normalizedUserId].filter(
    (principal): principal is string => principal !== null
  );

  const roleMap = parsePlatformAdminRoleMap(env.PLATFORM_ADMIN_ROLES);
  for (const principal of principals) {
    const mappedRole = roleMap.get(principal);
    if (mappedRole && mappedRole !== 'invalid') {
      return true;
    }
  }

  return normalizedEmail !== null && configuredAdminEmailAliases(env).includes(normalizedEmail);
}
