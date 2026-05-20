import { getSaaSPlanDefinition, type SaaSPlanCode } from '@/lib/config/saas-plans';

export type SaaSFeatureFlag =
  | 'public_signup'
  | 'billing'
  | 'subscription_plan'
  | 'ai_usage_limit'
  | 'advanced_analytics'
  | 'multi_tenant_admin'
  | 'image_ai';

export const SAAS_FEATURE_FLAG_ENV: Record<SaaSFeatureFlag, string> = {
  public_signup: 'ENABLE_PUBLIC_SIGNUP',
  billing: 'ENABLE_BILLING',
  subscription_plan: 'ENABLE_SUBSCRIPTION_PLAN',
  ai_usage_limit: 'ENABLE_AI_USAGE_LIMIT',
  advanced_analytics: 'ENABLE_ADVANCED_ANALYTICS',
  multi_tenant_admin: 'ENABLE_MULTI_TENANT_ADMIN',
  image_ai: 'ENABLE_IMAGE_AI',
};

export const DEFAULT_SAAS_FEATURE_FLAGS: Record<SaaSFeatureFlag, boolean> = {
  public_signup: false,
  billing: false,
  subscription_plan: false,
  ai_usage_limit: true,
  advanced_analytics: false,
  multi_tenant_admin: false,
  image_ai: false,
};

function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

export function resolveSaaSFeatureFlags(params?: {
  env?: Record<string, string | undefined>;
  orgFeatureFlags?: Partial<Record<SaaSFeatureFlag, boolean>> | null;
  orgPlan?: SaaSPlanCode | string | null;
}): Record<SaaSFeatureFlag, boolean> {
  const env = params?.env || process.env;
  const plan = getSaaSPlanDefinition(params?.orgPlan);
  const resolved = { ...DEFAULT_SAAS_FEATURE_FLAGS };
  const envOverrides: Partial<Record<SaaSFeatureFlag, boolean>> = {};

  (Object.keys(SAAS_FEATURE_FLAG_ENV) as SaaSFeatureFlag[]).forEach((flag) => {
    const envValue = parseBooleanFlag(env[SAAS_FEATURE_FLAG_ENV[flag]]);
    if (envValue !== null) {
      resolved[flag] = envValue;
      envOverrides[flag] = envValue;
    }
  });

  if (params?.orgFeatureFlags) {
    (Object.keys(params.orgFeatureFlags) as SaaSFeatureFlag[]).forEach((flag) => {
      const value = params.orgFeatureFlags?.[flag];
      if (typeof value === 'boolean') {
        resolved[flag] = value;
      }
    });
  }

  if (!plan.hasAdvancedAnalytics) {
    resolved.advanced_analytics = false;
  }

  if (plan.code !== 'enterprise') {
    resolved.multi_tenant_admin = false;
  }

  if (envOverrides.image_ai === false) {
    resolved.image_ai = false;
  }

  return resolved;
}
