import { getPostLoginRedirect, normalizeLocalRedirectPath } from '@/lib/auth/post-login-redirect';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { normalizeSaaSPlanCode, type SaaSPlanCode } from '@/lib/config/saas-plans';

export interface GoogleOAuthUser {
  id: string;
  email?: string | null;
}

export interface GoogleOAuthMembership {
  orgId: string;
  status: string | null;
}

export interface GoogleOAuthMembershipRepository {
  listMemberships(userId: string): Promise<GoogleOAuthMembership[]>;
}

interface SupabaseMembershipQueryError {
  message?: string;
}

interface SupabaseMembershipQueryBuilder {
  select(columns: string): SupabaseMembershipQueryBuilder;
  eq(column: string, value: string): SupabaseMembershipQueryBuilder;
  order(column: string, options: { ascending: boolean }): PromiseLike<{
    data: unknown;
    error: SupabaseMembershipQueryError | null;
  }>;
}

interface SupabaseMembershipQueryClient {
  from(table: string): SupabaseMembershipQueryBuilder;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMembershipRows(value: unknown): GoogleOAuthMembership[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!isRecord(row) || typeof row.org_id !== 'string' || !row.org_id.trim()) {
      return [];
    }

    return [{
      orgId: row.org_id.trim(),
      status: typeof row.status === 'string' ? row.status.trim().toLowerCase() : null,
    }];
  });
}

export function createGoogleOAuthMembershipRepository(
  client: SupabaseMembershipQueryClient
): GoogleOAuthMembershipRepository {
  return {
    async listMemberships(userId) {
      const { data, error } = await client
        .from('organization_members')
        .select('org_id, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message || 'Failed to load organization memberships.');
      }

      return normalizeMembershipRows(data);
    },
  };
}

export function normalizeGoogleTrialPlan(value: unknown): Extract<SaaSPlanCode, 'basic' | 'growth'> {
  const plan = normalizeSaaSPlanCode(value);
  return plan === 'growth' ? 'growth' : 'basic';
}

export function normalizeGoogleOAuthNext(value: unknown): string | null {
  const path = normalizeLocalRedirectPath(value);
  if (!path || path === '/auth' || path.startsWith('/auth/')) {
    return null;
  }
  return path;
}

function normalizeHttpOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\\n/g, '').trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveGoogleOAuthAppOrigin(
  requestOrigin: string,
  env: Record<string, string | undefined> = process.env
): string {
  return normalizeHttpOrigin(env.NEXT_PUBLIC_APP_URL)
    ?? normalizeHttpOrigin(requestOrigin)
    ?? 'http://localhost:3000';
}

export function buildSignupCompletePath(input?: {
  plan?: unknown;
  state?: 'no_workspace' | 'membership_disabled';
}): string {
  const params = new URLSearchParams();
  params.set('plan', normalizeGoogleTrialPlan(input?.plan));
  if (input?.state && input.state !== 'no_workspace') {
    params.set('state', input.state);
  }
  return `/signup/complete?${params.toString()}`;
}

export function resolveGoogleOAuthDestination(input: {
  user: GoogleOAuthUser;
  memberships: GoogleOAuthMembership[];
  requestedPath?: unknown;
  trialPlan?: unknown;
  env?: Record<string, string | undefined>;
}): string {
  if (isExplicitPlatformAdminPrincipal({
    userId: input.user.id,
    userEmail: input.user.email,
    env: input.env,
  })) {
    return '/internal';
  }

  const activeMembership = input.memberships.find(
    (membership) => membership.status !== 'disabled'
  );
  if (activeMembership) {
    return getPostLoginRedirect({
      isAdmin: false,
      requestedPath: normalizeGoogleOAuthNext(input.requestedPath),
    });
  }

  if (input.memberships.length > 0) {
    return buildSignupCompletePath({
      plan: input.trialPlan,
      state: 'membership_disabled',
    });
  }

  return buildSignupCompletePath({ plan: input.trialPlan });
}
