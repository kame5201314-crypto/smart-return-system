import { randomBytes } from 'node:crypto';

import {
  isSaaSInviteRole,
  type SaaSInviteRole,
} from '@/lib/saas/invite-policy';
import { canInviteSaaSTeamMember } from '@/lib/saas/team-limits';

export type SaaSInviteCreationErrorCode =
  | 'invalid_request'
  | 'invalid_role'
  | 'seat_limit_reached'
  | 'create_failed';

export interface SaaSInviteCreationInput {
  orgId: string;
  email: string;
  role: unknown;
  invitedBy: string;
  seatLimit: number | null;
  activeMemberCount: number;
  pendingInviteCount?: number;
  now?: Date;
  expiresAt?: Date;
  token?: string;
}

export interface SaaSInviteCreationResult {
  created: true;
  inviteId: string;
  orgId: string;
  email: string;
  role: SaaSInviteRole;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface SaaSInviteCreationRepository {
  createInvite(input: {
    orgId: string;
    email: string;
    role: SaaSInviteRole;
    token: string;
    invitedBy: string;
    expiresAt: string;
    createdAt: string;
  }): Promise<{ inviteId: string; token?: string | null }>;
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

export class SaaSInviteCreationError extends Error {
  constructor(
    public readonly code: SaaSInviteCreationErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SaaSInviteCreationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRequiredString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      `${field} is required.`
    );
  }

  if (normalized.length > maxLength) {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      `${field} is too long.`
    );
  }

  return normalized;
}

function normalizeEmail(value: unknown): string {
  const normalized = normalizeRequiredString(value, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      'email must be a valid email address.'
    );
  }

  return normalized;
}

function normalizeRole(value: unknown): SaaSInviteRole {
  if (!isSaaSInviteRole(value)) {
    throw new SaaSInviteCreationError(
      'invalid_role',
      400,
      'Invite role must be admin, staff, or viewer.'
    );
  }

  return value;
}

function normalizeOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  throw new SaaSInviteCreationError(
    'invalid_request',
    400,
    `${field} must be a valid Date.`
  );
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeRpcCreationResult(data: unknown): { inviteId: string; token: string | null } {
  if (!isRecord(data)) {
    throw new SaaSInviteCreationError(
      'create_failed',
      500,
      'Invite creation returned an invalid response.'
    );
  }

  const inviteId = stringOrNull(data.invite_id);
  if (!inviteId) {
    throw new SaaSInviteCreationError(
      'create_failed',
      500,
      'Invite creation did not return an invite id.'
    );
  }

  return {
    inviteId,
    token: stringOrNull(data.token),
  };
}

export function generateSaaSInviteToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      'Invite token byte length must be at least 16.'
    );
  }

  return randomBytes(byteLength).toString('base64url');
}

export function buildCreateOrganizationInviteRpcArgs(input: {
  orgId: string;
  email: string;
  role: SaaSInviteRole;
  token: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}): Record<string, unknown> {
  return {
    p_org_id: input.orgId,
    p_email: input.email.toLowerCase(),
    p_role: input.role,
    p_token: input.token,
    p_invited_by: input.invitedBy,
    p_expires_at: input.expiresAt,
    p_created_at: input.createdAt,
  };
}

export async function createSaaSInvite(
  value: SaaSInviteCreationInput,
  repository: SaaSInviteCreationRepository
): Promise<SaaSInviteCreationResult> {
  const now = normalizeOptionalDate(value.now, 'now') ?? new Date();
  const expiresAt = normalizeOptionalDate(value.expiresAt, 'expiresAt') ?? addUtcDays(now, 7);
  if (expiresAt.getTime() <= now.getTime()) {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      'Invite expiration must be in the future.'
    );
  }

  const orgId = normalizeRequiredString(value.orgId, 'orgId', 64);
  const email = normalizeEmail(value.email);
  const role = normalizeRole(value.role);
  const invitedBy = normalizeRequiredString(value.invitedBy, 'invitedBy', 64);
  const token = value.token
    ? normalizeRequiredString(value.token, 'token', 512)
    : generateSaaSInviteToken();

  if (
    !canInviteSaaSTeamMember({
      seatLimit: value.seatLimit,
      activeMemberCount: value.activeMemberCount,
      pendingInviteCount: value.pendingInviteCount,
    })
  ) {
    throw new SaaSInviteCreationError(
      'seat_limit_reached',
      409,
      'Seat limit has been reached for this plan.'
    );
  }

  const createdAt = now.toISOString();
  const expiresAtIso = expiresAt.toISOString();

  try {
    const saved = await repository.createInvite({
      orgId,
      email,
      role,
      token,
      invitedBy,
      expiresAt: expiresAtIso,
      createdAt,
    });
    const inviteId = normalizeRequiredString(saved.inviteId, 'inviteId', 64);

    return {
      created: true,
      inviteId,
      orgId,
      email,
      role,
      token: saved.token?.trim() || token,
      expiresAt: expiresAtIso,
      createdAt,
    };
  } catch (error) {
    if (error instanceof SaaSInviteCreationError) {
      throw error;
    }

    throw new SaaSInviteCreationError(
      'create_failed',
      500,
      'Invite creation failed.'
    );
  }
}

export function createSaaSInviteCreationRepository(
  rpcClient: SupabaseRpcClient
): SaaSInviteCreationRepository {
  return {
    async createInvite(input) {
      const { data, error } = await rpcClient.rpc(
        'create_organization_invite',
        buildCreateOrganizationInviteRpcArgs(input)
      );

      if (error) {
        throw new SaaSInviteCreationError(
          'create_failed',
          500,
          error.message || 'Invite creation failed.'
        );
      }

      return normalizeRpcCreationResult(data);
    },
  };
}
