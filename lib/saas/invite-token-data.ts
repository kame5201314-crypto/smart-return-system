import {
  canAcceptSaaSInvite,
  isSaaSInviteRole,
  resolveSaaSInviteStatus,
  type SaaSInviteRole,
  type SaaSInviteStatus,
} from '@/lib/saas/invite-policy';

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

export interface InviteTokenQueryBuilder {
  select(columns: string): InviteTokenQueryBuilder;
  eq(column: string, value: unknown): InviteTokenQueryBuilder;
  maybeSingle(): Promise<SupabaseQueryResult>;
}

export interface InviteTokenQueryClient {
  from(table: string): InviteTokenQueryBuilder;
}

export interface InviteTokenDataRepository {
  getInviteByToken(input: { token: string; now?: Date }): Promise<SaaSInviteTokenData | null>;
}

export interface SaaSInviteTokenData {
  id: string;
  orgId: string;
  email: string;
  role: SaaSInviteRole | null;
  token: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  status: SaaSInviteStatus;
  canAccept: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
  } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find(isRecord) ?? null;
  }

  return null;
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

function normalizeOrganization(value: unknown): SaaSInviteTokenData['organization'] {
  const row = firstRecord(value);
  if (!row) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: stringOrFallback(row.name, ''),
    slug: stringOrFallback(row.slug, ''),
    plan: stringOrFallback(row.plan, 'basic'),
    status: stringOrFallback(row.status, 'trialing'),
  };
}

function normalizeInvite(row: unknown, now: Date): SaaSInviteTokenData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const orgId = stringOrNull(row.org_id);
  const email = stringOrNull(row.email);
  const token = stringOrNull(row.token);
  if (!id || !orgId || !email || !token) {
    return null;
  }

  const acceptedAt = stringOrNull(row.accepted_at);
  const expiresAt = stringOrNull(row.expires_at);
  const role = isSaaSInviteRole(row.role) ? row.role : null;
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
    role,
    token,
    expiresAt,
    acceptedAt,
    status,
    canAccept: canAcceptSaaSInvite({
      role,
      status: stringOrNull(row.status),
      acceptedAt,
      expiresAt,
      now,
    }),
    organization: normalizeOrganization(row.organizations),
  };
}

export function createInviteTokenDataRepository(
  client: InviteTokenQueryClient
): InviteTokenDataRepository {
  return {
    async getInviteByToken(input) {
      const token = stringOrNull(input.token);
      if (!token) {
        return null;
      }

      const { data, error } = await client
        .from('organization_invites')
        .select(
          'id, org_id, email, role, token, status, expires_at, accepted_at, organizations(id, name, slug, plan, status)'
        )
        .eq('token', token)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load organization invite by token.');
      return normalizeInvite(data, input.now ?? new Date());
    },
  };
}
