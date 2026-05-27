import { RETURN_AI_ANALYSIS_FEATURE } from '@/lib/saas/ai-quota';
import { resolveSaaSInviteStatus, type SaaSInviteStatus } from '@/lib/saas/invite-policy';
import {
  buildSaaSOnboardingView,
  type SaaSOnboardingView,
  type SaaSOnboardingViewInput,
} from '@/lib/saas/onboarding';
import {
  canWriteSaaSOrgData,
  getOrgContext,
  SaaSOrgContextError,
  type GetOrgContextOptions,
  type SaaSOrgContext,
} from '@/lib/saas/org-context';
import type { GatedState, ViewState } from '@/lib/saas/ui-backend-contracts';
import { createClient } from '@/lib/supabase/server';

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

export interface OnboardingQueryBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns: string): OnboardingQueryBuilder;
  eq(column: string, value: unknown): OnboardingQueryBuilder;
  gte(column: string, value: string): OnboardingQueryBuilder;
  lt(column: string, value: string): OnboardingQueryBuilder;
  order(column: string, options: { ascending: boolean }): OnboardingQueryBuilder;
  maybeSingle(): Promise<SupabaseQueryResult>;
}

export interface OnboardingQueryClient {
  from(table: string): OnboardingQueryBuilder;
}

export interface OnboardingOrgData {
  id: string;
  name: string;
  onboardingCompletedAt: string | null;
}

export interface OnboardingMemberData {
  id: string;
  status: string;
}

export interface OnboardingInviteData {
  id: string;
  status: SaaSInviteStatus;
}

export interface OnboardingUsageRow {
  id: string;
}

export interface OnboardingUsagePeriod {
  periodStart: string;
  periodEnd: string;
}

export interface OnboardingDataRepository {
  getOrganization(input: { orgId: string }): Promise<OnboardingOrgData | null>;
  hasReturnPolicy(input: { orgId: string }): Promise<boolean>;
  listMembers(input: { orgId: string }): Promise<OnboardingMemberData[]>;
  listInvites(input: { orgId: string; now?: Date }): Promise<OnboardingInviteData[]>;
  listReturns(input: { orgId: string; period: OnboardingUsagePeriod }): Promise<OnboardingUsageRow[]>;
  listAIUsage(input: { orgId: string; period: OnboardingUsagePeriod }): Promise<OnboardingUsageRow[]>;
}

export interface SaaSOnboardingLiveDataContext {
  orgId: string;
  role: SaaSOrgContext['role'];
  plan: SaaSOrgContext['plan'];
  orgStatus: SaaSOrgContext['orgStatus'];
}

export type SaaSOnboardingLiveDataResult =
  | {
      state: Extract<ViewState, 'ready'>;
      data: SaaSOnboardingView;
      context: SaaSOnboardingLiveDataContext;
    }
  | {
      state: Extract<ViewState, 'empty'>;
      data: null;
      message: string;
      context: SaaSOnboardingLiveDataContext;
    }
  | {
      state: Extract<ViewState, 'gated'>;
      data: null;
      gated: GatedState;
    }
  | {
      state: Extract<ViewState, 'error'>;
      data: null;
      message: string;
    };

export interface SaaSOnboardingLiveDataDependencies {
  getContext?: (options?: GetOrgContextOptions) => Promise<SaaSOrgContext>;
  createQueryClient?: () => OnboardingQueryClient | Promise<OnboardingQueryClient>;
  repository?: OnboardingDataRepository;
  now?: Date;
  period?: OnboardingUsagePeriod;
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

function isLegacyUsersPolicyRecursion(error: SupabaseQueryError | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('infinite recursion') && message.includes('users');
}

function normalizeOrganization(row: unknown): OnboardingOrgData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: stringOrFallback(row.name, 'Workspace'),
    onboardingCompletedAt: stringOrNull(row.onboarding_completed_at),
  };
}

function normalizeMember(row: Record<string, unknown>): OnboardingMemberData {
  return {
    id: stringOrFallback(row.id, ''),
    status: stringOrFallback(row.status, 'active'),
  };
}

function normalizeInvite(row: Record<string, unknown>, now: Date): OnboardingInviteData {
  return {
    id: stringOrFallback(row.id, ''),
    status: resolveSaaSInviteStatus({
      acceptedAt: stringOrNull(row.accepted_at),
      expiresAt: stringOrNull(row.expires_at),
      status: stringOrNull(row.status),
      now,
    }),
  };
}

function normalizeUsageRow(row: Record<string, unknown>): OnboardingUsageRow {
  return {
    id: stringOrFallback(row.id, ''),
  };
}

