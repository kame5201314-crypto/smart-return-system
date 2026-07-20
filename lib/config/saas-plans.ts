export type SaaSPlanCode = 'basic' | 'growth' | 'enterprise';
export type SelfServiceSaaSPlanCode = Extract<SaaSPlanCode, 'basic'>;

// Growth and enterprise remain valid legacy/internal plan codes so existing
// tenants and historical billing records can still be rendered. New public
// signup and self-service checkout are intentionally sold as one NT$399 plan.
export const SAAS_SELF_SERVICE_PLAN_CODE: SelfServiceSaaSPlanCode = 'basic';

export function normalizeSelfServiceSaaSPlanCode(
  value: unknown
): SelfServiceSaaSPlanCode | null {
  return typeof value === 'string' && value.trim().toLowerCase() === 'basic'
    ? SAAS_SELF_SERVICE_PLAN_CODE
    : null;
}

export interface SaaSPlanDefinition {
  code: SaaSPlanCode;
  name: string;
  monthlyPriceTwd: number | null;
  seatLimit: number | null;
  monthlyReturnSoftLimit: number | null;
  aiMonthlyLimit: number | null;
  hasAdvancedAnalytics: boolean;
  hasApiAccess: boolean;
  billingRequired: boolean;
}

export const SAAS_PLAN_DEFINITIONS: Record<SaaSPlanCode, SaaSPlanDefinition> = {
  basic: {
    code: 'basic',
    name: '入門版',
    monthlyPriceTwd: 399,
    seatLimit: 3,
    monthlyReturnSoftLimit: 300,
    aiMonthlyLimit: 10,
    hasAdvancedAnalytics: false,
    hasApiAccess: false,
    billingRequired: true,
  },
  growth: {
    code: 'growth',
    name: '成長版',
    monthlyPriceTwd: 699,
    seatLimit: 5,
    monthlyReturnSoftLimit: 800,
    aiMonthlyLimit: 25,
    hasAdvancedAnalytics: true,
    hasApiAccess: false,
    billingRequired: true,
  },
  enterprise: {
    code: 'enterprise',
    name: '大量需求',
    monthlyPriceTwd: null,
    seatLimit: null,
    monthlyReturnSoftLimit: null,
    aiMonthlyLimit: null,
    hasAdvancedAnalytics: true,
    hasApiAccess: true,
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

export function getOrgSeatLimit(org: { plan?: unknown }): number | null {
  return getSaaSPlanDefinition(org.plan).seatLimit;
}

export function getOrgMonthlyReturnSoftLimit(org: { plan?: unknown }): number | null {
  return getSaaSPlanDefinition(org.plan).monthlyReturnSoftLimit;
}

export function orgHasAdvancedAnalytics(org: { plan?: unknown }): boolean {
  return getSaaSPlanDefinition(org.plan).hasAdvancedAnalytics;
}

export function orgHasApiAccess(org: { plan?: unknown }): boolean {
  return getSaaSPlanDefinition(org.plan).hasApiAccess;
}
