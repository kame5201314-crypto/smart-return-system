import { resolveSaaSInviteStatus } from '@/lib/saas/invite-policy';
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
  expiresAt: string;
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
    email: stringOrFallback(row.email, ''),
    displayName: stringOrNull(row.display_name),
    role: stringOrFallback(row.role, 'staff'),
    status: stringOrFallback(row.status, 'active'),
    joinedAt: stringOrNull(row.created_at),
  };
}

function normalizeInvite(row: Record<string, unknown>, now: Date): SettingsTeamInviteData {
  return {
    id: stringOrFallback(row.id, ''),
    email: stringOrFallback(row.email, ''),
    role: stringOrFallback(row.role, 'staff'),
    status: resolveSaaSInviteStatus({
      acceptedAt: stringOrNull(row.accepted_at),
      expiresAt: stringOrNull(row.expires_at),
      now,
    }),
    expiresAt: stringOrFallback(row.expires_at, ''),
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
        .select('id, email, role, status, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: true });

      assertNoSupabaseError(error, 'Failed to load organization members.');
      return rows(data).map(normalizeMember);
    },

    async listInvites(input) {
      const now = input.now ?? new Date();
      const { data, error } = await client
        .from('organization_invites')
        .select('id, email, role, expires_at, accepted_at, created_at')
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
    actions: TeamSettingsView['actions'];
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

  return {
    orgId: org.id,
    plan: org.plan,
    members,
    invites,
    actions: input.actions,
  };
}