export function buildOnboardingUsagePeriod(now = new Date()): OnboardingUsagePeriod {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export function createOnboardingDataRepository(
  client: OnboardingQueryClient
): OnboardingDataRepository {
  return {
    async getOrganization(input) {
      const { data, error } = await client
        .from('organizations')
        .select('id, name, onboarding_completed_at')
        .eq('id', input.orgId)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load onboarding organization.');
      return normalizeOrganization(data);
    },

    async hasReturnPolicy(input) {
      const { data, error } = await client
        .from('system_settings')
        .select('id, setting_key')
        .eq('org_id', input.orgId)
        .eq('setting_key', 'return_policy')
        .maybeSingle();

      if (isLegacyUsersPolicyRecursion(error)) {
        console.warn(
          '[saas-onboarding] Skipping return policy signal because legacy system_settings RLS recursed through users.'
        );
        return false;
      }

      assertNoSupabaseError(error, 'Failed to load onboarding return policy.');
      return normalizeOrganizationSetting(data);
    },

    async listMembers(input) {
      const { data, error } = await client
        .from('organization_members')
        .select('id, status')
        .eq('org_id', input.orgId);

      assertNoSupabaseError(error, 'Failed to load onboarding members.');
      return rows(data).map(normalizeMember);
    },

    async listInvites(input) {
      const now = input.now ?? new Date();
      const { data, error } = await client
        .from('organization_invites')
        .select('id, accepted_at, expires_at, status, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false });

      assertNoSupabaseError(error, 'Failed to load onboarding invites.');
      return rows(data).map((row) => normalizeInvite(row, now));
    },

    async listReturns(input) {
      const { data, error } = await client
        .from('return_requests')
        .select('id, created_at')
        .eq('org_id', input.orgId)
        .gte('created_at', input.period.periodStart)
        .lt('created_at', input.period.periodEnd);

      assertNoSupabaseError(error, 'Failed to load onboarding return usage.');
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

      assertNoSupabaseError(error, 'Failed to load onboarding AI usage.');
      return rows(data).map(normalizeUsageRow);
    },
  };
}

function normalizeOrganizationSetting(row: unknown): boolean {
  if (!isRecord(row)) {
    return false;
  }

  return stringOrNull(row.id) !== null || stringOrNull(row.setting_key) === 'return_policy';
}

function activeMemberCount(members: OnboardingMemberData[]): number {
  return members.filter((member) => member.status !== 'disabled').length;
}

function pendingInviteCount(invites: OnboardingInviteData[]): number {
  return invites.filter((invite) => invite.status === 'pending').length;
}

function canCompleteOnboarding(context: SaaSOrgContext): boolean {
  return (context.role === 'owner' || context.role === 'admin') && canWriteSaaSOrgData(context);
}

function completionDisabledReason(context: SaaSOrgContext): string | null {
  if (context.role !== 'owner' && context.role !== 'admin') {
    return 'Owner or admin role is required to complete onboarding.';
  }

  if (!canWriteSaaSOrgData(context)) {
    return `Organization status ${context.orgStatus} does not allow onboarding writes.`;
  }

  return null;
}

function toLiveDataContext(context: SaaSOrgContext): SaaSOnboardingLiveDataContext {
  return {
    orgId: context.orgId,
    role: context.role,
    plan: context.plan,
    orgStatus: context.orgStatus,
  };
}

function mapContextError(error: SaaSOrgContextError): SaaSOnboardingLiveDataResult {
  if (
    error.code === 'role_forbidden' ||
    error.code === 'membership_required' ||
    error.code === 'unauthenticated'
  ) {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'role_required',
        message: error.message,
      },
    };
  }

  if (error.code === 'subscription_inactive') {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'billing_required',
        message: error.message,
      },
    };
  }

  return {
    state: 'error',
    data: null,
    message: error.message,
  };
}

function mapLiveDataError(
  error: unknown,
  fallbackMessage: string
): SaaSOnboardingLiveDataResult {
  if (error instanceof SaaSOrgContextError) {
    return mapContextError(error);
  }

  return {
    state: 'error',
    data: null,
    message: error instanceof Error && error.message ? error.message : fallbackMessage,
  };
}

async function getOnboardingQueryClient(
  deps: SaaSOnboardingLiveDataDependencies
): Promise<OnboardingQueryClient> {
  return deps.createQueryClient
    ? deps.createQueryClient()
    : ((await createClient()) as unknown as OnboardingQueryClient);
}

export async function buildSaaSOnboardingViewInputFromRepository(
  repository: OnboardingDataRepository,
  input: {
    context: SaaSOrgContext;
    now?: Date;
    period?: OnboardingUsagePeriod;
  }
): Promise<SaaSOnboardingViewInput | null> {
  const now = input.now ?? new Date();
  const period = input.period ?? buildOnboardingUsagePeriod(now);
  const orgId = input.context.orgId;
  const [org, returnPolicyConfigured, members, invites, returns, aiUsage] =
    await Promise.all([
      repository.getOrganization({ orgId }),
      repository.hasReturnPolicy({ orgId }),
      repository.listMembers({ orgId }),
      repository.listInvites({ orgId, now }),
      repository.listReturns({ orgId, period }),
      repository.listAIUsage({ orgId, period }),
    ]);

  if (!org) {
    return null;
  }

  return {
    org: {
      id: org.id,
      name: org.name,
      onboardingCompletedAt: org.onboardingCompletedAt,
    },
    signals: {
      returnPolicyConfigured,
      memberCount: activeMemberCount(members),
      pendingInviteCount: pendingInviteCount(invites),
      returnCount: returns.length,
      aiUsageCount: aiUsage.length,
    },
    actions: {
      canComplete: canCompleteOnboarding(input.context),
      disabledReason: completionDisabledReason(input.context),
    },
  };
}

export async function loadSaaSOnboardingView(
  deps: SaaSOnboardingLiveDataDependencies = {}
): Promise<SaaSOnboardingLiveDataResult> {
  try {
    const context = await (deps.getContext ?? getOrgContext)();
    const repository =
      deps.repository ?? createOnboardingDataRepository(await getOnboardingQueryClient(deps));
    const input = await buildSaaSOnboardingViewInputFromRepository(repository, {
      context,
      now: deps.now,
      period: deps.period,
    });
    const liveContext = toLiveDataContext(context);

    if (!input) {
      return {
        state: 'empty',
        data: null,
        message: 'No onboarding data was found for this organization.',
        context: liveContext,
      };
    }

    return {
      state: 'ready',
      data: buildSaaSOnboardingView(input),
      context: liveContext,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load onboarding progress.');
  }
}
