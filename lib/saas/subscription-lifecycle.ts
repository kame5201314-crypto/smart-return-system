import {
  normalizeSaaSSubscriptionStatus,
  type SaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';

export const PAST_DUE_GRACE_DAYS = 7;
export const SUSPENDED_RETENTION_DAYS = 30;

export type SaaSSubscriptionLifecycleReason =
  | 'unchanged'
  | 'trial_expired'
  | 'trial_expiry_unavailable'
  | 'cancelled_at_period_end'
  | 'prepaid_period_expired'
  | 'prepaid_period_expiry_unavailable'
  | 'past_due_grace_expired'
  | 'suspended_retention_expired';

export interface SaaSSubscriptionLifecycleInput {
  status: unknown;
  now?: Date | string | number;
  trialEnd?: Date | string | number | null;
  currentPeriodEnd?: Date | string | number | null;
  pastDueSince?: Date | string | number | null;
  suspendedAt?: Date | string | number | null;
  cancelAtPeriodEnd?: boolean;
  requiresCurrentPeriodEnd?: boolean;
}

export interface SaaSSubscriptionLifecycleResult {
  currentStatus: SaaSSubscriptionStatus;
  nextStatus: SaaSSubscriptionStatus;
  reason: SaaSSubscriptionLifecycleReason;
  changed: boolean;
  effectiveAt: string;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function hasReached(now: Date, target: Date | null): boolean {
  return target !== null && now.getTime() >= target.getTime();
}

function hasNonEmptyDateValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function result(
  currentStatus: SaaSSubscriptionStatus,
  nextStatus: SaaSSubscriptionStatus,
  reason: SaaSSubscriptionLifecycleReason,
  now: Date
): SaaSSubscriptionLifecycleResult {
  return {
    currentStatus,
    nextStatus,
    reason,
    changed: currentStatus !== nextStatus,
    effectiveAt: now.toISOString(),
  };
}

export function resolveSaaSSubscriptionTimedStatus(
  input: SaaSSubscriptionLifecycleInput
): SaaSSubscriptionLifecycleResult {
  const now = toDate(input.now) ?? new Date();
  const currentStatus = normalizeSaaSSubscriptionStatus(input.status);

  if (currentStatus === 'cancelled') {
    return result(currentStatus, 'cancelled', 'unchanged', now);
  }

  if (currentStatus === 'trialing') {
    const trialEnd = toDate(input.trialEnd);
    if (trialEnd === null) {
      return result(currentStatus, 'suspended', 'trial_expiry_unavailable', now);
    }
    if (hasReached(now, trialEnd)) {
      return result(currentStatus, 'suspended', 'trial_expired', now);
    }
    return result(currentStatus, currentStatus, 'unchanged', now);
  }

  if (currentStatus === 'active') {
    const periodEnd = toDate(input.currentPeriodEnd);
    if (
      periodEnd === null
      && (
        input.requiresCurrentPeriodEnd === true
        || hasNonEmptyDateValue(input.currentPeriodEnd)
      )
    ) {
      return result(
        currentStatus,
        'suspended',
        'prepaid_period_expiry_unavailable',
        now
      );
    }
    if (hasReached(now, periodEnd)) {
      if (input.requiresCurrentPeriodEnd === true) {
        return result(currentStatus, 'suspended', 'prepaid_period_expired', now);
      }
      return input.cancelAtPeriodEnd === true
        ? result(currentStatus, 'cancelled', 'cancelled_at_period_end', now)
        : result(currentStatus, 'suspended', 'prepaid_period_expired', now);
    }
    return result(currentStatus, currentStatus, 'unchanged', now);
  }

  if (currentStatus === 'past_due') {
    const graceAnchor = toDate(input.pastDueSince) ?? toDate(input.currentPeriodEnd);
    if (hasReached(now, graceAnchor ? addDays(graceAnchor, PAST_DUE_GRACE_DAYS) : null)) {
      return result(currentStatus, 'suspended', 'past_due_grace_expired', now);
    }
    return result(currentStatus, currentStatus, 'unchanged', now);
  }

  const suspendedAt = toDate(input.suspendedAt);
  if (
    currentStatus === 'suspended' &&
    hasReached(now, suspendedAt ? addDays(suspendedAt, SUSPENDED_RETENTION_DAYS) : null)
  ) {
    return result(currentStatus, 'cancelled', 'suspended_retention_expired', now);
  }

  return result(currentStatus, currentStatus, 'unchanged', now);
}
