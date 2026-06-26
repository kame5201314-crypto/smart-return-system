export type SaaSInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type SaaSInviteRole = 'admin' | 'staff' | 'viewer';

const INVITE_ROLES: readonly SaaSInviteRole[] = ['admin', 'staff', 'viewer'];

function hasValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function timestamp(value: unknown): number | null {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSaaSInviteRole(value: unknown): value is SaaSInviteRole {
  return INVITE_ROLES.includes(value as SaaSInviteRole);
}

export function resolveSaaSInviteStatus(input: {
  acceptedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  status?: string | null;
  now?: Date;
}): SaaSInviteStatus {
  if (input.status === 'revoked' || hasValue(input.revokedAt)) {
    return 'revoked';
  }

  if (input.status === 'accepted' || hasValue(input.acceptedAt)) {
    return 'accepted';
  }

  if (input.status === 'expired') {
    return 'expired';
  }

  const expiresAt = timestamp(input.expiresAt);
  const now = input.now ?? new Date();
  if (expiresAt !== null && expiresAt <= now.getTime()) {
    return 'expired';
  }

  return 'pending';
}

export function canAcceptSaaSInvite(input: {
  role: unknown;
  acceptedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  status?: string | null;
  now?: Date;
}): boolean {
  return isSaaSInviteRole(input.role) && resolveSaaSInviteStatus(input) === 'pending';
}
