import { describe, expect, it } from 'vitest';

import {
  isPlatformAdminFeatureEnabled,
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  resolvePlatformAdminFeatureFlags,
} from '@/lib/saas/platform-admin';

const adminAuth = async () => ({
  ok: true,
  status: 200,
  userId: 'admin-1',
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
    expect(context.featureFlags.multi_tenant_admin).toBe(false);
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
