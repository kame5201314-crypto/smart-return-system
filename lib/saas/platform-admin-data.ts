export interface PlatformOrgSummary {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  status: string;
  ownerEmail: string | null;
  memberCount: number;
  createdAt: string | null;
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

export interface PlatformAdminDataRepository {
  listOrganizations(input?: { limit?: number }): Promise<PlatformOrgSummary[]>;
  getOrganization(input: { orgId: string }): Promise<PlatformOrgDetail | null>;
  listBillingEvents(input?: { limit?: number }): Promise<PlatformBillingEventSummary[]>;
}

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryBuilder {
  select(columns: string): SupabaseQueryBuilder;
  eq(column: string, value: string): SupabaseQueryBuilder;
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
    status: stringOrFallback(row.status, 'pending'),
    providerEventId: stringOrNull(row.provider_event_id),
    createdAt: stringOrNull(row.created_at),
  };
}

function assertNoSupabaseError(error: SupabaseQueryError | null, fallbackMessage: string): void {
  if (error) {
    throw new Error(error.message || fallbackMessage);
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
        .select('id, name, slug, plan, status, owner_email, member_count, created_at')
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
        .select('id, org_id, provider, event_type, status, provider_event_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      assertNoSupabaseError(error, 'Failed to load billing events.');
      return (Array.isArray(data) ? data : [])
        .map((row) => normalizeBillingEvent(row))
        .filter((event): event is PlatformBillingEventSummary => event !== null);
    },
  };
}
