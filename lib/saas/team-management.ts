import { generateSaaSInviteToken } from '@/lib/saas/invite-creation';
import {
  isSaaSInviteRole,
  resolveSaaSInviteStatus,
  type SaaSInviteRole,
  type SaaSInviteStatus,
} from '@/lib/saas/invite-policy';
import {
  getOrgContext,
  type GetOrgContextOptions,
  type SaaSOrgContext,
  type SaaSOrgRole,
} from '@/lib/saas/org-context';
import { canInviteSaaSTeamMember } from '@/lib/saas/team-limits';
import type { TeamMemberRole, TeamMemberStatus } from '@/lib/saas/ui-backend-contracts';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type TeamManagementErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'role_forbidden'
  | 'self_demotion'
  | 'self_disable'
  | 'last_owner'
  | 'seat_limit'
  | 'invalid_state'
  | 'update_failed';

export type TeamMemberActionFlags = {
  canChangeRole: boolean;
  canDisable: boolean;
  disabledReason?: string;
};

export type TeamInviteActionFlags = {
  canRevoke: boolean;
  canResend: boolean;
  disabledReason?: string;
};

export interface TeamMemberManagementRecord {
  id: string;
  orgId: string;
  userId: string | null;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt: string | null;
}

export interface TeamInviteManagementRecord {
  id: string;
  orgId: string;
  email: string;
  role: SaaSInviteRole;
  status: SaaSInviteStatus;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export interface TeamSeatUsage {
  activeMemberCount: number;
  pendingInviteCount: number;
}

export interface TeamManagementRepository {
  getMember(input: { orgId: string; memberId: string }): Promise<TeamMemberManagementRecord | null>;
  listMembers(input: { orgId: string }): Promise<TeamMemberManagementRecord[]>;
  updateMemberRole(input: {
    orgId: string;
    memberId: string;
    role: Exclude<TeamMemberRole, 'owner'>;
  }): Promise<TeamMemberManagementRecord | null>;
  disableMember(input: {
    orgId: string;
    memberId: string;
  }): Promise<TeamMemberManagementRecord | null>;
  getInvite(input: {
    orgId: string;
    inviteId: string;
    now?: Date;
  }): Promise<TeamInviteManagementRecord | null>;
  getSeatUsage(input: {
    orgId: string;
    excludeInviteId?: string;
    now?: Date;
  }): Promise<TeamSeatUsage>;
  revokeInvite(input: {
    orgId: string;
    inviteId: string;
    revokedAt: string;
  }): Promise<TeamInviteManagementRecord | null>;
  resendInvite(input: {
    orgId: string;
    inviteId: string;
    token: string;
    expiresAt: string;
    invitedBy: string;
    now: Date;
  }): Promise<TeamInviteManagementRecord | null>;
  insertAuditLog(input: {
    orgId: string;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export interface TeamManagementDependencies {
  getContext?: (options?: GetOrgContextOptions) => Promise<SaaSOrgContext>;
  repository?: TeamManagementRepository;
  now?: Date;
  token?: string;
}

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

interface SupabaseFilterBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns: string, options?: Record<string, unknown>): SupabaseFilterBuilder;
  eq(column: string, value: unknown): SupabaseFilterBuilder;
  neq(column: string, value: unknown): SupabaseFilterBuilder;
  update(values: Record<string, unknown>): SupabaseFilterBuilder;
  insert(values: Record<string, unknown>): SupabaseFilterBuilder;
  maybeSingle(): Promise<SupabaseQueryResult>;
}

interface SupabaseTeamManagementClient {
  from(table: string): SupabaseFilterBuilder;
}

const MEMBER_ROLES: readonly TeamMemberRole[] = ['owner', 'admin', 'staff', 'viewer'];
const MEMBER_STATUSES: readonly TeamMemberStatus[] = ['active', 'invited', 'disabled'];

export class TeamManagementError extends Error {
  constructor(
    public readonly code: TeamManagementErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'TeamManagementError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRequiredString(value: unknown, field: string, maxLength = 128): string {
  const normalized = stringOrNull(value);
  if (!normalized) {
    throw new TeamManagementError('invalid_request', 400, `${field} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new TeamManagementError('invalid_request', 400, `${field} is too long.`);
  }
  return normalized;
}

export function normalizeTeamManagementId(value: unknown, field = 'id'): string {
  return normalizeRequiredString(value, field, 128);
}

function normalizeMemberRole(value: unknown): TeamMemberRole {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (MEMBER_ROLES.includes(normalized as TeamMemberRole)) {
    return normalized as TeamMemberRole;
  }
  return 'viewer';
}

export function normalizeAssignableTeamMemberRole(value: unknown): Exclude<TeamMemberRole, 'owner'> {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (normalized === 'admin' || normalized === 'staff' || normalized === 'viewer') {
    return normalized;
  }
  throw new TeamManagementError(
    'invalid_request',
    400,
    'role must be admin, staff, or viewer.'
  );
}

function normalizeMemberStatus(value: unknown): TeamMemberStatus {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (MEMBER_STATUSES.includes(normalized as TeamMemberStatus)) {
    return normalized as TeamMemberStatus;
  }
  return 'active';
}

function normalizeInviteRole(value: unknown): SaaSInviteRole {
  if (isSaaSInviteRole(value)) {
    return value;
  }
  throw new TeamManagementError('invalid_request', 400, 'Invite role is invalid.');
}

function normalizeMember(row: unknown): TeamMemberManagementRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const orgId = stringOrNull(row.org_id);
  const email = stringOrNull(row.email) ?? '已驗證手機帳號';
  if (!id || !orgId) {
    return null;
  }

  return {
    id,
    orgId,
    userId: stringOrNull(row.user_id),
    email,
    role: normalizeMemberRole(row.role),
    status: normalizeMemberStatus(row.status),
    joinedAt: stringOrNull(row.created_at),
  };
}

function normalizeInvite(row: unknown, now: Date): TeamInviteManagementRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const orgId = stringOrNull(row.org_id);
  const email = stringOrNull(row.email);
  const token = stringOrNull(row.token);
  const expiresAt = stringOrNull(row.expires_at);
  if (!id || !orgId || !email || !token || !expiresAt) {
    return null;
  }

  const acceptedAt = stringOrNull(row.accepted_at);
  const status = resolveSaaSInviteStatus({
    status: stringOrNull(row.status),
    acceptedAt,
    expiresAt,
    now,
  });

  return {
    id,
    orgId,
    email,
    role: normalizeInviteRole(row.role),
    status,
    token,
    expiresAt,
    acceptedAt,
  };
}

function assertNoSupabaseError(error: SupabaseQueryError | null, fallback: string): void {
  if (error) {
    throw new TeamManagementError('update_failed', 500, error.message || fallback);
  }
}

function normalizeMutationResult(
  data: unknown,
  now: Date,
  kind: 'member' | 'invite'
): TeamMemberManagementRecord | TeamInviteManagementRecord | null {
  return kind === 'member' ? normalizeMember(data) : normalizeInvite(data, now);
}

function canManageRole(actorRole: SaaSOrgRole, targetRole: TeamMemberRole | SaaSInviteRole): boolean {
  if (actorRole === 'owner') {
    return targetRole === 'admin' || targetRole === 'staff' || targetRole === 'viewer';
  }

  if (actorRole === 'admin') {
    return targetRole === 'staff' || targetRole === 'viewer';
  }

  return false;
}

function disabled(reason: string): {
  canChangeRole: false;
  canDisable: false;
  disabledReason: string;
} {
  return {
    canChangeRole: false,
    canDisable: false,
    disabledReason: reason,
  };
}

export function buildTeamMemberActionFlags(input: {
  actorUserId: string;
  actorRole: SaaSOrgRole;
  target: Pick<TeamMemberManagementRecord, 'userId' | 'role' | 'status'>;
  activeOwnerCount: number;
}): TeamMemberActionFlags {
  if (input.target.status === 'disabled') {
    return disabled('Member is already disabled.');
  }

  const isSelf = Boolean(input.target.userId && input.target.userId === input.actorUserId);
  if (isSelf) {
    return disabled('You cannot change or disable your own team membership.');
  }

  if (input.target.role === 'owner' && input.activeOwnerCount <= 1) {
    return disabled('At least one active owner must remain.');
  }

  if (!canManageRole(input.actorRole, input.target.role)) {
    return disabled('Your role cannot manage this member.');
  }

  return {
    canChangeRole: true,
    canDisable: true,
  };
}

export function buildTeamInviteActionFlags(input: {
  actorRole: SaaSOrgRole;
  invite: Pick<TeamInviteManagementRecord, 'role' | 'status'>;
}): TeamInviteActionFlags {
  if (!canManageRole(input.actorRole, input.invite.role)) {
    return {
      canRevoke: false,
      canResend: false,
      disabledReason: 'Your role cannot manage this invite.',
    };
  }

  if (input.invite.status === 'pending') {
    return {
      canRevoke: true,
      canResend: true,
    };
  }

  if (input.invite.status === 'expired') {
    return {
      canRevoke: false,
      canResend: true,
    };
  }

  return {
    canRevoke: false,
    canResend: false,
    disabledReason:
      input.invite.status === 'revoked'
        ? 'Invite has been revoked.'
        : 'Invite has already been accepted.',
  };
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

async function getManagerContext(
  deps: TeamManagementDependencies
): Promise<SaaSOrgContext> {
  return (deps.getContext ?? getOrgContext)({
    requirements: {
      roles: ['owner', 'admin'],
      writable: true,
    },
  });
}

async function loadActiveOwnerCount(
  repository: TeamManagementRepository,
  orgId: string
): Promise<number> {
  const members = await repository.listMembers({ orgId });
  return members.filter((member) => member.role === 'owner' && member.status === 'active').length;
}

function assertMemberManageable(input: {
  context: SaaSOrgContext;
  target: TeamMemberManagementRecord;
  activeOwnerCount: number;
  operation: 'change_role' | 'disable';
}): void {
  const flags = buildTeamMemberActionFlags({
    actorUserId: input.context.userId,
    actorRole: input.context.role,
    target: input.target,
    activeOwnerCount: input.activeOwnerCount,
  });

  if (input.operation === 'change_role' && !flags.canChangeRole) {
    let code: TeamManagementErrorCode = 'role_forbidden';
    if (input.target.userId === input.context.userId) {
      code = 'self_demotion';
    } else if (input.target.role === 'owner' && input.activeOwnerCount <= 1) {
      code = 'last_owner';
    }

    throw new TeamManagementError(
      code,
      403,
      flags.disabledReason || 'This member cannot be changed.'
    );
  }

  if (input.operation === 'disable' && !flags.canDisable) {
    let code: TeamManagementErrorCode = 'role_forbidden';
    if (input.target.userId === input.context.userId) {
      code = 'self_disable';
    } else if (input.target.role === 'owner' && input.activeOwnerCount <= 1) {
      code = 'last_owner';
    }

    throw new TeamManagementError(
      code,
      403,
      flags.disabledReason || 'This member cannot be disabled.'
    );
  }
}

function getRepository(deps: TeamManagementDependencies): TeamManagementRepository {
  return (
    deps.repository ??
    createTeamManagementRepository(
      createUntypedAdminClient() as unknown as SupabaseTeamManagementClient
    )
  );
}

export async function changeTeamMemberRole(
  input: { memberId: string; role: unknown },
  deps: TeamManagementDependencies = {}
): Promise<{ member: TeamMemberManagementRecord; actions: TeamMemberActionFlags }> {
  const memberId = normalizeTeamManagementId(input.memberId, 'memberId');
  const role = normalizeAssignableTeamMemberRole(input.role);
  const context = await getManagerContext(deps);
  const repository = getRepository(deps);
  const [target, activeOwnerCount] = await Promise.all([
    repository.getMember({ orgId: context.orgId, memberId }),
    loadActiveOwnerCount(repository, context.orgId),
  ]);

  if (!target) {
    throw new TeamManagementError('not_found', 404, 'Team member not found.');
  }

  assertMemberManageable({
    context,
    target,
    activeOwnerCount,
    operation: 'change_role',
  });

  const updated = await repository.updateMemberRole({
    orgId: context.orgId,
    memberId,
    role,
  });

  if (!updated) {
    throw new TeamManagementError('not_found', 404, 'Team member not found.');
  }

  await repository.insertAuditLog({
    orgId: context.orgId,
    actorUserId: context.userId,
    action: 'member.role_changed',
    targetType: 'organization_member',
    targetId: memberId,
    metadata: {
      previous_role: target.role,
      role,
      email: target.email,
    },
  });

  return {
    member: updated,
    actions: buildTeamMemberActionFlags({
      actorUserId: context.userId,
      actorRole: context.role,
      target: updated,
      activeOwnerCount,
    }),
  };
}

export async function disableTeamMember(
  input: { memberId: string },
  deps: TeamManagementDependencies = {}
): Promise<{ member: TeamMemberManagementRecord; actions: TeamMemberActionFlags }> {
  const memberId = normalizeTeamManagementId(input.memberId, 'memberId');
  const context = await getManagerContext(deps);
  const repository = getRepository(deps);
  const [target, activeOwnerCount] = await Promise.all([
    repository.getMember({ orgId: context.orgId, memberId }),
    loadActiveOwnerCount(repository, context.orgId),
  ]);

  if (!target) {
    throw new TeamManagementError('not_found', 404, 'Team member not found.');
  }

  assertMemberManageable({
    context,
    target,
    activeOwnerCount,
    operation: 'disable',
  });

  const updated = await repository.disableMember({
    orgId: context.orgId,
    memberId,
  });

  if (!updated) {
    throw new TeamManagementError('not_found', 404, 'Team member not found.');
  }

  await repository.insertAuditLog({
    orgId: context.orgId,
    actorUserId: context.userId,
    action: 'member.disabled',
    targetType: 'organization_member',
    targetId: memberId,
    metadata: {
      previous_status: target.status,
      role: target.role,
      email: target.email,
    },
  });

  return {
    member: updated,
    actions: buildTeamMemberActionFlags({
      actorUserId: context.userId,
      actorRole: context.role,
      target: updated,
      activeOwnerCount,
    }),
  };
}

export async function revokeTeamInvite(
  input: { inviteId: string },
  deps: TeamManagementDependencies = {}
): Promise<{ invite: TeamInviteManagementRecord; actions: TeamInviteActionFlags }> {
  const inviteId = normalizeTeamManagementId(input.inviteId, 'inviteId');
  const now = deps.now ?? new Date();
  const context = await getManagerContext(deps);
  const repository = getRepository(deps);
  const invite = await repository.getInvite({
    orgId: context.orgId,
    inviteId,
    now,
  });

  if (!invite) {
    throw new TeamManagementError('not_found', 404, 'Invite not found.');
  }

  const flags = buildTeamInviteActionFlags({
    actorRole: context.role,
    invite,
  });
  if (!flags.canRevoke) {
    throw new TeamManagementError(
      invite.status === 'pending' ? 'role_forbidden' : 'invalid_state',
      invite.status === 'pending' ? 403 : 409,
      flags.disabledReason || 'Invite cannot be revoked.'
    );
  }

  const revokedAt = now.toISOString();
  const updated = await repository.revokeInvite({
    orgId: context.orgId,
    inviteId,
    revokedAt,
  });

  if (!updated) {
    throw new TeamManagementError('not_found', 404, 'Invite not found.');
  }

  await repository.insertAuditLog({
    orgId: context.orgId,
    actorUserId: context.userId,
    action: 'invite.revoked',
    targetType: 'organization_invite',
    targetId: inviteId,
    metadata: {
      email: invite.email,
      role: invite.role,
      revoked_at: revokedAt,
    },
  });

  return {
    invite: updated,
    actions: buildTeamInviteActionFlags({
      actorRole: context.role,
      invite: updated,
    }),
  };
}

export async function resendTeamInvite(
  input: { inviteId: string },
  deps: TeamManagementDependencies = {}
): Promise<{ invite: TeamInviteManagementRecord; actions: TeamInviteActionFlags }> {
  const inviteId = normalizeTeamManagementId(input.inviteId, 'inviteId');
  const now = deps.now ?? new Date();
  const context = await getManagerContext(deps);
  const repository = getRepository(deps);
  const invite = await repository.getInvite({
    orgId: context.orgId,
    inviteId,
    now,
  });

  if (!invite) {
    throw new TeamManagementError('not_found', 404, 'Invite not found.');
  }

  const flags = buildTeamInviteActionFlags({
    actorRole: context.role,
    invite,
  });
  if (!flags.canResend) {
    throw new TeamManagementError(
      flags.disabledReason ? 'invalid_state' : 'role_forbidden',
      flags.disabledReason ? 409 : 403,
      flags.disabledReason || 'Invite cannot be resent.'
    );
  }

  const seatUsage = await repository.getSeatUsage({
    orgId: context.orgId,
    excludeInviteId: inviteId,
    now,
  });
  if (
    !canInviteSaaSTeamMember({
      seatLimit: context.planDefinition.seatLimit,
      activeMemberCount: seatUsage.activeMemberCount,
      pendingInviteCount: seatUsage.pendingInviteCount + 1,
    })
  ) {
    throw new TeamManagementError(
      'seat_limit',
      409,
      'Seat limit has been reached for this plan.'
    );
  }

  const token = deps.token ?? generateSaaSInviteToken();
  const expiresAt = addUtcDays(now, 7).toISOString();
  const updated = await repository.resendInvite({
    orgId: context.orgId,
    inviteId,
    token,
    expiresAt,
    invitedBy: context.userId,
    now,
  });

  if (!updated) {
    throw new TeamManagementError('not_found', 404, 'Invite not found.');
  }

  await repository.insertAuditLog({
    orgId: context.orgId,
    actorUserId: context.userId,
    action: 'invite.resent',
    targetType: 'organization_invite',
    targetId: inviteId,
    metadata: {
      email: invite.email,
      role: invite.role,
      previous_status: invite.status,
      expires_at: expiresAt,
    },
  });

  return {
    invite: updated,
    actions: buildTeamInviteActionFlags({
      actorRole: context.role,
      invite: updated,
    }),
  };
}

export function createTeamManagementRepository(
  client: SupabaseTeamManagementClient
): TeamManagementRepository {
  async function getMember(input: {
    orgId: string;
    memberId: string;
  }): Promise<TeamMemberManagementRecord | null> {
    const { data, error } = await client
      .from('organization_members')
      .select('id, org_id, user_id, email, role, status, created_at')
      .eq('org_id', input.orgId)
      .eq('id', input.memberId)
      .maybeSingle();

    assertNoSupabaseError(error, 'Failed to load organization member.');
    return normalizeMember(data);
  }

  async function listMembers(input: { orgId: string }): Promise<TeamMemberManagementRecord[]> {
    const { data, error } = await client
      .from('organization_members')
      .select('id, org_id, user_id, email, role, status, created_at')
      .eq('org_id', input.orgId);

    assertNoSupabaseError(error, 'Failed to load organization members.');
    return rows(data)
      .map(normalizeMember)
      .filter((member): member is TeamMemberManagementRecord => member !== null);
  }

  async function getInvite(input: {
    orgId: string;
    inviteId: string;
    now?: Date;
  }): Promise<TeamInviteManagementRecord | null> {
    const { data, error } = await client
      .from('organization_invites')
      .select('id, org_id, email, role, token, status, expires_at, accepted_at')
      .eq('org_id', input.orgId)
      .eq('id', input.inviteId)
      .maybeSingle();

    assertNoSupabaseError(error, 'Failed to load organization invite.');
    return normalizeInvite(data, input.now ?? new Date());
  }

  return {
    getMember,
    listMembers,

    async updateMemberRole(input) {
      const { data, error } = await client
        .from('organization_members')
        .update({ role: input.role })
        .eq('org_id', input.orgId)
        .eq('id', input.memberId)
        .select('id, org_id, user_id, email, role, status, created_at')
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to update organization member role.');
      return normalizeMutationResult(data, new Date(), 'member') as TeamMemberManagementRecord | null;
    },

    async disableMember(input) {
      const { data, error } = await client
        .from('organization_members')
        .update({ status: 'disabled' })
        .eq('org_id', input.orgId)
        .eq('id', input.memberId)
        .select('id, org_id, user_id, email, role, status, created_at')
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to disable organization member.');
      return normalizeMutationResult(data, new Date(), 'member') as TeamMemberManagementRecord | null;
    },

    getInvite,

    async getSeatUsage(input) {
      const [members, invites] = await Promise.all([
        listMembers({ orgId: input.orgId }),
        (async () => {
          const { data, error } = await client
            .from('organization_invites')
            .select('id, org_id, email, role, token, status, expires_at, accepted_at')
            .eq('org_id', input.orgId);

          assertNoSupabaseError(error, 'Failed to load organization invites.');
          return rows(data)
            .map((row) => normalizeInvite(row, input.now ?? new Date()))
            .filter((invite): invite is TeamInviteManagementRecord => invite !== null);
        })(),
      ]);

      return {
        activeMemberCount: members.filter((member) => member.status !== 'disabled').length,
        pendingInviteCount: invites.filter(
          (invite) => invite.id !== input.excludeInviteId && invite.status === 'pending'
        ).length,
      };
    },

    async revokeInvite(input) {
      const { data, error } = await client
        .from('organization_invites')
        .update({
          status: 'revoked',
          expires_at: input.revokedAt,
        })
        .eq('org_id', input.orgId)
        .eq('id', input.inviteId)
        .select('id, org_id, email, role, token, status, expires_at, accepted_at')
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to revoke organization invite.');
      return normalizeMutationResult(data, new Date(input.revokedAt), 'invite') as TeamInviteManagementRecord | null;
    },

    async resendInvite(input) {
      const { data, error } = await client
        .from('organization_invites')
        .update({
          status: 'pending',
          token: input.token,
          expires_at: input.expiresAt,
          accepted_at: null,
          invited_by: input.invitedBy,
        })
        .eq('org_id', input.orgId)
        .eq('id', input.inviteId)
        .select('id, org_id, email, role, token, status, expires_at, accepted_at')
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to resend organization invite.');
      return normalizeMutationResult(data, input.now, 'invite') as TeamInviteManagementRecord | null;
    },

    async insertAuditLog(input) {
      const { error } = await client
        .from('audit_logs')
        .insert({
          org_id: input.orgId,
          actor_user_id: input.actorUserId,
          action: input.action,
          target_type: input.targetType,
          target_id: input.targetId,
          metadata: input.metadata,
        });

      assertNoSupabaseError(error, 'Failed to record team management audit log.');
    },
  };
}
