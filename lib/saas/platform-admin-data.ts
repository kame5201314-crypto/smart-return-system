export interface PlatformOrgSummary {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  ownerEmail: string | null;
  memberCount: number;
  createdAt: string | null;
  onboardingCompletedAt?: string | null;
}

export interface PlatformOrgDetail extends PlatformOrgSummary {
  featureFlags: Record<string, unknown>;
  billingEmail: string | null;
  taxId: string | null;
  members: Array<{
    id: string;
    email: string | null;
    role: string;
    status: string;
  }>;
}

export interface PlatformBillingEventSummary {
  id: string;
  orgId: string;
  provider: string;
  eventType: string;
  status: string;
  providerEventId: string | null;
  createdAt: string | null;
}

export interface PlatformOrgUsageSnapshot {
  returnsThisMonth: number;
  aiUsedThisMonth: number;
}

export interface PlatformOrgSubscriptionSnapshot {
  status: string;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface PlatformAuditLogSummary {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: string;
}

export interface PlatformAdminDataRepository {
  listOrganizations(input?: { limit?: number }): Promise<PlatformOrgSummary[]>;
  getOrganization(input: { orgId: string }): Promise<PlatformOrgDetail | null>;
  listBillingEvents(input?: { limit?: number }): Promise<PlatformBillingEventSummary[]>;
  listOrganizationUsage(input: {
    orgIds: string[];
    periodStart: string;
  }): Promise<Record<string, PlatformOrgUsageSnapshot>>;
  listOrganizationSubscriptions(input: {
    orgIds: string[];
  }): Promise<Record<string, PlatformOrgSubscriptionSnapshot>>;
  listOrganizationNames(input: { orgIds: string[] }): Promise<Record<string, string | null>>;
  listAuditLogs(input: { orgId: string; limit?: number }): Promise<PlatformAuditLogSummary[]>;
}

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryBuilder {
  select(columns: string): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  in(column: string, values: string[]): SupabaseQueryBuilder;
  gte(column: string, value: string): SupabaseQueryBuilder;
  order(column: string, options: { ascending: boolean }): SupabaseQueryBuilder;
  limit(count: number): SupabaseQueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: SupabaseQueryError | null }>;
  then<TResult1 = { data: unknown; error: SupabaseQueryError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: SupabaseQueryError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

export interface PlatformAdminQueryClient {
  from(table: string): SupabaseQueryBuilder;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeOrgSummary(row: unknown): PlatformOrgSummary | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: stringOrFallback(row.name, ''),
    slug: stringOrNull(row.slug),
    plan: stringOrFallback(row.plan, 'basic'),
    status: stringOrFallback(row.status, 'suspended'),
    ownerEmail: stringOrNull(row.owner_email),
    memberCount: numberOrZero(row.member_count),
    createdAt: stringOrNull(row.created_at),
    onboardingCompletedAt: stringOrNull(row.onboarding_completed_at),
  };
}

function normalizeOrgMember(row: unknown): PlatformOrgDetail['members'][number] | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: stringOrNull(row.email),
    role: stringOrFallback(row.role, 'viewer'),
    status: stringOrFallback(row.status, 'active'),
  };
}

function normalizeOrgDetail(row: unknown): PlatformOrgDetail | null {
  const summary = normalizeOrgSummary(row);
  if (!summary || !isRecord(row)) {
    return null;
  }

  const rawMembers = Array.isArray(row.organization_members) ? row.organization_members : [];

  return {
    ...summary,
    featureFlags: recordOrEmpty(row.feature_flags),
    billingEmail: stringOrNull(row.billing_email),
    taxId: stringOrNull(row.tax_id),
    members: rawMembers
      .map((member) => normalizeOrgMember(member))
      .filter((member): member is PlatformOrgDetail['members'][number] => member !== null),
  };
}

function normalizeBillingEvent(row: unknown): PlatformBillingEventSummary | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const orgId = stringOrNull(row.org_id);
  if (!id || !orgId) {
    return null;
  }

  return {
    id,
    orgId,
    provider: stringOrFallback(row.provider, ''),
    eventType: stringOrFallback(row.event_type, ''),
    status: stringOrNull(row.status) ?? (stringOrNull(row.processed_at) ? 'processed' : 'received'),
    providerEventId: stringOrNull(row.provider_event_id),
    createdAt: stringOrNull(row.created_at),
  };
}

function normalizeOrgName(row: unknown): { id: string; name: string | null } | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: stringOrNull(row.name),
  };
}

function normalizeUsageRow(row: unknown): { orgId: string } | null {
  if (!isRecord(row)) {
    return null;
  }

  const orgId = stringOrNull(row.org_id);
  return orgId ? { orgId } : null;
}

function normalizeSubscriptionRow(
  row: unknown
): { orgId: string; subscription: PlatformOrgSubscriptionSnapshot } | null {
  if (!isRecord(row)) {
    return null;
  }

  const orgId = stringOrNull(row.org_id);
  if (!orgId) {
    return null;
  }

  return {
    orgId,
    subscription: {
      status: stringOrFallback(row.status, 'trialing'),
      currentPeriodEnd: stringOrNull(row.current_period_end),
      trialEnd: stringOrNull(row.trial_end),
      cancelAtPeriodEnd: booleanOrFalse(row.cancel_at_period_end),
    },
  };
}

