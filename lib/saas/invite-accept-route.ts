import { requireRouteAuth, type RouteAuthResult } from '@/lib/auth/route-auth';
import {
  acceptSaaSInvite,
  createSaaSInviteAcceptanceRepository,
  type SaaSInviteAcceptanceRepository,
  type SaaSInviteAcceptanceResult,
} from '@/lib/saas/invite-acceptance';
import {
  createInviteTokenDataRepository,
  type InviteTokenQueryClient,
} from '@/lib/saas/invite-token-data';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type SaaSInviteAcceptRouteErrorCode =
  | 'invalid_request'
  | 'unauthenticated';

export interface SaaSInviteAcceptRouteDependencies {
  auth?: () => Promise<RouteAuthResult>;
  repository?: SaaSInviteAcceptanceRepository;
  now?: Date;
}

export type SaaSInviteAcceptRouteResult = SaaSInviteAcceptanceResult;

export class SaaSInviteAcceptRouteError extends Error {
  constructor(
    public readonly code: SaaSInviteAcceptRouteErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SaaSInviteAcceptRouteError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTokenPayload(payload: unknown): { token: string } {
  if (!isRecord(payload)) {
    throw new SaaSInviteAcceptRouteError(
      'invalid_request',
      400,
      'Request body must be an object.'
    );
  }

  return {
    token: typeof payload.token === 'string' ? payload.token : '',
  };
}

function getInviteAcceptanceRepository(
  deps: SaaSInviteAcceptRouteDependencies
): SaaSInviteAcceptanceRepository {
  if (deps.repository) {
    return deps.repository;
  }

  const client = createUntypedAdminClient();
  const inviteReader = createInviteTokenDataRepository(client as unknown as InviteTokenQueryClient);
  return createSaaSInviteAcceptanceRepository({
    inviteReader,
    rpcClient: client,
  });
}

export async function acceptSaaSInviteFromRequest(
  payload: unknown,
  deps: SaaSInviteAcceptRouteDependencies = {}
): Promise<SaaSInviteAcceptRouteResult> {
  const input = normalizeTokenPayload(payload);
  const auth = await (deps.auth ?? requireRouteAuth)();

  if (!auth.ok || !auth.userId || !auth.userEmail) {
    throw new SaaSInviteAcceptRouteError(
      'unauthenticated',
      auth.status || 401,
      auth.error || 'Authentication required.'
    );
  }

  return acceptSaaSInvite(
    {
      token: input.token,
      userId: auth.userId,
      userEmail: auth.userEmail,
      now: deps.now,
    },
    getInviteAcceptanceRepository(deps)
  );
}
