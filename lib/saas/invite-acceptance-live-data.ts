import { requireRouteAuth, type RouteAuthResult } from '@/lib/auth/route-auth';
import {
  createInviteTokenDataRepository,
  type InviteTokenDataRepository,
  type InviteTokenQueryClient,
  type SaaSInviteTokenData,
} from '@/lib/saas/invite-token-data';
import type {
  GatedState,
  ViewState,
} from '@/lib/saas/ui-backend-contracts';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type InviteAcceptanceViewerState =
  | 'can_accept'
  | 'needs_login'
  | 'email_mismatch'
  | 'already_member';

export interface InviteAcceptanceView {
  invite: {
    id: string;
    token: string;
    email: string;
    role: SaaSInviteTokenData['role'];
    inviteStatus: SaaSInviteTokenData['status'];
    canAccept: boolean;
    expiresAt: string | null;
    acceptedAt: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
  } | null;
  viewer: {
    state: InviteAcceptanceViewerState;
    userId: string | null;
    userEmail: string | null;
  };
}

export type InviteAcceptanceLiveDataResult<T> =
  | {
      state: Extract<ViewState, 'ready'>;
      data: T;
    }
  | {
      state: Extract<ViewState, 'empty'>;
      data: null;
      message: string;
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

export interface InviteAcceptanceMembershipRepository {
  findMembership(input: { orgId: string; userId: string }): Promise<{ id: string } | null>;
}

export interface InviteAcceptanceLiveDataDependencies {
  auth?: () => Promise<RouteAuthResult>;
  inviteRepository?: InviteTokenDataRepository;
  membershipRepository?: InviteAcceptanceMembershipRepository;
  createQueryClient?: () => InviteTokenQueryClient & InviteAcceptanceMembershipQueryClient;
  now?: Date;
}

interface InviteAcceptanceMembershipQueryBuilder {
  select(columns: string): InviteAcceptanceMembershipQueryBuilder;
  eq(column: string, value: unknown): InviteAcceptanceMembershipQueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: { message?: string } | null }>;
}

interface InviteAcceptanceMembershipQueryClient {
  from(table: string): InviteAcceptanceMembershipQueryBuilder;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function buildQueryClient(
  deps: InviteAcceptanceLiveDataDependencies
): InviteTokenQueryClient & InviteAcceptanceMembershipQueryClient {
  return deps.createQueryClient
    ? deps.createQueryClient()
    : (createUntypedAdminClient() as unknown as InviteTokenQueryClient &
        InviteAcceptanceMembershipQueryClient);
}

function getInviteRepository(
  deps: InviteAcceptanceLiveDataDependencies
): InviteTokenDataRepository {
  return deps.inviteRepository ?? createInviteTokenDataRepository(buildQueryClient(deps));
}

export function createInviteAcceptanceMembershipRepository(
  client: InviteAcceptanceMembershipQueryClient
): InviteAcceptanceMembershipRepository {
  return {
    async findMembership(input) {
      const { data, error } = await client
        .from('organization_members')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('user_id', input.userId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Failed to load organization membership.');
      }

      if (!isRecord(data)) {
        return null;
      }

      const id = stringOrNull(data.id);
      return id ? { id } : null;
    },
  };
}

function getMembershipRepository(
  deps: InviteAcceptanceLiveDataDependencies
): InviteAcceptanceMembershipRepository {
  return (
    deps.membershipRepository ??
    createInviteAcceptanceMembershipRepository(buildQueryClient(deps))
  );
}

async function getOptionalAuth(
  deps: InviteAcceptanceLiveDataDependencies
): Promise<RouteAuthResult> {
  try {
    return await (deps.auth ?? requireRouteAuth)();
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
      isAdmin: false,
    };
  }
}

function emailMatchesInvite(invite: SaaSInviteTokenData, userEmail: string | null): boolean {
  return normalizeEmail(invite.email) === normalizeEmail(userEmail);
}

async function resolveViewerState(input: {
  invite: SaaSInviteTokenData;
  auth: RouteAuthResult;
  membershipRepository: InviteAcceptanceMembershipRepository;
}): Promise<InviteAcceptanceViewerState> {
  const { invite, auth, membershipRepository } = input;

  if (invite.status === 'accepted') {
    return 'already_member';
  }

  if (!auth.ok || !auth.userId || !auth.userEmail) {
    return 'needs_login';
  }

  if (!emailMatchesInvite(invite, auth.userEmail)) {
    return 'email_mismatch';
  }

  const membership = await membershipRepository.findMembership({
    orgId: invite.orgId,
    userId: auth.userId,
  });

  if (membership) {
    return 'already_member';
  }

  return invite.canAccept ? 'can_accept' : 'needs_login';
}

function buildInviteAcceptanceView(input: {
  invite: SaaSInviteTokenData;
  auth: RouteAuthResult;
  viewerState: InviteAcceptanceViewerState;
}): InviteAcceptanceView {
  const { invite, auth, viewerState } = input;

  return {
    invite: {
      id: invite.id,
      token: invite.token,
      email: invite.email,
      role: invite.role,
      inviteStatus: invite.status,
      canAccept: invite.canAccept,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
    },
    organization: invite.organization,
    viewer: {
      state: viewerState,
      userId: auth.ok ? auth.userId ?? null : null,
      userEmail: auth.ok ? auth.userEmail ?? null : null,
    },
  };
}

export async function loadInviteAcceptanceView(
  token: string | null | undefined,
  deps: InviteAcceptanceLiveDataDependencies = {}
): Promise<InviteAcceptanceLiveDataResult<InviteAcceptanceView>> {
  try {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
      return {
        state: 'empty',
        data: null,
        message: 'Invite token is missing.',
      };
    }

    const invite = await getInviteRepository(deps).getInviteByToken({
      token: normalizedToken,
      now: deps.now,
    });

    if (!invite) {
      return {
        state: 'empty',
        data: null,
        message: 'Invite was not found.',
      };
    }

    const auth = await getOptionalAuth(deps);
    const shouldLoadMembership =
      auth.ok &&
      Boolean(auth.userId) &&
      Boolean(auth.userEmail) &&
      emailMatchesInvite(invite, auth.userEmail ?? null);
    const viewerState = await resolveViewerState({
      invite,
      auth,
      membershipRepository: shouldLoadMembership
        ? getMembershipRepository(deps)
        : {
            findMembership: async () => null,
          },
    });

    return {
      state: 'ready',
      data: buildInviteAcceptanceView({
        invite,
        auth,
        viewerState,
      }),
    };
  } catch (error) {
    return {
      state: 'error',
      data: null,
      message: error instanceof Error && error.message ? error.message : 'Failed to load invite.',
    };
  }
}
