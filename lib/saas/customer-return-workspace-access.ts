import {
  canCreateSaaSData,
  normalizeSaaSSubscriptionStatus,
  type SaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';
import { resolveSaaSSubscriptionTimedStatus } from '@/lib/saas/subscription-lifecycle';

export type CustomerReturnWorkspaceAccessReason =
  | 'allowed'
  | 'workspace_read_only'
  | 'trial_expiry_unavailable'
  | 'subscription_status_mismatch';

export interface CustomerReturnWorkspaceAccess {
  effectiveStatus: SaaSSubscriptionStatus;
  canCreate: boolean;
  reason: CustomerReturnWorkspaceAccessReason;
}

export interface ResolveCustomerReturnWorkspaceAccessInput {
  orgStatus: unknown;
  subscriptionStatus: unknown;
  trialEnd: unknown;
  currentPeriodEnd?: unknown;
  cancelAtPeriodEnd?: unknown;
  subscriptionProvider?: unknown;
  now?: Date | string | number;
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requiresFixedTerm(provider: unknown): boolean {
  if (typeof provider !== 'string') return false;
  const normalizedProvider = provider.trim().toLowerCase();
  return normalizedProvider === 'ecpay';
}

export function resolveCustomerReturnWorkspaceAccess(
  input: ResolveCustomerReturnWorkspaceAccessInput
): CustomerReturnWorkspaceAccess {
  const orgStatus = normalizeSaaSSubscriptionStatus(input.orgStatus);
  const subscriptionStatus = normalizeSaaSSubscriptionStatus(input.subscriptionStatus);
  const trialEnd = normalizeDate(input.trialEnd);

  if (orgStatus !== subscriptionStatus) {
    return {
      effectiveStatus: 'suspended',
      canCreate: false,
      reason: 'subscription_status_mismatch',
    };
  }

  // A trial without a trustworthy expiry cannot be treated as writable. This
  // closes the window where a missing join or schema drift would otherwise
  // make an indefinite trial look active.
  if (orgStatus === 'trialing' && trialEnd === null) {
    return {
      effectiveStatus: 'suspended',
      canCreate: false,
      reason: 'trial_expiry_unavailable',
    };
  }

  const effectiveStatus = resolveSaaSSubscriptionTimedStatus({
    status: orgStatus,
    trialEnd,
    currentPeriodEnd:
      input.currentPeriodEnd as Date | string | number | null | undefined,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd === true,
    requiresCurrentPeriodEnd: requiresFixedTerm(input.subscriptionProvider),
    now: input.now,
  }).nextStatus;
  const canCreate = canCreateSaaSData(effectiveStatus);

  return {
    effectiveStatus,
    canCreate,
    reason: canCreate ? 'allowed' : 'workspace_read_only',
  };
}
