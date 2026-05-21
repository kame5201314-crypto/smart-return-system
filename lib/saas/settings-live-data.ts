import {
  buildBillingSettingsViewInput,
  createSettingsBillingDataRepository,
  type SettingsBillingDataRepository,
  type SettingsBillingQueryClient,
} from '@/lib/saas/settings-billing-data';
import {
  buildTeamSettingsViewInput,
  createSettingsTeamDataRepository,
  type SettingsTeamDataRepository,
  type SettingsTeamQueryClient,
} from '@/lib/saas/settings-team-data';
import {
  buildUsageSettingsViewInput,
  createSettingsUsageDataRepository,
  type SettingsUsageDataRepository,
  type SettingsUsageQueryClient,
} from '@/lib/saas/settings-usage-data';
import {
  canWriteSaaSOrgData,
  getOrgContext,
  SaaSOrgContextError,
  type GetOrgContextOptions,
  type SaaSOrgContext,
} from '@/lib/saas/org-context';
import {
  buildBillingSettingsView,
  buildTeamSettingsView,
  buildUsageSettingsView,
  type BillingSettingsView,
  type GatedState,
  type TeamSettingsView,
  type UsageSettingsView,
  type ViewState,
} from '@/lib/saas/ui-backend-contracts';
import { createClient } from '@/lib/supabase/server';

type SettingsQueryClient = SettingsBillingQueryClient &
  SettingsUsageQueryClient &
  SettingsTeamQueryClient;

export interface SettingsLiveDataContext {
  orgId: string;
  role: SaaSOrgContext['role'];
  plan: SaaSOrgContext['plan'];
  orgStatus: SaaSOrgContext['orgStatus'];
  featureFlags: SaaSOrgContext['featureFlags'];
}

export type SettingsLiveDataResult<T> =
  | {
      state: Extract<ViewState, 'ready'>;
      data: T;
      context: SettingsLiveDataContext;
    }
  | {
      state: Extract<ViewState, 'empty'>;
      data: null;
      message: string;
      context: SettingsLiveDataContext;
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

export interface SettingsLiveDataDependencies {
  getContext?: (options?: GetOrgContextOptions) => Promise<SaaSOrgContext>;
  createQueryClient?: () => SettingsQueryClient | Promise<SettingsQueryClient>;
  billingRepository?: SettingsBillingDataRepository;
  usageRepository?: SettingsUsageDataRepository;
  teamRepository?: SettingsTeamDataRepository;
  now?: Date;
}

async function getSettingsQueryClient(
  deps: SettingsLiveDataDependencies
): Promise<SettingsQueryClient> {
  return deps.createQueryClient
    ? deps.createQueryClient()
    : ((await createClient()) as unknown as SettingsQueryClient);
}

function toLiveDataContext(context: SaaSOrgContext): SettingsLiveDataContext {
  return {
    orgId: context.orgId,
    role: context.role,
    plan: context.plan,
    orgStatus: context.orgStatus,
    featureFlags: context.featureFlags,
  };
}

async function loadContext(
  deps: SettingsLiveDataDependencies,
  options?: GetOrgContextOptions
): Promise<SaaSOrgContext> {
  return (deps.getContext ?? getOrgContext)(options);
}

function mapContextError(error: SaaSOrgContextError): SettingsLiveDataResult<never> {
  if (error.code === 'feature_forbidden') {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'feature_disabled',
        message: error.message,
      },
    };
  }

  if (
    error.code === 'role_forbidden' ||
    error.code === 'membership_required' ||
    error.code === 'unauthenticated'
  ) {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'role_required',
        message: error.message,
      },
    };
  }

  if (error.code === 'subscription_inactive') {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'billing_required',
        message: error.message,
      },
    };
  }

  return {
    state: 'error',
    data: null,
    message: error.message,
  };
}

function mapLiveDataError(error: unknown, fallbackMessage: string): SettingsLiveDataResult<never> {
  if (error instanceof SaaSOrgContextError) {
    return mapContextError(error);
  }

  return {
    state: 'error',
    data: null,
    message: error instanceof Error && error.message ? error.message : fallbackMessage,
  };
}

function buildTeamActions(context: SaaSOrgContext): TeamSettingsView['actions'] {
  const isManager = context.role === 'owner' || context.role === 'admin';
  const canWrite = canWriteSaaSOrgData(context);

  if (!isManager) {
    return {
      canInvite: false,
      canChangeRoles: false,
      disabledReason: 'Owner or admin role is required to manage team settings.',
    };
  }

  if (!canWrite) {
    return {
      canInvite: false,
      canChangeRoles: false,
      disabledReason: `Organization status ${context.orgStatus} does not allow team changes.`,
    };
  }

  return {
    canInvite: true,
    canChangeRoles: true,
  };
}

export async function loadBillingSettingsView(
  deps: SettingsLiveDataDependencies = {}
): Promise<SettingsLiveDataResult<BillingSettingsView>> {
  try {
    const context = await loadContext(deps, {
      requirements: {
        roles: ['owner', 'admin'],
        feature: 'billing',
      },
    });
    const repository =
      deps.billingRepository ??
      createSettingsBillingDataRepository(await getSettingsQueryClient(deps));
    const input = await buildBillingSettingsViewInput(repository, {
      orgId: context.orgId,
      actions: {
        canUpdateBilling: true,
        canCancelRenewal: true,
      },
    });
    const liveContext = toLiveDataContext(context);

    if (!input) {
      return {
        state: 'empty',
        data: null,
        message: 'No billing settings were found for this organization.',
        context: liveContext,
      };
    }

    return {
      state: 'ready',
      data: buildBillingSettingsView(input),
      context: liveContext,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load billing settings.');
  }
}

export async function loadUsageSettingsView(
  deps: SettingsLiveDataDependencies = {}
): Promise<SettingsLiveDataResult<UsageSettingsView>> {
  try {
    const context = await loadContext(deps);
    const repository =
      deps.usageRepository ??
      createSettingsUsageDataRepository(await getSettingsQueryClient(deps));
    const input = await buildUsageSettingsViewInput(repository, {
      orgId: context.orgId,
      now: deps.now,
    });
    const liveContext = toLiveDataContext(context);

    if (!input) {
      return {
        state: 'empty',
        data: null,
        message: 'No usage settings were found for this organization.',
        context: liveContext,
      };
    }

    return {
      state: 'ready',
      data: buildUsageSettingsView(input),
      context: liveContext,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load usage settings.');
  }
}

export async function loadTeamSettingsView(
  deps: SettingsLiveDataDependencies = {}
): Promise<SettingsLiveDataResult<TeamSettingsView>> {
  try {
    const context = await loadContext(deps);
    const repository =
      deps.teamRepository ??
      createSettingsTeamDataRepository(await getSettingsQueryClient(deps));
    const input = await buildTeamSettingsViewInput(repository, {
      orgId: context.orgId,
      actions: buildTeamActions(context),
      now: deps.now,
    });
    const liveContext = toLiveDataContext(context);

    if (!input) {
      return {
        state: 'empty',
        data: null,
        message: 'No team settings were found for this organization.',
        context: liveContext,
      };
    }

    return {
      state: 'ready',
      data: buildTeamSettingsView(input),
      context: liveContext,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load team settings.');
  }
}
