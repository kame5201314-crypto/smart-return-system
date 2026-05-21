export type SaaSSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled';

export interface SaaSSubscriptionAccessPolicy {
  canLogin: boolean;
  canViewData: boolean;
  canCreateData: boolean;
  canUseAI: boolean;
  canExport: boolean;
  canManageBilling: boolean;
}

export const VALID_SAAS_SUBSCRIPTION_STATUSES: readonly SaaSSubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'cancelled',
];

export const SAAS_SUBSCRIPTION_ACCESS_POLICIES: Record<
  SaaSSubscriptionStatus,
  SaaSSubscriptionAccessPolicy
> = {
  trialing: {
    canLogin: true,
    canViewData: true,
    canCreateData: true,
    canUseAI: true,
    canExport: true,
    canManageBilling: true,
  },
  active: {
    canLogin: true,
    canViewData: true,
    canCreateData: true,
    canUseAI: true,
    canExport: true,
    canManageBilling: true,
  },
  past_due: {
    canLogin: true,
    canViewData: true,
    canCreateData: false,
    canUseAI: false,
    canExport: false,
    canManageBilling: true,
  },
  suspended: {
    canLogin: true,
    canViewData: true,
    canCreateData: false,
    canUseAI: false,
    canExport: false,
    canManageBilling: true,
  },
  cancelled: {
    canLogin: true,
    canViewData: true,
    canCreateData: false,
    canUseAI: false,
    canExport: false,
    canManageBilling: true,
  },
};

function normalizeStatusValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

export function normalizeSaaSSubscriptionStatus(value: unknown): SaaSSubscriptionStatus {
  const normalized = normalizeStatusValue(value);
  if (VALID_SAAS_SUBSCRIPTION_STATUSES.includes(normalized as SaaSSubscriptionStatus)) {
    return normalized as SaaSSubscriptionStatus;
  }
  return 'suspended';
}

export function getSaaSSubscriptionAccessPolicy(
  value: unknown
): SaaSSubscriptionAccessPolicy {
  return SAAS_SUBSCRIPTION_ACCESS_POLICIES[normalizeSaaSSubscriptionStatus(value)];
}

export function canCreateSaaSData(value: unknown): boolean {
  return getSaaSSubscriptionAccessPolicy(value).canCreateData;
}

export function canUseSaaSAI(value: unknown): boolean {
  return getSaaSSubscriptionAccessPolicy(value).canUseAI;
}

export function canExportSaaSData(value: unknown): boolean {
  return getSaaSSubscriptionAccessPolicy(value).canExport;
}
