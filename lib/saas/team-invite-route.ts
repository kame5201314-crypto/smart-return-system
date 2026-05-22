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

type TeamInviteQueryRepository = Pick<
  SettingsTeamDataRepository,
  'listMembers' | 'listInvites'
>;

export interface SaaSTeamInviteRouteDependencies {
  getContext?: (options?: GetOrgContextOptions) => Promise<SaaSOrgContext>;
  createQueryClient?: () => SettingsTeamQueryClient | Promise<SettingsTeamQueryClient>;
  teamRepository?: TeamInviteQueryRepository;
  inviteRepository?: SaaSInviteCreationRepository;
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

  return createSaaSInvite(
    {
      orgId: context.orgId,
      email: input.email,
      role: input.role,
      invitedBy: context.userId,
      seatLimit: context.planDefinition.seatLimit,
      activeMemberCount: members.filter((member) => member.status !== 'disabled').length,
      pendingInviteCount: invites.filter((invite) => invite.status === 'pending').length,
      now,
    },
    getInviteRepository(deps)
  );
}
