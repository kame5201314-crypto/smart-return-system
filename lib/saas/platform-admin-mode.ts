import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';

export type PlatformAdminModeHiddenReason =
  | 'unauthenticated'
  | 'not_platform_admin'
  | 'feature_disabled'
  | 'error';

export type PlatformAdminModeView =
  | {
      state: 'ready';
      isPlatformAdmin: true;
      userId: string;
      userEmail: string | null;
      platformRole: PlatformAdminContext['platformRole'];
      permissions: PlatformAdminContext['permissions'];
      internalEnabled: boolean;
      links: {
        dashboard: '/internal';
        organizations: '/internal/orgs';
        billingEvents: '/internal/billing/events';
      };
    }
  | {
      state: 'hidden';
      isPlatformAdmin: false;
      reason: PlatformAdminModeHiddenReason;
    };

export interface LoadPlatformAdminModeOptions {
  requireAccess?: () => Promise<PlatformAdminContext>;
}

function mapHiddenReason(error: PlatformAdminAccessError): PlatformAdminModeHiddenReason {
  if (error.code === 'unauthenticated') {
    return 'unauthenticated';
  }

  if (error.code === 'feature_disabled') {
    return 'feature_disabled';
  }

  return 'not_platform_admin';
}

export async function loadPlatformAdminModeView(
  options: LoadPlatformAdminModeOptions = {}
): Promise<PlatformAdminModeView> {
  try {
    const context = await (options.requireAccess ?? (() => requirePlatformAdminAccess({
      requireFeatureFlag: false,
    })))();

    return {
      state: 'ready',
      isPlatformAdmin: true,
      userId: context.userId,
      userEmail: context.userEmail ?? null,
      platformRole: context.platformRole,
      permissions: context.permissions,
      internalEnabled: context.featureFlags.multi_tenant_admin,
      links: {
        dashboard: '/internal',
        organizations: '/internal/orgs',
        billingEvents: '/internal/billing/events',
      },
    };
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return {
        state: 'hidden',
        isPlatformAdmin: false,
        reason: mapHiddenReason(error),
      };
    }

    return {
      state: 'hidden',
      isPlatformAdmin: false,
      reason: 'error',
    };
  }
}
