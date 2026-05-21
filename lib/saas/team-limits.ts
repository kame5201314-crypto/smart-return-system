export interface SaaSTeamSeatUsageInput {
  seatLimit: number | null;
  activeMemberCount: number;
  pendingInviteCount?: number;
}

export interface SaaSTeamSeatUsage {
  seatLimit: number | null;
  activeMemberCount: number;
  pendingInviteCount: number;
  reservedSeatCount: number;
  remainingSeats: number | null;
  isFull: boolean;
}

function normalizeCount(value: number | undefined, fieldName: string): number {
  const normalized = value ?? 0;
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return normalized;
}

function normalizeSeatLimit(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('seatLimit must be null or a non-negative integer.');
  }
  return value;
}

export function resolveSaaSTeamSeatUsage(
  input: SaaSTeamSeatUsageInput
): SaaSTeamSeatUsage {
  const seatLimit = normalizeSeatLimit(input.seatLimit);
  const activeMemberCount = normalizeCount(input.activeMemberCount, 'activeMemberCount');
  const pendingInviteCount = normalizeCount(input.pendingInviteCount, 'pendingInviteCount');
  const reservedSeatCount = activeMemberCount + pendingInviteCount;
  const remainingSeats = seatLimit === null ? null : Math.max(seatLimit - reservedSeatCount, 0);

  return {
    seatLimit,
    activeMemberCount,
    pendingInviteCount,
    reservedSeatCount,
    remainingSeats,
    isFull: seatLimit !== null && reservedSeatCount >= seatLimit,
  };
}

export function canInviteSaaSTeamMember(input: SaaSTeamSeatUsageInput): boolean {
  return !resolveSaaSTeamSeatUsage(input).isFull;
}
