import { requireRouteAuth, type RouteAuthResult } from '@/lib/auth/route-auth';
import { resolveSaaSFeatureFlags, type SaaSFeatureFlag } from '@/lib/config/feature-flags';
import {
  getSaaSPlanDefinition,
  normalizeSaaSPlanCode,
  type SaaSPlanCode,
  type SaaSPlanDefinition,
} from '@/lib/config/saas-plans';
import {
  canExportSaaSData,
  canCreateSaaSData,
  normalizeSaaSSubscriptionStatus,
  type SaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';
import { createClient } from '@/lib/supabase/server';

export type SaaSOrgRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type SaaSOrgStatus = SaaSSubscriptionStatus;

export interface SaaSOrgRecord {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  plan?: unknown;
  status?: unknown;
  feature_flags?: unknown;
  featureFlags?: unknown;
}

export interface SaaSOrgMembershipRecord {
  orgId: string;
  role?: unknown;
  organization: SaaSOrgRecord;
}

export interface SaaSOrgContext {
  userId: string;
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  orgStatus: SaaSOrgStatus;
  role: SaaSOrgRole;
  plan: SaaSPlanCode;
  planDefinition: SaaSPlanDefinition;
  featureFlags: Record<SaaSFeatureFlag, boolean>;
  isPlatformAdmin: boolean;
}

export interface FindSaaSOrgMembershipInput {
  userId: string;
  orgId?: string | null;
}

export interface SaaSOrgMembershipRepository {
  findMembership(input: FindSaaSOrgMembershipInput): Promise<SaaSOrgMembershipRecord | null>;
}

export interface SaaSOrgContextRequirements {
  roles?: SaaSOrgRole[];
  feature?: SaaSFeatureFlag;
  writable?: boolean;
  exportable?: boolean;
}

export interface GetOrgContextOptions {
  orgId?: string | null;
  auth?: () => Promise<RouteAuthResult>;
  repository?: SaaSOrgMembershipRepository;
  requirements?: SaaSOrgContextRequirements;
  env?: Record<string, string | undefined>;
}

export type SaaSOrgContextErrorCode =
  | 'unauthenticated'
  | 'membership_required'
  | 'role_forbidden'
  | 'feature_forbidden'
  | 'subscription_inactive'
  | 'lookup_failed';

export class SaaSOrgContextError extends Error {
  readonly code: SaaSOrgContextErrorCode;
  readonly status: number;

  constructor(code: SaaSOrgContextErrorCode, status: number, message: string) {
    super(message);
    this.name = 'SaaSOrgContextError';
    this.code = code;
    this.status = status;
  }
}

interface SupabaseOrgQueryError {
  message?: string;
}

interface SupabaseOrgQueryBuilder {
  select(columns: string): SupabaseOrgQueryBuilder;
  eq(column: string, value: string): SupabaseOrgQueryBuilder;
  order(column: string, options: { ascending: boolean }): SupabaseOrgQueryBuilder;
  limit(count: number): SupabaseOrgQueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: SupabaseOrgQueryError | null }>;
}

interface SupabaseOrgQueryClient {
  from(table: string): SupabaseOrgQueryBuilder;
}

const SAAS_FEATURE_FLAGS: SaaSFeatureFlag[] = [
  'public_signup',
  'billing',
  'subscription_plan',
  'ai_usage_limit',
  'advanced_analytics',
  'multi_tenant_admin',
  'image_ai',
];

const VALID_ORG_ROLES: SaaSOrgRole[] = ['owner', 'admin', 'staff', 'viewer'];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeSaaSOrgRole(value: unknown): SaaSOrgRole {
  const normalized = stringOrNull(value)?.toLowerCase();
  if (normalized === 'member') {
    return 'staff';
  }
  if (VALID_ORG_ROLES.includes(normalized as SaaSOrgRole)) {
    return normalized as SaaSOrgRole;
  }
  return 'viewer';
}

export function normalizeSaaSOrgStatus(value: unknown): SaaSOrgStatus {
  return normalizeSaaSSubscriptionStatus(value);
}

function normalizeOrgFeatureFlags(value: unknown): Partial<Record<SaaSFeatureFlag, boolean>> | null {
  if (!isRecord(value)) {
    return null;
  }

  return SAAS_FEATURE_FLAGS.reduce<Partial<Record<SaaSFeatureFlag, boolean>>>((flags, flag) => {
    if (typeof value[flag] === 'boolean') {
      flags[flag] = value[flag];
    }
    return flags;
  }, {});
}

function normalizeJoinedOrganization(value: unknown): SaaSOrgRecord | null {
  if (Array.isArray(value)) {
    return isRecord(value[0]) ? (value[0] as SaaSOrgRecord) : null;
  }
  return isRecord(value) ? (value as SaaSOrgRecord) : null;
}

