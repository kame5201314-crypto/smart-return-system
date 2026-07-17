import { requireRouteAuth, type RouteAuthResult } from '@/lib/auth/route-auth';
import {
  acceptSaaSInvite,
  createSaaSInviteAcceptanceRepository,
  SaaSInviteAcceptanceError,
  type SaaSInviteAcceptanceRepository,
  type SaaSInviteAcceptanceResult,
} from '@/lib/saas/invite-acceptance';
import {
  createInviteTokenDataRepository,
  type InviteTokenQueryClient,
} from '@/lib/saas/invite-token-data';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import {
  resolveSelfServiceTrialSeatLimit,
  SelfServiceTrialSeatLimitError,
} from '@/lib/saas/self-service-trial-seat-limit';

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
  const repository = createSaaSInviteAcceptanceRepository({
    inviteReader,
    rpcClient: client,
  });
  return {
    ...repository,
    async assertInviteSeatAvailable({ orgId }) {
      const { data: organization, error: organizationError } = await client
        .from('organizations')
        .select('status, plan')
        .eq('id', orgId)
        .maybeSingle();
      if (organizationError || !organization) {
        throw new SaaSInviteAcceptanceError(
          'accept_failed',
          503,
          '目前無法確認試用席次，請稍後再試。'
        );
      }

      try {
        const resolution = await resolveSelfServiceTrialSeatLimit({
          orgId,
          orgStatus: String((organization as { status?: unknown }).status || ''),
          planSeatLimit: getSaaSPlanDefinition(
            (organization as { plan?: unknown }).plan
          ).seatLimit,
          repository: {
            async hasSelfServiceTrialClaim(scopedOrgId) {
              const { data, error } = await client
                .from('saas_self_service_trial_claims')
                .select('org_id')
                .eq('org_id', scopedOrgId)
                .maybeSingle();
              if (error) throw new Error(error.message || 'Failed to load trial claim.');
              return Boolean(data);
            },
          },
        });
        if (!resolution.applies) return;

        const { count, error } = await client
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .neq('status', 'disabled');
        if (error) throw new SelfServiceTrialSeatLimitError();
        if ((count ?? 0) >= resolution.seatLimit!) {
          throw new SaaSInviteAcceptanceError(
            'seat_limit_reached',
            409,
            '試用工作區僅提供 1 個成員席次。'
          );
        }
      } catch (error) {
        if (error instanceof SaaSInviteAcceptanceError) throw error;
        if (error instanceof SelfServiceTrialSeatLimitError) {
          throw new SaaSInviteAcceptanceError(
            'accept_failed',
            503,
            '目前無法確認試用席次，請稍後再試。'
          );
        }
        throw error;
      }
    },
  };
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
