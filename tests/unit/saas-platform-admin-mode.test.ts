import { describe, expect, it } from 'vitest';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { PlatformAdminAccessError, type PlatformAdminContext } from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import { loadPlatformAdminModeView } from '@/lib/saas/platform-admin-mode';

const platformAdminContext: PlatformAdminContext = {
  userId: 'admin-1',
  userEmail: 'owner@example.com',
  isPlatformAdmin: true,
  platformRole: 'owner',
  permissions: getPlatformAdminPermissions('owner'),
  featureFlags: resolveSaaSFeatureFlags({
    env: {
      ENABLE_MULTI_TENANT_ADMIN: 'true',
    },
    orgPlan: 'enterprise',
  }),
};

describe('platform admin mode view', () => {
  it('returns the platform admin mode contract for UI indicators', async () => {
    const result = await loadPlatformAdminModeView({
      requireAccess: async () => platformAdminContext,
    });

    expect(result).toEqual({
      state: 'ready',
      isPlatformAdmin: true,
      userId: 'admin-1',
      userEmail: 'owner@example.com',
      platformRole: 'owner',
      permissions: getPlatformAdminPermissions('owner'),
      internalEnabled: true,
      links: {
        dashboard: '/internal',
        organizations: '/internal/orgs',
        billingEvents: '/internal/billing/events',
      },
    });
  });

  it('can identify admins before the internal console flag is enabled', async () => {
    const result = await loadPlatformAdminModeView({
      requireAccess: async () => ({
        ...platformAdminContext,
        featureFlags: resolveSaaSFeatureFlags({
          env: {
            ENABLE_MULTI_TENANT_ADMIN: 'false',
          },
          orgPlan: 'enterprise',
        }),
      }),
    });

    expect(result).toMatchObject({
      state: 'ready',
      isPlatformAdmin: true,
      internalEnabled: false,
    });
  });

  it('hides the indicator for unauthenticated visitors', async () => {
    const result = await loadPlatformAdminModeView({
      requireAccess: async () => {
        throw new PlatformAdminAccessError(
          'unauthenticated',
          401,
          'Platform admin authentication is required.'
        );
      },
    });

    expect(result).toEqual({
      state: 'hidden',
      isPlatformAdmin: false,
      reason: 'unauthenticated',
    });
  });

  it('hides the indicator for authenticated non-admin users', async () => {
    const result = await loadPlatformAdminModeView({
      requireAccess: async () => {
        throw new PlatformAdminAccessError(
          'admin_required',
          403,
          'Platform admin role is required.'
        );
      },
    });

    expect(result).toEqual({
      state: 'hidden',
      isPlatformAdmin: false,
      reason: 'not_platform_admin',
    });
  });

  it('hides unexpected failures without leaking details', async () => {
    const result = await loadPlatformAdminModeView({
      requireAccess: async () => {
        throw new Error('database unavailable');
      },
    });

    expect(result).toEqual({
      state: 'hidden',
      isPlatformAdmin: false,
      reason: 'error',
    });
  });
});
