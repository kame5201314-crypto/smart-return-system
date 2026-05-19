export type SaaSPlanCode = 'basic' | 'growth' | 'pro' | 'enterprise';

export interface SaaSPlanDefinition {
  code: SaaSPlanCode;
  name: string;
  monthlyPriceTwd: number | null;
  aiMonthlyLimit: number | null;
  billingRequired: boolean;
}

export const SAAS_PLAN_DEFINITIONS: Record<SaaSPlanCode, SaaSPlanDefinition> = {
  basic: {
    code: 'basic',
    name: 'Basic',
    monthlyPriceTwd: 1490,
    aiMonthlyLimit: 5,
    billingRequired: true,
  },
  growth: {
    code: 'growth',
    name: 'Growth',
    monthlyPriceTwd: 2990,
    aiMonthlyLimit: 30,
    billingRequired: true,
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    monthlyPriceTwd: 7990,
    aiMonthlyLimit: 100,
    billingRequired: true,
  },
  enterprise: {
    code: 'enterprise',
    name: 'Enterprise',
    monthlyPriceTwd: null,
    aiMonthlyLimit: null,
    billingRequired: false,
  },
};

export function normalizeSaaSPlanCode(value: unknown): SaaSPlanCode {
  if (typeof value !== 'string') {
    return 'basic';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized in SAAS_PLAN_DEFINITIONS) {
    return normalized as SaaSPlanCode;
  }

  return 'basic';
}

export function getSaaSPlanDefinition(value: unknown): SaaSPlanDefinition {
  return SAAS_PLAN_DEFINITIONS[normalizeSaaSPlanCode(value)];
}

export function getOrgAIUsageLimit(org: { plan?: unknown }): number | null {
  return getSaaSPlanDefinition(org.plan).aiMonthlyLimit;
}
