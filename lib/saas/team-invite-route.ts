import {
  createSaaSInvite,
  createSaaSInviteCreationRepository,
  SaaSInviteCreationError,
  type SaaSInviteCreationRepository,
  type SaaSInviteCreationResult,
} from '@/lib/saas/invite-creation';
import {
  getOrgContext,
  type GetOrgContextOptions,
  type SaaSOrgContext,
} from '@/lib/saas/org-context';
import {
  createSettingsTeamDataRepository,
  type SettingsTeamDataRepository,
  type SettingsTeamQueryClient,
} from '@/lib/saas/settings-team-data';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  resolveSelfServiceTrialSeatLimit,
  SelfServiceTrialSeatLimitError,
  type SelfServiceTrialSeatLimitRepository,
} from '@/lib/saas/self-service-trial-seat-limit';

type TeamInviteQueryRepository = Pick<
  SettingsTeamDataRepository,
  'listMembers' | 'listInvites'
>;

export interface SaaSTeamInviteRouteDependencies {
  getContext?: (options?: GetOrgContextOptions) => Promise<SaaSOrgContext>;
  createQueryClient?: () => SettingsTeamQueryClient | Promise<SettingsTeamQueryClient>;
  teamRepository?: TeamInviteQueryRepository;
  inviteRepository?: SaaSInviteCreationRepository;
  trialSeatRepository?: SelfServiceTrialSeatLimitRepository;
  now?: Date;
}

export type SaaSTeamInviteRouteResult = SaaSInviteCreationResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTeamInvitePayload(payload: unknown): {
  email: string;
  role: unknown;
} {
  if (!isRecord(payload)) {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      'Request body must be an object.'
    );
  }

  return {
    email: typeof payload.email === 'string' ? payload.email : '',
    role: payload.role,
  };
}

async function getTeamRepository(
  deps: SaaSTeamInviteRouteDependencies
): Promise<TeamInviteQueryRepository> {
  if (deps.teamRepository) {
    return deps.teamRepository;
  }

  const client = deps.createQueryClient
    ? await deps.createQueryClient()
    : ((await createClient()) as unknown as SettingsTeamQueryClient);

  return createSettingsTeamDataRepository(client);
}

function getInviteRepository(
  deps: SaaSTeamInviteRouteDependencies
): SaaSInviteCreationRepository {
  return (
    deps.inviteRepository ??
    createSaaSInviteCreationRepository(createUntypedAdminClient())
  );
}

function getTrialSeatRepository(
  deps: SaaSTeamInviteRouteDependencies
): SelfServiceTrialSeatLimitRepository {
  if (deps.trialSeatRepository) return deps.trialSeatRepository;
  return {
    async hasSelfServiceTrialClaim(orgId) {
      const client = createUntypedAdminClient();
      const { data, error } = await client
        .from('saas_self_service_trial_claims')
        .select('org_id')
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw new Error(error.message || 'Failed to load trial claim.');
      return Boolean(data);
    },
  };
}

function assertCanInviteRole(context: SaaSOrgContext, role: unknown): void {
  if (context.role === 'admin' && role === 'admin') {
    throw new SaaSInviteCreationError(
      'role_forbidden',
      403,
      'Admins can invite staff or viewer users only.'
    );
  }
}

export async function createSaaSTeamInviteFromRequest(
  payload: unknown,
  deps: SaaSTeamInviteRouteDependencies = {}
): Promise<SaaSTeamInviteRouteResult> {
  const input = normalizeTeamInvitePayload(payload);
  const context = await (deps.getContext ?? getOrgContext)({
    requirements: {
      roles: ['owner', 'admin'],
      writable: true,
    },
  });
  assertCanInviteRole(context, input.role);
  const now = deps.now ?? new Date();
  const teamRepository = await getTeamRepository(deps);
  const [members, invites] = await Promise.all([
    teamRepository.listMembers({
      orgId: context.orgId,
    }),
    teamRepository.listInvites({
      orgId: context.orgId,
      now,
    }),
  ]);

  let seatLimit: number | null;
  try {
    const resolution = await resolveSelfServiceTrialSeatLimit({
      orgId: context.orgId,
      orgStatus: context.orgStatus,
      planSeatLimit: context.planDefinition.seatLimit,
      repository: getTrialSeatRepository(deps),
    });
    seatLimit = resolution.seatLimit;
  } catch (error) {
    if (error instanceof SelfServiceTrialSeatLimitError) {
      throw new SaaSInviteCreationError(
        'create_failed',
        503,
        '目前無法確認試用席次，請稍後再試。'
      );
    }
    throw error;
  }

  return createSaaSInvite(
    {
      orgId: context.orgId,
      email: input.email,
      role: input.role,
      invitedBy: context.userId,
      seatLimit,
      activeMemberCount: members.filter((member) => member.status !== 'disabled').length,
      pendingInviteCount: invites.filter((invite) => invite.status === 'pending').length,
      now,
    },
    getInviteRepository(deps)
  );
}
