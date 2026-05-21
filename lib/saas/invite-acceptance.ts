import type { SaaSInviteRole } from '@/lib/saas/invite-policy';
import type { SaaSInviteTokenData } from '@/lib/saas/invite-token-data';

export type SaaSInviteAcceptanceErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'email_mismatch'
  | 'invalid_role'
  | 'invite_expired'
  | 'invite_already_accepted'
  | 'invite_revoked'
  | 'invite_not_pending'
  | 'accept_failed';

export interface SaaSInviteAcceptanceInput {
  token: string;
  userId: string;
  userEmail: string;
  now?: Date;
}

export interface SaaSInviteAcceptanceResult {
  accepted: true;
  inviteId: string;
  orgId: string;
  membershipId: string | null;
  role: SaaSInviteRole;
  acceptedAt: string;
}

export interface SaaSInviteAcceptanceRepository {
  getInviteByToken(input: {
    token: string;
    now?: Date;
  }): Promise<SaaSInviteTokenData | null>;
  acceptInvite(input: {
    inviteId: string;
    orgId: string;
    userId: string;
    userEmail: string;
    role: SaaSInviteRole;
    acceptedAt: string;
  }): Promise<{ membershipId?: string | null }>;
}

interface SupabaseRpcError {
  message?: string;
}

interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: SupabaseRpcError | null }>;
}

export class SaaSInviteAcceptanceError extends Error {
  constructor(
    public readonly code: SaaSInviteAcceptanceErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SaaSInviteAcceptanceError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw new SaaSInviteAcceptanceError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new SaaSInviteAcceptanceError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }

  if (normalized.length > maxLength) {
    throw new SaaSInviteAcceptanceError(
      'invalid_request',
      400,
      `${field} is too long.`
    );
  }

  return normalized;
}

function normalizeEmail(value: unknown, field: string): string {
  const normalized = normalizeRequiredString(value, field, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new SaaSInviteAcceptanceError(
      'invalid_request',
      400,
      `${field} must be a valid email address.`
    );
  }

  return normalized;
}

function normalizeNow(value: unknown): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  throw new SaaSInviteAcceptanceError(
    'invalid_request',
    400,
    'now must be a valid Date.'
  );
}

function normalizeInput(value: unknown): SaaSInviteAcceptanceInput {
  if (!isRecord(value)) {
    throw new SaaSInviteAcceptanceError(
      'invalid_request',
      400,
      'Request body must be an object.'
    );
  }

  return {
    token: normalizeRequiredString(value.token, 'token', 512),
    userId: normalizeRequiredString(value.userId, 'userId', 64),
    userEmail: normalizeEmail(value.userEmail, 'userEmail'),
    now: normalizeNow(value.now),
  };
}

function inviteEmailMatchesUser(invite: SaaSInviteTokenData, userEmail: string): boolean {
  return invite.email.trim().toLowerCase() === userEmail;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRpcAcceptanceResult(data: unknown): { membershipId: string | null } {
  if (!isRecord(data)) {
    return {
      membershipId: null,
    };
  }

  return {
    membershipId: stringOrNull(data.membership_id),
  };
}

function throwInviteStatusError(invite: SaaSInviteTokenData): never {
  switch (invite.status) {
    case 'accepted':
      throw new SaaSInviteAcceptanceError(
        'invite_already_accepted',
        409,
        'Invite has already been accepted.'
      );
    case 'expired':
      throw new SaaSInviteAcceptanceError(
        'invite_expired',
        410,
        'Invite has expired.'
      );
    case 'revoked':
      throw new SaaSInviteAcceptanceError(
        'invite_revoked',
        410,
        'Invite has been revoked.'
      );
    case 'pending':
    default:
      throw new SaaSInviteAcceptanceError(
        'invite_not_pending',
        409,
        'Invite is not available for acceptance.'
      );
  }
}

export async function acceptSaaSInvite(
  value: unknown,
  repository: SaaSInviteAcceptanceRepository
): Promise<SaaSInviteAcceptanceResult> {
  const input = normalizeInput(value);
  const now = input.now ?? new Date();
  const invite = await repository.getInviteByToken({
    token: input.token,
    now,
  });

  if (!invite) {
    throw new SaaSInviteAcceptanceError(
      'not_found',
      404,
      'Invite was not found.'
    );
  }

  if (!invite.role) {
    throw new SaaSInviteAcceptanceError(
      'invalid_role',
      400,
      'Invite role is not acceptable.'
    );
  }

  if (!inviteEmailMatchesUser(invite, input.userEmail)) {
    throw new SaaSInviteAcceptanceError(
      'email_mismatch',
      403,
      'Invite email does not match the signed-in user.'
    );
  }

  if (!invite.canAccept) {
    throwInviteStatusError(invite);
  }

  const acceptedAt = now.toISOString();

  try {
    const result = await repository.acceptInvite({
      inviteId: invite.id,
      orgId: invite.orgId,
      userId: input.userId,
      userEmail: input.userEmail,
      role: invite.role,
      acceptedAt,
    });

    return {
      accepted: true,
      inviteId: invite.id,
      orgId: invite.orgId,
      membershipId: result.membershipId ?? null,
      role: invite.role,
      acceptedAt,
    };
  } catch (error) {
    if (error instanceof SaaSInviteAcceptanceError) {
      throw error;
    }

    throw new SaaSInviteAcceptanceError(
      'accept_failed',
      500,
      'Invite acceptance failed.'
    );
  }
}

export function buildAcceptOrganizationInviteRpcArgs(input: {
  inviteId: string;
  orgId: string;
  userId: string;
  userEmail: string;
  role: SaaSInviteRole;
  acceptedAt: string;
}): Record<string, unknown> {
  return {
    p_invite_id: input.inviteId,
    p_org_id: input.orgId,
    p_user_id: input.userId,
    p_user_email: input.userEmail.toLowerCase(),
    p_role: input.role,
    p_accepted_at: input.acceptedAt,
  };
}

export function createSaaSInviteAcceptanceRepository(input: {
  inviteReader: Pick<SaaSInviteAcceptanceRepository, 'getInviteByToken'>;
  rpcClient: SupabaseRpcClient;
}): SaaSInviteAcceptanceRepository {
  return {
    getInviteByToken: input.inviteReader.getInviteByToken,

    async acceptInvite(acceptInput) {
      const { data, error } = await input.rpcClient.rpc(
        'accept_organization_invite',
        buildAcceptOrganizationInviteRpcArgs(acceptInput)
      );

      if (error) {
        throw new SaaSInviteAcceptanceError(
          'accept_failed',
          500,
          error.message || 'Invite acceptance failed.'
        );
      }

      return normalizeRpcAcceptanceResult(data);
    },
  };
}