export function normalizeMembershipRow(row: unknown): SaaSOrgMembershipRecord | null {
  if (!isRecord(row)) {
    return null;
  }

  const organization = normalizeJoinedOrganization(row.organizations ?? row.organization);
  const orgId = stringOrNull(row.org_id) ?? stringOrNull(organization?.id);

  if (!organization || !orgId) {
    return null;
  }

  return {
    orgId,
    role: row.role,
    organization: {
      ...organization,
      id: stringOrNull(organization.id) ?? orgId,
    },
  };
}

export function buildSaaSOrgContext(params: {
  userId: string;
  membership: SaaSOrgMembershipRecord;
  isPlatformAdmin?: boolean;
  env?: Record<string, string | undefined>;
}): SaaSOrgContext {
  const { userId, membership } = params;
  const organization = membership.organization;
  const plan = normalizeSaaSPlanCode(organization.plan);
  const orgFeatureFlags = normalizeOrgFeatureFlags(
    organization.feature_flags ?? organization.featureFlags
  );

  return {
    userId,
    orgId: membership.orgId,
    orgName: stringOrNull(organization.name) ?? '',
    orgSlug: stringOrNull(organization.slug),
    orgStatus: normalizeSaaSOrgStatus(organization.status),
    role: normalizeSaaSOrgRole(membership.role),
    plan,
    planDefinition: getSaaSPlanDefinition(plan),
    featureFlags: resolveSaaSFeatureFlags({
      env: params.env,
      orgPlan: plan,
      orgFeatureFlags,
    }),
    isPlatformAdmin: params.isPlatformAdmin === true,
  };
}

export function canWriteSaaSOrgData(context: SaaSOrgContext): boolean {
  return canCreateSaaSData(context.orgStatus);
}

export function canExportSaaSOrgData(context: SaaSOrgContext): boolean {
  return canExportSaaSData(context.orgStatus);
}

export function assertSaaSOrgContext(
  context: SaaSOrgContext,
  requirements?: SaaSOrgContextRequirements
): void {
  if (!requirements) {
    return;
  }

  if (requirements.roles?.length && !requirements.roles.includes(context.role)) {
    throw new SaaSOrgContextError(
      'role_forbidden',
      403,
      `SaaS org role ${context.role} is not allowed for this action.`
    );
  }

  if (requirements.feature && !context.featureFlags[requirements.feature]) {
    throw new SaaSOrgContextError(
      'feature_forbidden',
      403,
      `SaaS feature ${requirements.feature} is not enabled for this org.`
    );
  }

  if (requirements.writable && !canWriteSaaSOrgData(context)) {
    throw new SaaSOrgContextError(
      'subscription_inactive',
      402,
      `SaaS org status ${context.orgStatus} does not allow write actions.`
    );
  }

  if (requirements.exportable && !canExportSaaSOrgData(context)) {
    throw new SaaSOrgContextError(
      'subscription_inactive',
      402,
      `SaaS org status ${context.orgStatus} does not allow export actions.`
    );
  }
}

export function createSupabaseOrgMembershipRepository(
  injectedClient?: SupabaseOrgQueryClient
): SaaSOrgMembershipRepository {
  return {
    async findMembership(input: FindSaaSOrgMembershipInput): Promise<SaaSOrgMembershipRecord | null> {
      const client =
        injectedClient ?? ((await createClient()) as unknown as SupabaseOrgQueryClient);
      let query = client
        .from('organization_members')
        .select('org_id, role, organizations!inner(id, name, slug, plan, status, feature_flags)')
        .eq('user_id', input.userId);

      if (input.orgId) {
        query = query.eq('org_id', input.orgId);
      }

      const { data, error } = await query.order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (error) {
        throw new SaaSOrgContextError(
          'lookup_failed',
          500,
          error.message || 'Failed to load SaaS organization context.'
        );
      }

      return normalizeMembershipRow(data);
    },
  };
}

export async function getOrgContext(options: GetOrgContextOptions = {}): Promise<SaaSOrgContext> {
  const auth = await (options.auth ?? requireRouteAuth)();

  if (!auth.ok || !auth.userId) {
    throw new SaaSOrgContextError('unauthenticated', auth.status || 401, 'Authentication required.');
  }

  const repository = options.repository ?? createSupabaseOrgMembershipRepository();
  const membership = await repository.findMembership({
    userId: auth.userId,
    orgId: options.orgId,
  });

  if (!membership) {
    throw new SaaSOrgContextError(
      'membership_required',
      403,
      'A SaaS organization membership is required for this action.'
    );
  }

  const context = buildSaaSOrgContext({
    userId: auth.userId,
    membership,
    isPlatformAdmin: auth.isAdmin === true,
    env: options.env,
  });

  assertSaaSOrgContext(context, options.requirements);
  return context;
}

export const requireOrgContext = getOrgContext;
