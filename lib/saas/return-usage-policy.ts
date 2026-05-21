export const RETURN_USAGE_WARNING_THRESHOLD = 0.8;

export type SaaSReturnUsageWarningType = 'returns_80' | 'returns_100';

export interface SaaSReturnUsageInput {
  used: number;
  monthlyReturnSoftLimit: number | null;
}

export interface SaaSReturnUsagePolicyResult {
  used: number;
  monthlyReturnSoftLimit: number | null;
  usageRatio: number | null;
  warningType: SaaSReturnUsageWarningType | null;
  isOverSoftLimit: boolean;
  shouldBlockOperations: false;
}

export interface SaaSReturnUpgradeSuggestionInput {
  currentMonthOverLimit: boolean;
  previousMonthOverLimit: boolean;
  alreadySuggestedAt?: string | null;
  now?: Date | string | number;
}

export interface SaaSReturnUpgradeSuggestionResult {
  shouldSuggestUpgrade: boolean;
  suggestedAt: string | null;
  reason: 'consecutive_overage' | 'already_suggested' | 'not_consecutive';
}

function nonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid non-negative integer for ${fieldName}`);
  }

  return value;
}

function positiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid positive integer for ${fieldName}`);
  }

  return value;
}

function toIsoTimestamp(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    throw new Error('Invalid timestamp for return usage upgrade suggestion');
  }

  return date.toISOString();
}

export function resolveSaaSReturnUsagePolicy(
  input: SaaSReturnUsageInput
): SaaSReturnUsagePolicyResult {
  const used = nonNegativeInteger(input.used, 'returnUsage.used');

  if (input.monthlyReturnSoftLimit === null) {
    return {
      used,
      monthlyReturnSoftLimit: null,
      usageRatio: null,
      warningType: null,
      isOverSoftLimit: false,
      shouldBlockOperations: false,
    };
  }

  const monthlyReturnSoftLimit = positiveInteger(
    input.monthlyReturnSoftLimit,
    'returnUsage.monthlyReturnSoftLimit'
  );
  const usageRatio = used / monthlyReturnSoftLimit;
  const warningThreshold = Math.ceil(
    monthlyReturnSoftLimit * RETURN_USAGE_WARNING_THRESHOLD
  );
  const warningType =
    used >= monthlyReturnSoftLimit
      ? 'returns_100'
      : used >= warningThreshold
        ? 'returns_80'
        : null;

  return {
    used,
    monthlyReturnSoftLimit,
    usageRatio,
    warningType,
    isOverSoftLimit: used >= monthlyReturnSoftLimit,
    shouldBlockOperations: false,
  };
}

export function resolveSaaSReturnUpgradeSuggestion(
  input: SaaSReturnUpgradeSuggestionInput
): SaaSReturnUpgradeSuggestionResult {
  if (input.alreadySuggestedAt) {
    return {
      shouldSuggestUpgrade: false,
      suggestedAt: input.alreadySuggestedAt,
      reason: 'already_suggested',
    };
  }

  if (input.currentMonthOverLimit && input.previousMonthOverLimit) {
    return {
      shouldSuggestUpgrade: true,
      suggestedAt: toIsoTimestamp(input.now ?? new Date()),
      reason: 'consecutive_overage',
    };
  }

  return {
    shouldSuggestUpgrade: false,
    suggestedAt: null,
    reason: 'not_consecutive',
  };
}
