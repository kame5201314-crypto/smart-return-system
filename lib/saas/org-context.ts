import { requireRouteAuth, type RouteAuthResult } from '@/lib/auth/route-auth';
import { ADMIN_UUID } from '@/lib/auth/admin-session';
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
import { resolveSaaSSubscriptionTimedStatus } from '@/lib/saas/subscription-lifecycle';
import { createClient } from '@/lib/supabase/server';

export type SaaSOrgRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type SaaSOrgStatus = SaaSSubscriptionStatus;
export type SaaSOrgSuspensionSource = 'trial_expired' | 'billing' | 'platform_admin';

export interface SaaSOrgRecord {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  plan?: unknown;
  status?: unknown;
  feature_flags?: unknown;
  featureFlags?: unknown;
  suspension_source?: unknown;
  suspensionSource?: unknown;
  subscriptions?: unknown;
  subscriptionStatus?: unknown;
  subscriptionProvider?: unknown;
  trialEnd?: unknown;
  currentPeriodEnd?: unknown;
  cancelAtPeriodEnd?: unknown;
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
  suspensionSource?: SaaSOrgSuspensionSource | null;
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

export interface FindSaaSOrgSuspensionSourceInput {
  orgId: string;
}

export interface SaaSOrgMembershipRepository {
  findMembership(input: FindSaaSOrgMembershipInput): Promise<SaaSOrgMembershipRecord | null>;
  findSuspensionSource?(
    input: FindSaaSOrgSuspensionSourceInput
  ): Promise<SaaSOrgSuspensionSource | null>;
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
  now?: Date | string | number;
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
  order(column: string, options: { ascending: boolean }): PromiseLike<{
    data: unknown;
    error: SupabaseOrgQueryError | null;
  }>;
}

interface SupabaseOrgQueryClient {
  from(table: string): SupabaseOrgQueryBuilder;
}

interface SupabaseSuspensionQueryBuilder {
  select(columns: string): SupabaseSuspensionQueryBuilder;
  eq(column: string, value: unknown): SupabaseSuspensionQueryBuilder;
  in(column: string, values: readonly unknown[]): SupabaseSuspensionQueryBuilder;
  order(
    column: string,
    options: { ascending: boolean }
  ): SupabaseSuspensionQueryBuilder;
  limit(count: number): SupabaseSuspensionQueryBuilder;
  maybeSingle(): PromiseLike<{
    data: unknown;
    error: SupabaseOrgQueryError | null;
  }>;
}

interface SupabaseSuspensionQueryClient {
  from(table: string): SupabaseSuspensionQueryBuilder;
}

const SUSPENSION_ACTION_SOURCES: Record<string, SaaSOrgSuspensionSource> = {
  'lifecycle.trial_expired_suspended': 'trial_expired',
  'lifecycle.prepaid_period_expired_suspended': 'billing',
  'platform.billing.org_suspended': 'platform_admin',
};

const SUSPENSION_ACTIONS = Object.keys(SUSPENSION_ACTION_SOURCES);

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
const VALID_SUSPENSION_SOURCES: SaaSOrgSuspensionSource[] = [
  'trial_expired',
  'billing',
  'platform_admin',
];
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

export function normalizeSaaSOrgSuspensionSource(
  value: unknown
): SaaSOrgSuspensionSource | null {
  const normalized = stringOrNull(value)?.toLowerCase();
  return VALID_SUSPENSION_SOURCES.includes(normalized as SaaSOrgSuspensionSource)
    ? normalized as SaaSOrgSuspensionSource
    : null;
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

interface SaaSSubscriptionSnapshot {
  status: unknown;
  provider: string | null;
  trialEnd: unknown;
  currentPeriodEnd: unknown;
  cancelAtPeriodEnd: boolean;
}

function normalizeJoinedSubscription(value: unknown): SaaSSubscriptionSnapshot | null {
  const subscription = Array.isArray(value) ? value[0] : value;
  if (!isRecord(subscription)) return null;
  return {
    status: subscription.status ?? null,
    provider: stringOrNull(subscription.provider),
    trialEnd: subscription.trial_end ?? subscription.trialEnd ?? null,
    currentPeriodEnd:
      subscription.current_period_end ?? subscription.currentPeriodEnd ?? null,
    cancelAtPeriodEnd:
      subscription.cancel_at_period_end === true || subscription.cancelAtPeriodEnd === true,
  };
}

function readMembershipSubscription(
  membership: SaaSOrgMembershipRecord
): SaaSSubscriptionSnapshot {
  const organization = membership.organization;
  const joined = normalizeJoinedSubscription(organization.subscriptions);
  return {
    status: organization.subscriptionStatus ?? joined?.status ?? null,
    provider: stringOrNull(organization.subscriptionProvider) ?? joined?.provider ?? null,
    trialEnd: organization.trialEnd ?? joined?.trialEnd ?? null,
    currentPeriodEnd: organization.currentPeriodEnd ?? joined?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd:
      organization.cancelAtPeriodEnd === true || joined?.cancelAtPeriodEnd === true,
  };
}

function requiresFixedTerm(provider: string | null): boolean {
  const normalizedProvider = provider?.trim().toLowerCase() ?? '';
  // ECPay access is always backed by a dated prepaid period. Historical
  // manually-managed organizations may intentionally have no period end, so
  // preserve those legacy workspaces until the database can distinguish them
  // from newer finite manual grants using billing evidence.
  return normalizedProvider === 'ecpay';
}

interface ResolvedMembershipAccess {
  status: SaaSOrgStatus;
  suspensionSource: SaaSOrgSuspensionSource | null;
}

function resolveMembershipAccess(
  membership: SaaSOrgMembershipRecord,
  now?: Date | string | number
): ResolvedMembershipAccess {
  const organization = membership.organization;
  const orgStatus = normalizeSaaSOrgStatus(organization.status);
  const subscription = readMembershipSubscription(membership);
  const subscriptionStatus = normalizeSaaSSubscriptionStatus(subscription.status);

  if (orgStatus !== subscriptionStatus) {
    return {
      status: 'suspended',
      suspensionSource:
        orgStatus === 'suspended'
          ? normalizeSaaSOrgSuspensionSource(
              organization.suspension_source ?? organization.suspensionSource
            )
          : null,
    };
  }

  const lifecycle = resolveSaaSSubscriptionTimedStatus({
    status: subscriptionStatus,
    trialEnd: subscription.trialEnd as Date | string | number | null | undefined,
    currentPeriodEnd:
      subscription.currentPeriodEnd as Date | string | number | null | undefined,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    requiresCurrentPeriodEnd: requiresFixedTerm(subscription.provider),
    now,
  });

  if (lifecycle.nextStatus !== 'suspended') {
    return { status: lifecycle.nextStatus, suspensionSource: null };
  }

  if (
    lifecycle.reason === 'trial_expired'
  ) {
    return { status: 'suspended', suspensionSource: 'trial_expired' };
  }

  if (lifecycle.reason === 'trial_expiry_unavailable') {
    return { status: 'suspended', suspensionSource: null };
  }

  if (
    lifecycle.reason === 'prepaid_period_expired'
    || lifecycle.reason === 'prepaid_period_expiry_unavailable'
    || lifecycle.reason === 'past_due_grace_expired'
  ) {
    return { status: 'suspended', suspensionSource: 'billing' };
  }

  return {
    status: 'suspended',
    suspensionSource: normalizeSaaSOrgSuspensionSource(
      organization.suspension_source ?? organization.suspensionSource
    ),
  };
}

export function selectPreferredSaaSOrgMembership(
  value: unknown,
  now?: Date | string | number
): SaaSOrgMembershipRecord | null {
  if (!Array.isArray(value)) return null;

  const memberships = value
    .map(normalizeMembershipRow)
    .filter((membership): membership is SaaSOrgMembershipRecord => membership !== null);

  return memberships.find((membership) => (
    canCreateSaaSData(resolveMembershipAccess(membership, now).status)
  )) ?? memberships[0] ?? null;
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
  const subscription = normalizeJoinedSubscription(organization.subscriptions);

  return {
    orgId,
    role: row.role,
    organization: {
      ...organization,
      id: stringOrNull(organization.id) ?? orgId,
      ...(subscription
        ? {
            subscriptionStatus: subscription.status,
            subscriptionProvider: subscription.provider,
            trialEnd: subscription.trialEnd,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : {}),
    },
  };
}

export function buildSaaSOrgContext(params: {
  userId: string;
  membership: SaaSOrgMembershipRecord;
  isPlatformAdmin?: boolean;
  env?: Record<string, string | undefined>;
  now?: Date | string | number;
}): SaaSOrgContext {
  const { userId, membership } = params;
  const organization = membership.organization;
  const plan = normalizeSaaSPlanCode(organization.plan);
  const orgFeatureFlags = normalizeOrgFeatureFlags(
    organization.feature_flags ?? organization.featureFlags
  );
  const access = resolveMembershipAccess(membership, params.now);

  return {
    userId,
    orgId: membership.orgId,
    orgName: stringOrNull(organization.name) ?? '',
    orgSlug: stringOrNull(organization.slug),
    orgStatus: access.status,
    suspensionSource: access.suspensionSource,
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
        .select('org_id, role, status, organizations!inner(id, name, slug, plan, status, suspension_source, feature_flags, subscriptions(status, provider, trial_end, current_period_end, cancel_at_period_end))')
        .eq('user_id', input.userId)
        .eq('status', 'active');

      if (input.orgId) {
        query = query.eq('org_id', input.orgId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) {
        throw new SaaSOrgContextError(
          'lookup_failed',
          500,
          error.message || 'Failed to load SaaS organization context.'
        );
      }

      return selectPreferredSaaSOrgMembership(data);
    },
    async findSuspensionSource(
      input: FindSaaSOrgSuspensionSourceInput
    ): Promise<SaaSOrgSuspensionSource | null> {
      const client =
        injectedClient ?? ((await createClient()) as unknown as SupabaseOrgQueryClient);
      const suspensionClient = client as unknown as SupabaseSuspensionQueryClient;
      const { data, error } = await suspensionClient
        .from('audit_logs')
        .select('action, created_at')
        .eq('org_id', input.orgId)
        .in('action', SUSPENSION_ACTIONS)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new SaaSOrgContextError(
          'lookup_failed',
          500,
          error.message || 'Failed to load SaaS organization suspension source.'
        );
      }

      if (!isRecord(data)) {
        return null;
      }

      const action = stringOrNull(data.action);
      return action ? SUSPENSION_ACTION_SOURCES[action] ?? null : null;
    },
  };
}

export async function getOrgContext(options: GetOrgContextOptions = {}): Promise<SaaSOrgContext> {
  const auth = await (options.auth ?? requireRouteAuth)();

  if (!auth.ok || !auth.userId) {
    throw new SaaSOrgContextError('unauthenticated', auth.status || 401, 'Authentication required.');
  }

  if (auth.isAdmin === true && auth.userId === ADMIN_UUID) {
    throw new SaaSOrgContextError(
      'membership_required',
      403,
      'A SaaS organization account is required for workspace settings. Sign in with a tenant user to manage an organization.'
    );
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

  let context = buildSaaSOrgContext({
    userId: auth.userId,
    membership,
    isPlatformAdmin: auth.isAdmin === true,
    env: options.env,
    now: options.now,
  });

  if (
    context.orgStatus === 'suspended'
    && !context.suspensionSource
    && repository.findSuspensionSource
  ) {
    const suspensionSource = await repository.findSuspensionSource({
      orgId: context.orgId,
    });
    if (suspensionSource) {
      context = {
        ...context,
        suspensionSource,
      };
    }
  }

  assertSaaSOrgContext(context, options.requirements);
  return context;
}

export const requireOrgContext = getOrgContext;
