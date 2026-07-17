import { resolveSaaSInviteStatus } from '@/lib/saas/invite-policy';
import {
  buildTeamInviteActionFlags,
  buildTeamMemberActionFlags,
  type TeamInviteManagementRecord,
  type TeamMemberManagementRecord,
} from '@/lib/saas/team-management';
import type { SaaSOrgRole } from '@/lib/saas/org-context';
import type { TeamSettingsView, TeamSettingsViewInput } from '@/lib/saas/ui-backend-contracts';

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

export interface SettingsTeamQueryBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns: string): SettingsTeamQueryBuilder;
  eq(column: string, value: unknown): SettingsTeamQueryBuilder;
  order(column: string, options: { ascending: boolean }): SettingsTeamQueryBuilder;
  maybeSingle(): Promise<SupabaseQueryResult>;
}

export interface SettingsTeamQueryClient {
  from(table: string): SettingsTeamQueryBuilder;
}

export interface SettingsTeamDataRepository {
  getOrganizationPlan(input: { orgId: string }): Promise<SettingsTeamOrgData | null>;
  listMembers(input: { orgId: string }): Promise<SettingsTeamMemberData[]>;
  listInvites(input: { orgId: string; now?: Date }): Promise<SettingsTeamInviteData[]>;
}

export interface SettingsTeamOrgData {
  id: string;
  plan: string;
}

export interface SettingsTeamMemberData {
  id: string;
  userId?: string | null;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
}

export interface SettingsTeamInviteData {
  id: string;
  email: string;
  role: string;
  status: string;
  token?: string | null;
  expiresAt: string;
  acceptedAt?: string | null;
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

function stringOrFallback(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function assertNoSupabaseError(error: SupabaseQueryError | null, fallbackMessage: string): void {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
}

function normalizeOrganization(row: unknown): SettingsTeamOrgData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    plan: stringOrFallback(row.plan, 'basic'),
  };
}

function normalizeMember(row: Record<string, unknown>): SettingsTeamMemberData {
  return {
    id: stringOrFallback(row.id, ''),
    userId: stringOrNull(row.user_id),
    // Phone-only verified owners created by migration 044 intentionally have
    // no email. Keep the pre-migration query shape deploy-safe and expose a
    // non-secret identity label so the team view remains usable.
    email: stringOrFallback(row.email, '已驗證手機帳號'),
    displayName: stringOrNull(row.display_name),
    role: stringOrFallback(row.role, 'staff'),
    status: stringOrFallback(row.status, 'active'),
    joinedAt: stringOrNull(row.created_at),
  };
}

function normalizeInvite(row: Record<string, unknown>, now: Date): SettingsTeamInviteData {
  const acceptedAt = stringOrNull(row.accepted_at);
  const expiresAt = stringOrNull(row.expires_at);
  return {
    id: stringOrFallback(row.id, ''),
    email: stringOrFallback(row.email, ''),
    role: stringOrFallback(row.role, 'staff'),
    status: resolveSaaSInviteStatus({
      acceptedAt,
      expiresAt,
      status: stringOrNull(row.status),
      now,
    }),
    token: stringOrNull(row.token),
    expiresAt: stringOrFallback(expiresAt, ''),
    acceptedAt,
  };
}

export function createSettingsTeamDataRepository(
  client: SettingsTeamQueryClient
): SettingsTeamDataRepository {
  return {
    async getOrganizationPlan(input) {
      const { data, error } = await client
        .from('organizations')
        .select('id, plan')
        .eq('id', input.orgId)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load organization team plan data.');
      return normalizeOrganization(data);
    },

    async listMembers(input) {
      const { data, error } = await client
        .from('organization_members')
        .select('id, user_id, email, role, status, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: true });

      assertNoSupabaseError(error, 'Failed to load organization members.');
      return rows(data).map(normalizeMember);
    },

    async listInvites(input) {
      const now = input.now ?? new Date();
      const { data, error } = await client
        .from('organization_invites')
        .select('id, email, role, token, status, expires_at, accepted_at, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false });

      assertNoSupabaseError(error, 'Failed to load organization invites.');
      return rows(data).map((row) => normalizeInvite(row, now));
    },
  };
}

export async function buildTeamSettingsViewInput(
  repository: SettingsTeamDataRepository,
  input: {
    orgId: string;
    seatLimitOverride?: number;
    actions: TeamSettingsView['actions'];
    actor?: {
      userId: string;
      role: SaaSOrgRole;
    };
    now?: Date;
  }
): Promise<TeamSettingsViewInput | null> {
  const [org, members, invites] = await Promise.all([
    repository.getOrganizationPlan({ orgId: input.orgId }),
    repository.listMembers({ orgId: input.orgId }),
    repository.listInvites({ orgId: input.orgId, now: input.now }),
  ]);

  if (!org) {
    return null;
  }

  const activeOwnerCount = members.filter(
    (member) => member.role === 'owner' && member.status === 'active'
  ).length;

  return {
    orgId: org.id,
    plan: org.plan,
    seatLimitOverride: input.seatLimitOverride,
    members: members.map((member) => ({
      ...member,
      actions: input.actor
        ? buildTeamMemberActionFlags({
            actorUserId: input.actor.userId,
            actorRole: input.actor.role,
            target: {
              userId: member.userId ?? null,
              role: member.role as TeamMemberManagementRecord['role'],
              status: member.status as TeamMemberManagementRecord['status'],
            },
            activeOwnerCount,
          })
        : undefined,
    })),
    invites: invites.map((invite) => ({
      ...invite,
      actions: input.actor
        ? buildTeamInviteActionFlags({
            actorRole: input.actor.role,
            invite: {
              role: invite.role as TeamInviteManagementRecord['role'],
              status: invite.status as TeamInviteManagementRecord['status'],
            },
          })
        : undefined,
    })),
    actions: input.actions,
  };
}