function normalizeAuditLog(row: unknown): PlatformAuditLogSummary | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const action = stringOrNull(row.action);
  const createdAt = stringOrNull(row.created_at);
  if (!id || !action || !createdAt) {
    return null;
  }

  return {
    id,
    action,
    actorEmail: stringOrNull(row.actor_email),
    createdAt,
  };
}

function assertNoSupabaseError(error: SupabaseQueryError | null, fallbackMessage: string): void {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
}

function buildEmptyUsage(orgIds: string[]): Record<string, PlatformOrgUsageSnapshot> {
  return Object.fromEntries(
    orgIds.map((orgId) => [
      orgId,
      {
        returnsThisMonth: 0,
        aiUsedThisMonth: 0,
      },
    ])
  );
}

function incrementUsage(
  usageByOrgId: Record<string, PlatformOrgUsageSnapshot>,
  rows: unknown,
  field: keyof PlatformOrgUsageSnapshot
): void {
  for (const row of Array.isArray(rows) ? rows : []) {
    const normalized = normalizeUsageRow(row);
    if (!normalized || !usageByOrgId[normalized.orgId]) {
      continue;
    }

    usageByOrgId[normalized.orgId][field] += 1;
  }
}

export function createPlatformAdminDataRepository(
  client: PlatformAdminQueryClient
): PlatformAdminDataRepository {
  return {
    async listOrganizations(input = {}) {
      const limit = input.limit ?? 50;
      const { data, error } = await client
        .from('organizations')
        .select('id, name, slug, plan, status, owner_email, member_count, created_at, onboarding_completed_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      assertNoSupabaseError(error, 'Failed to load organizations.');
      return (Array.isArray(data) ? data : [])
        .map((row) => normalizeOrgSummary(row))
        .filter((org): org is PlatformOrgSummary => org !== null);
    },

    async getOrganization(input) {
      const { data, error } = await client
        .from('organizations')
        .select(`
          id,
          name,
          slug,
          plan,
          status,
          owner_email,
          member_count,
          created_at,
          onboarding_completed_at,
          feature_flags,
          billing_email,
          tax_id,
          organization_members (
            id,
            email,
            role,
            status
          )
        `)
        .eq('id', input.orgId)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load organization detail.');
      return normalizeOrgDetail(data);
    },

    async listBillingEvents(input = {}) {
      const limit = input.limit ?? 50;
      const { data, error } = await client
        .from('billing_events')
        .select('id, org_id, provider, event_type, status, provider_event_id, processed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      assertNoSupabaseError(error, 'Failed to load billing events.');
      return (Array.isArray(data) ? data : [])
        .map((row) => normalizeBillingEvent(row))
        .filter((event): event is PlatformBillingEventSummary => event !== null);
    },

    async listOrganizationUsage(input) {
      if (input.orgIds.length === 0) {
        return {};
      }

      const usageByOrgId = buildEmptyUsage(input.orgIds);

      const { data: returnRows, error: returnsError } = await client
        .from('return_requests')
        .select('id, org_id, created_at')
        .in('org_id', input.orgIds)
        .gte('created_at', input.periodStart);

      assertNoSupabaseError(returnsError, 'Failed to load organization return usage.');
      incrementUsage(usageByOrgId, returnRows, 'returnsThisMonth');

      const { data: aiRows, error: aiError } = await client
        .from('ai_usage_events')
        .select('id, org_id, cached, success, created_at')
        .in('org_id', input.orgIds)
        .gte('created_at', input.periodStart)
        .eq('cached', false)
        .eq('success', true);

      assertNoSupabaseError(aiError, 'Failed to load organization AI usage.');
      incrementUsage(usageByOrgId, aiRows, 'aiUsedThisMonth');

      return usageByOrgId;
    },

    async listOrganizationSubscriptions(input) {
      if (input.orgIds.length === 0) {
        return {};
      }

      const { data, error } = await client
        .from('subscriptions')
        .select('org_id, status, current_period_end, trial_end, cancel_at_period_end, created_at')
        .in('org_id', input.orgIds)
        .order('created_at', { ascending: false });

      assertNoSupabaseError(error, 'Failed to load organization subscriptions.');

      const subscriptionsByOrgId: Record<string, PlatformOrgSubscriptionSnapshot> = {};
      for (const row of Array.isArray(data) ? data : []) {
        const normalized = normalizeSubscriptionRow(row);
        if (!normalized || subscriptionsByOrgId[normalized.orgId]) {
          continue;
        }

        subscriptionsByOrgId[normalized.orgId] = normalized.subscription;
      }

      return subscriptionsByOrgId;
    },

    async listOrganizationNames(input) {
      if (input.orgIds.length === 0) {
        return {};
      }

      const { data, error } = await client
        .from('organizations')
        .select('id, name')
        .in('id', input.orgIds);

      assertNoSupabaseError(error, 'Failed to load organization names.');

      return Object.fromEntries(
        (Array.isArray(data) ? data : [])
          .map((row) => normalizeOrgName(row))
          .filter((org): org is { id: string; name: string | null } => org !== null)
          .map((org) => [org.id, org.name])
      );
    },

    async listAuditLogs(input) {
      const limit = input.limit ?? 20;
      const { data, error } = await client
        .from('audit_logs')
        .select('id, action, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      assertNoSupabaseError(error, 'Failed to load organization audit logs.');

      return (Array.isArray(data) ? data : [])
        .map((row) => normalizeAuditLog(row))
        .filter((log): log is PlatformAuditLogSummary => log !== null);
    },
  };
}
