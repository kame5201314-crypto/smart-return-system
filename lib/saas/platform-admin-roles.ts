import type { RouteAuthResult } from '@/lib/auth/route-auth';

export type PlatformAdminRole = 'owner' | 'support' | 'billing';

export type PlatformAdminPermission =
  | 'view_platform_dashboard'
  | 'view_organizations'
  | 'view_leads'
  | 'manage_leads'
  | 'view_billing_events'
  | 'manage_billing_operations'
  | 'provision_organizations'
  | 'manage_platform_roles';

export const PLATFORM_ADMIN_ROLES: readonly PlatformAdminRole[] = [
  'owner',
  'support',
  'billing',
];

export const PLATFORM_ADMIN_ROLE_PERMISSIONS: Record<
  PlatformAdminRole,
  readonly PlatformAdminPermission[]
> = {
  owner: [
    'view_platform_dashboard',
    'view_organizations',
    'view_leads',
    'manage_leads',
    'view_billing_events',
    'manage_billing_operations',
    'provision_organizations',
    'manage_platform_roles',
  ],
  support: [
    'view_platform_dashboard',
    'view_organizations',
    'view_leads',
    'manage_leads',
  ],
  billing: [
    'view_platform_dashboard',
    'view_organizations',
    'view_billing_events',
    'manage_billing_operations',
  ],
};

export interface PlatformAdminRoleResolution {
  role: PlatformAdminRole | null;
  source: 'default_owner' | 'mapping' | 'invalid_mapping' | 'not_admin';
}

type ParsedRole = PlatformAdminRole | 'invalid';

function normalizePrincipal(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

export function normalizePlatformAdminRole(value: unknown): PlatformAdminRole | null {
  const normalized = normalizePrincipal(value);
  if (PLATFORM_ADMIN_ROLES.includes(normalized as PlatformAdminRole)) {
    return normalized as PlatformAdminRole;
  }
  return null;
}

function parseRoleEntry(entry: unknown): ParsedRole {
  const role = normalizePlatformAdminRole(entry);
  return role ?? 'invalid';
}

function parseRoleMapFromJson(value: string): Map<string, ParsedRole> | null {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return new Map(
      Object.entries(parsed).flatMap(([principal, role]) => {
        const normalizedPrincipal = normalizePrincipal(principal);
        return normalizedPrincipal ? [[normalizedPrincipal, parseRoleEntry(role)]] : [];
      })
    );
  } catch {
    return null;
  }
}

export function parsePlatformAdminRoleMap(value: unknown): Map<string, ParsedRole> {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return new Map();
  }

  const jsonMap = parseRoleMapFromJson(raw);
  if (jsonMap) {
    return jsonMap;
  }

  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): Array<[string, ParsedRole]> => {
      const separator = entry.includes('=') ? '=' : ':';
      const [principal, role] = entry.split(separator).map((part) => part.trim());
      const normalizedPrincipal = normalizePrincipal(principal);
      if (!normalizedPrincipal || !role) {
        return [];
      }
      return [[normalizedPrincipal, parseRoleEntry(role)]];
    });

  return new Map(entries);
}

export function getPlatformAdminPermissions(
  role: PlatformAdminRole
): readonly PlatformAdminPermission[] {
  return PLATFORM_ADMIN_ROLE_PERMISSIONS[role];
}

export function hasPlatformAdminPermission(
  role: PlatformAdminRole,
  permission: PlatformAdminPermission
): boolean {
  return getPlatformAdminPermissions(role).includes(permission);
}

export function resolvePlatformAdminRole(
  auth: Pick<RouteAuthResult, 'isAdmin' | 'userId' | 'userEmail'>,
  env: Record<string, string | undefined> = process.env
): PlatformAdminRoleResolution {
  if (auth.isAdmin !== true) {
    return {
      role: null,
      source: 'not_admin',
    };
  }

  const roleMap = parsePlatformAdminRoleMap(env.PLATFORM_ADMIN_ROLES);
  const principals = [
    normalizePrincipal(auth.userEmail),
    normalizePrincipal(auth.userId),
  ].filter((principal): principal is string => principal !== null);

  for (const principal of principals) {
    const mappedRole = roleMap.get(principal);
    if (mappedRole === 'invalid') {
      return {
        role: null,
        source: 'invalid_mapping',
      };
    }
    if (mappedRole) {
      return {
        role: mappedRole,
        source: 'mapping',
      };
    }
  }

  return {
    role: 'owner',
    source: 'default_owner',
  };
}
