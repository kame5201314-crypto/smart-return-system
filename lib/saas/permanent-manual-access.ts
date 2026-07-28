export interface PermanentManualAccessInput {
  orgStatus: unknown;
  subscriptionProvider: unknown;
  currentPeriodEnd: unknown;
  cancelAtPeriodEnd?: unknown;
}

function normalizedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

export function isPermanentManualAccess(input: PermanentManualAccessInput): boolean {
  return normalizedString(input.orgStatus) === 'active' &&
    normalizedString(input.subscriptionProvider) === 'manual' &&
    input.currentPeriodEnd === null &&
    input.cancelAtPeriodEnd !== true;
}
