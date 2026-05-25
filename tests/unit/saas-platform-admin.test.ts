import { describe, expect, it } from 'vitest';

import {
  isPlatformAdminFeatureEnabled,
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  resolvePlatformAdminFeatureFlags,
} from '@/lib/saas/platform-admin';
import {
  getPlatformAdminPermissions,
  hasPlatformAdminPermission,
  parsePlatformAdminRoleMap,
  resolvePlatformAdminRole,
} from '@/lib/saas/platform-admin-roles';

const adminAuth = async () => ({
  ok: true,
  status: 200,
  userId: 'admin-1',
  userEmail: 'owner@example.com',
  isAdmin: true,
});

const memberAuth = async () => ({
  ok: true,
  status: 200,
  userId: 'member-1',
  isAdmin: false,
});

describe('SaaS platform admin guard', () => {
  it('keeps multi-tenant admin disabled by default', () => {
    expect(resolvePlatformAdminFeatureFlags({}).multi_tenant_admin).toBe(false);
    expect(isPlatformAdminFeatureEnabled({})).toBe(false);
  });

  it('allows platform admin only when admin auth and feature flag are enabled', async () => {
    await expect(
      requirePlatformAdminAccess({
        auth: adminAuth,
        env: {
          ENABLE_MULTI_TENANT_ADMIN: 'true',
        },
      })
    ).resolves.toMatchObject({
      userId: 'admin-1',
      isPlatformAdmin: true,
      platformRole: 'owner',
      permissions: getPlatformAdminPermissions('owner'),
      featureFlags: {
        multi_tenant_admin: true,
      },
    });
  });

  it('rejects non-admin users even when the feature flag is enabled', async () => {
    await expect(
      requirePlatformAdminAccess({
        auth: memberAuth,
        env: {
          ENABLE_MULTI_TENANT_ADMIN: 'true',
        },
      })
    ).rejects.toMatchObject({
      code: 'admin_required',
      status: 403,
    });
  });

  it('rejects admin users when the feature flag is still closed', async () => {
    await expect(
      requirePlatformAdminAccess({
        auth: adminAuth,
        env: {},
      })
    ).rejects.toMatchObject({
      code: 'feature_disabled',
      status: 403,
    });
  });

  it('can validate admin identity without opening the rollout flag for skeleton pages', async () => {
    const context = await requirePlatformAdminAccess({
      auth: adminAuth,
      env: {},
      requireFeatureFlag: false,
    });

    expect(context.isPlatformAdmin).toBe(true);
    expect(context.platformRole).toBe('owner');
    expect(context.featureFlags.multi_tenant_admin).toBe(false);
  });

  it('resolves explicit platform admin role mappings by email or user id', () => {
    const env = {
      PLATFORM_ADMIN_ROLES: 'billing@example.com=billing, support-user:support',
    };

    expect(
      resolvePlatformAdminRole(
        {
          isAdmin: true,
          userId: 'admin-1',
          userEmail: 'billing@example.com',
        },
        env
      )
    ).toMatchObject({
      role: 'billing',
      source: 'mapping',
    });
    expect(
      resolvePlatformAdminRole(
        {
          isAdmin: true,
          userId: 'support-user',
          userEmail: undefined,
        },
        env
      )
    ).toMatchObject({
      role: 'support',
      source: 'mapping',
    });
  });

  it('parses platform admin role maps from JSON and blocks invalid matching roles', () => {
    const roleMap = parsePlatformAdminRoleMap(JSON.stringify({
      'owner@example.com': 'owner',
      'bad@example.com': 'superuser',
    }));

    expect(roleMap.get('owner@example.com')).toBe('owner');
    expect(roleMap.get('bad@example.com')).toBe('invalid');
    expect(
      resolvePlatformAdminRole(
        {
          isAdmin: true,
          userId: 'bad-user',
          userEmail: 'bad@example.com',
        },
        {
          PLATFORM_ADMIN_ROLES: JSON.stringify({
            'bad@example.com': 'superuser',
          }),
        }
      )
    ).toMatchObject({
      role: null,
      source: 'invalid_mapping',
    });
  });

  it('enforces role permissions before platform routes create service-role clients', async () => {
    await expect(
      requirePlatformAdminAccess({
        auth: adminAuth,
        env: {
          ENABLE_MULTI_TENANT_ADMIN: 'true',
          PLATFORM_ADMIN_ROLES: 'owner@example.com=support',
        },
        requiredPermission: 'manage_billing_operations',
      })
    ).rejects.toMatchObject({
      code: 'permission_denied',
      status: 403,
    });

    const context = await requirePlatformAdminAccess({
      auth: adminAuth,
      env: {
        ENABLE_MULTI_TENANT_ADMIN: 'true',
        PLATFORM_ADMIN_ROLES: 'owner@example.com=billing',
      },
      requiredPermission: 'manage_billing_operations',
    });

    expect(context.platformRole).toBe('billing');
    expect(hasPlatformAdminPermission(context.platformRole, 'manage_billing_operations')).toBe(true);
  });

  it('raises a typed unauthenticated error', async () => {
    await expect(
      requirePlatformAdminAccess({
        auth: async () => ({ ok: false, status: 401, error: 'Unauthorized', isAdmin: false }),
        env: {
          ENABLE_MULTI_TENANT_ADMIN: 'true',
        },
      })
    ).rejects.toBeInstanceOf(PlatformAdminAccessError);
  });
});
