import { requireRouteAuth, type RouteAuthResult } from '@/lib/auth/route-auth';
import {
  resolveSaaSFeatureFlags,
  type SaaSFeatureFlag,
} from '@/lib/config/feature-flags';

export type PlatformAdminAccessErrorCode =
  | 'unauthenticated'
  | 'admin_required'
  | 'feature_disabled';

export interface PlatformAdminContext {
  userId: string;
  isPlatformAdmin: true;
  featureFlags: Record<SaaSFeatureFlag, boolean>;
}

export interface PlatformAdminAccessOptions {
  auth?: () => Promise<RouteAuthResult>;
  env?: Record<string, string | undefined>;
  requireFeatureFlag?: boolean;
}

export class PlatformAdminAccessError extends Error {
  readonly code: PlatformAdminAccessErrorCode;
  readonly status: number;

  constructor(code: PlatformAdminAccessErrorCode, status: number, message: string) {
    super(message);
    this.name = 'PlatformAdminAccessError';
    this.code = code;
    this.status = status;
  }
}

export function resolvePlatformAdminFeatureFlags(
  env?: Record<string, string | undefined>
): Record<SaaSFeatureFlag, boolean> {
  return resolveSaaSFeatureFlags({
    env,
    orgPlan: 'enterprise',
  });
}

export function isPlatformAdminFeatureEnabled(env?: Record<string, string | undefined>): boolean {
  return resolvePlatformAdminFeatureFlags(env).multi_tenant_admin;
}

export async function requirePlatformAdminAccess(
  options: PlatformAdminAccessOptions = {}
): Promise<PlatformAdminContext> {
  const auth = await (options.auth ?? (() => requireRouteAuth({ requireAdmin: true })))();

  if (!auth.ok || !auth.userId) {
    const status = auth.status || 401;
    throw new PlatformAdminAccessError(
      status === 401 ? 'unauthenticated' : 'admin_required',
      status,
      auth.error || 'Platform admin authentication is required.'
    );
  }

  if (!auth.isAdmin) {
    throw new PlatformAdminAccessError(
      'admin_required',
      403,
      'Platform admin role is required.'
    );
  }

  const featureFlags = resolvePlatformAdminFeatureFlags(options.env);
  const shouldRequireFeatureFlag = options.requireFeatureFlag ?? true;

  if (shouldRequireFeatureFlag && !featureFlags.multi_tenant_admin) {
    throw new PlatformAdminAccessError(
      'feature_disabled',
      403,
      'The multi-tenant admin feature flag is disabled.'
    );
  }

  return {
    userId: auth.userId,
    isPlatformAdmin: true,
    featureFlags,
  };
}
