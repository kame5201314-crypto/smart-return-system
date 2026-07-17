import { getSaaSPlanDefinition, type SaaSPlanCode } from '@/lib/config/saas-plans';

export type SaaSFeatureFlag =
  | 'public_signup'
  | 'public_lead_capture'
  | 'google_auth'
  | 'google_auth_ui'
  | 'google_trial_signup'
  | 'email_otp_signup'
  | 'phone_otp_signup'
  | 'billing'
  | 'subscription_plan'
  | 'ai_usage_limit'
  | 'advanced_analytics'
  | 'multi_tenant_admin'
  | 'image_ai';

export const SAAS_FEATURE_FLAG_ENV: Record<SaaSFeatureFlag, string> = {
  public_signup: 'ENABLE_PUBLIC_SIGNUP',
  public_lead_capture: 'ENABLE_PUBLIC_LEAD_CAPTURE',
  google_auth: 'ENABLE_GOOGLE_AUTH',
  google_auth_ui: 'ENABLE_GOOGLE_AUTH_UI',
  google_trial_signup: 'ENABLE_GOOGLE_TRIAL_SIGNUP',
  email_otp_signup: 'ENABLE_EMAIL_OTP_SIGNUP',
  phone_otp_signup: 'ENABLE_PHONE_OTP_SIGNUP',
  billing: 'ENABLE_BILLING',
  subscription_plan: 'ENABLE_SUBSCRIPTION_PLAN',
  ai_usage_limit: 'ENABLE_AI_USAGE_LIMIT',
  advanced_analytics: 'ENABLE_ADVANCED_ANALYTICS',
  multi_tenant_admin: 'ENABLE_MULTI_TENANT_ADMIN',
  image_ai: 'ENABLE_IMAGE_AI',
};

export const DEFAULT_SAAS_FEATURE_FLAGS: Record<SaaSFeatureFlag, boolean> = {
  public_signup: false,
  public_lead_capture: false,
  google_auth: false,
  google_auth_ui: false,
  google_trial_signup: false,
  email_otp_signup: false,
  phone_otp_signup: false,
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

  const hasGoogleAuthUiOverride = envOverrides.google_auth_ui !== undefined
    || typeof params?.orgFeatureFlags?.google_auth_ui === 'boolean';
  if (!hasGoogleAuthUiOverride) {
    resolved.google_auth_ui = resolved.google_auth;
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
