import { RETURN_AI_ANALYSIS_FEATURE } from '@/lib/saas/ai-quota';
import type { UsageSettingsViewInput } from '@/lib/saas/ui-backend-contracts';

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

export interface SettingsUsageQueryBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns: string): SettingsUsageQueryBuilder;
  eq(column: string, value: unknown): SettingsUsageQueryBuilder;
  gte(column: string, value: string): SettingsUsageQueryBuilder;
  lt(column: string, value: string): SettingsUsageQueryBuilder;
  order(column: string, options: { ascending: boolean }): SettingsUsageQueryBuilder;
  maybeSingle(): Promise<SupabaseQueryResult>;
}

export interface SettingsUsageQueryClient {
  from(table: string): SettingsUsageQueryBuilder;
}

export interface SettingsUsageDataRepository {
  getOrganizationPlan(input: { orgId: string }): Promise<SettingsUsageOrgData | null>;
  listMembers(input: { orgId: string }): Promise<SettingsUsageMemberData[]>;
  listInvites(input: { orgId: string; now?: Date }): Promise<SettingsUsageInviteData[]>;
  listReturns(input: { orgId: string; period: SettingsUsagePeriod }): Promise<SettingsUsageRow[]>;
  listAIUsage(input: { orgId: string; period: SettingsUsagePeriod }): Promise<SettingsUsageRow[]>;
}

export interface SettingsUsagePeriod {
  periodStart: string;
  periodEnd: string;
}

export interface SettingsUsageOrgData {
  id: string;
  plan: string;
}

export interface SettingsUsageMemberData {
  id: string;
  status: string;
}

export interface SettingsUsageInviteData {
  id: string;
  acceptedAt: string | null;
  expiresAt: string | null;
}

export interface SettingsUsageRow {
  id: string;
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

function normalizeOrganization(row: unknown): SettingsUsageOrgData | null {
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

function normalizeMember(row: Record<string, unknown>): SettingsUsageMemberData {
  return {
    id: stringOrFallback(row.id, ''),
    status: stringOrFallback(row.status, 'active'),
  };
}

function normalizeInvite(row: Record<string, unknown>): SettingsUsageInviteData {
  return {
    id: stringOrFallback(row.id, ''),
    acceptedAt: stringOrNull(row.accepted_at),
    expiresAt: stringOrNull(row.expires_at),
  };
}

function normalizeUsageRow(row: Record<string, unknown>): SettingsUsageRow {
  return {
    id: stringOrFallback(row.id, ''),
  };
}

function countReservedSeats(input: {
  members: SettingsUsageMemberData[];
  invites: SettingsUsageInviteData[];
  now: Date;
}): number {
  const activeMembers = input.members.filter((member) => member.status !== 'disabled').length;
  const pendingInvites = input.invites.filter((invite) => {
    if (invite.acceptedAt) {
      return false;
    }

    if (!invite.expiresAt || !Number.isFinite(Date.parse(invite.expiresAt))) {
      return true;
    }

    return Date.parse(invite.expiresAt) > input.now.getTime();
  }).length;

  return activeMembers + pendingInvites;
}

export function buildCurrentUsagePeriod(now = new Date()): SettingsUsagePeriod {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export function createSettingsUsageDataRepository(
  client: SettingsUsageQueryClient
): SettingsUsageDataRepository {
  return {
    async getOrganizationPlan(input) {
      const { data, error } = await client
        .from('organizations')
        .select('id, plan')
        .eq('id', input.orgId)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load organization usage plan data.');
      return normalizeOrganization(data);
    },

    async listMembers(input) {
      const { data, error } = await client
        .from('organization_members')
        .select('id, status')
        .eq('org_id', input.orgId);

      assertNoSupabaseError(error, 'Failed to load organization seat usage.');
      return rows(data).map(normalizeMember);
    },

    async listInvites(input) {
      const { data, error } = await client
        .from('organization_invites')
        .select('id, accepted_at, expires_at, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false });

      assertNoSupabaseError(error, 'Failed to load organization invite usage.');
      return rows(data).map(normalizeInvite);
    },

    async listReturns(input) {
      const { data, error } = await client
        .from('return_requests')
        .select('id, created_at')
        .eq('org_id', input.orgId)
        .gte('created_at', input.period.periodStart)
        .lt('created_at', input.period.periodEnd);

      assertNoSupabaseError(error, 'Failed to load monthly return usage.');
      return rows(data).map(normalizeUsageRow);
    },

    async listAIUsage(input) {
      const { data, error } = await client
        .from('ai_usage_events')
        .select('id, created_at')
        .eq('org_id', input.orgId)
        .eq('feature', RETURN_AI_ANALYSIS_FEATURE)
        .eq('cached', false)
        .eq('success', true)
        .gte('created_at', input.period.periodStart)
        .lt('created_at', input.period.periodEnd);

      assertNoSupabaseError(error, 'Failed to load monthly AI usage.');
      return rows(data).map(normalizeUsageRow);
    },
  };
}

export async function buildUsageSettingsViewInput(
  repository: SettingsUsageDataRepository,
  input: {
    orgId: string;
    now?: Date;
    period?: SettingsUsagePeriod;
  }
): Promise<UsageSettingsViewInput | null> {
  const now = input.now ?? new Date();
  const period = input.period ?? buildCurrentUsagePeriod(now);
  const [org, members, invites, returns, aiUsage] = await Promise.all([
    repository.getOrganizationPlan({ orgId: input.orgId }),
    repository.listMembers({ orgId: input.orgId }),
    repository.listInvites({ orgId: input.orgId, now }),
    repository.listReturns({ orgId: input.orgId, period }),
    repository.listAIUsage({ orgId: input.orgId, period }),
  ]);

  if (!org) {
    return null;
  }

  return {
    plan: org.plan,
    usage: {
      seatsUsed: countReservedSeats({
        members,
        invites,
        now,
      }),
      returnsThisMonth: returns.length,
      aiUsedThisMonth: aiUsage.length,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    },
  };
}
