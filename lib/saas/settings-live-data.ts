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
import {
  resolveSelfServiceTrialSeatLimit,
  type SelfServiceTrialSeatLimitRepository,
  type SelfServiceTrialSeatLimitResolution,
} from '@/lib/saas/self-service-trial-seat-limit';
import { createDefaultSelfServiceTrialSeatLimitDataRepository } from '@/lib/saas/self-service-trial-seat-limit-data';
import { getSaaSSubscriptionAccessPolicy } from '@/lib/saas/subscription-access';

type SettingsQueryClient = SettingsBillingQueryClient &
  SettingsUsageQueryClient &
  SettingsTeamQueryClient;

const BILLING_FEATURE_DISABLED_MESSAGE =
  '線上帳務與自助付款目前尚未開放，請稍後再試。';
const BILLING_ROLE_REQUIRED_MESSAGE =
  '需要商家擁有者或管理員權限才能查看帳務設定。';
const BILLING_REQUIRED_MESSAGE =
  '目前訂閱狀態無法使用帳務設定，請重新整理並確認目前方案狀態。';
const BILLING_EMPTY_MESSAGE =
  '目前找不到帳務資料，請重新整理後再試。';
const BILLING_LOAD_ERROR_MESSAGE =
  '帳務資料暫時無法載入，請稍後再試。';
const BILLING_PLATFORM_SUSPENSION_MESSAGE =
  '此工作區已由平台管理員停權，暫時無法線上付款；請由平台管理員解除停權後再試。';

export interface SettingsLiveDataContext {
  orgId: string;
  role: SaaSOrgContext['role'];
  plan: SaaSOrgContext['plan'];
  orgStatus: SaaSOrgContext['orgStatus'];
  suspensionSource: SaaSOrgContext['suspensionSource'];
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
  trialSeatRepository?: SelfServiceTrialSeatLimitRepository;
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
    suspensionSource: context.suspensionSource,
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

function mapBillingContextError(
  error: SaaSOrgContextError
): SettingsLiveDataResult<never> {
  if (error.code === 'feature_forbidden') {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'feature_disabled',
        message: BILLING_FEATURE_DISABLED_MESSAGE,
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
        message: BILLING_ROLE_REQUIRED_MESSAGE,
      },
    };
  }

  if (error.code === 'subscription_inactive') {
    return {
      state: 'gated',
      data: null,
      gated: {
        reason: 'billing_required',
        message: BILLING_REQUIRED_MESSAGE,
      },
    };
  }

  return {
    state: 'error',
    data: null,
    message: BILLING_LOAD_ERROR_MESSAGE,
  };
}

function buildTeamActions(
  context: SaaSOrgContext,
  selfServiceTrialSeatLimitApplies = false
): TeamSettingsView['actions'] {
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

  if (selfServiceTrialSeatLimitApplies) {
    return {
      canInvite: false,
      canChangeRoles: true,
      disabledReason: 'Beta trial workspaces support one member only.',
    };
  }

  return {
    canInvite: true,
    canChangeRoles: true,
  };
}

async function resolveTeamSeatLimit(
  context: SaaSOrgContext,
  deps: SettingsLiveDataDependencies
): Promise<SelfServiceTrialSeatLimitResolution> {
  if (context.orgStatus !== 'trialing') {
    return { applies: false, seatLimit: context.planDefinition.seatLimit };
  }

  const repository =
    deps.trialSeatRepository ?? createDefaultSelfServiceTrialSeatLimitDataRepository();

  return resolveSelfServiceTrialSeatLimit({
    orgId: context.orgId,
    orgStatus: context.orgStatus,
    planSeatLimit: context.planDefinition.seatLimit,
    repository,
  });
}

export async function loadBillingSettingsView(
  deps: SettingsLiveDataDependencies = {}
): Promise<SettingsLiveDataResult<BillingSettingsView>> {
  try {
    const context = await loadContext(deps, {
      requirements: {
        roles: ['owner', 'admin'],
      },
    });
    const repository =
      deps.billingRepository ??
      createSettingsBillingDataRepository(await getSettingsQueryClient(deps));
    const billingAccess = getSaaSSubscriptionAccessPolicy(context.orgStatus);
    const selfServiceBillingEnabled =
      context.featureFlags.billing && context.featureFlags.subscription_plan;
    const suspensionSource =
      context.orgStatus === 'suspended' && !context.suspensionSource
        ? await repository.getSuspensionSource?.({ orgId: context.orgId }) ?? null
        : context.suspensionSource;
    const platformSuspensionBlocksCheckout =
      context.orgStatus === 'suspended'
      && suspensionSource !== 'trial_expired'
      && suspensionSource !== 'billing';
    const canManageBilling =
      selfServiceBillingEnabled
      && billingAccess.canManageBilling
      && !platformSuspensionBlocksCheckout;
    const input = await buildBillingSettingsViewInput(repository, {
      orgId: context.orgId,
      suspensionSource,
      actions: {
        canUpdateBilling: canManageBilling,
        canCancelRenewal: canManageBilling,
        disabledReason: !selfServiceBillingEnabled
          ? BILLING_FEATURE_DISABLED_MESSAGE
          : platformSuspensionBlocksCheckout
            ? BILLING_PLATFORM_SUSPENSION_MESSAGE
          : !billingAccess.canManageBilling
            ? BILLING_REQUIRED_MESSAGE
            : undefined,
      },
    });
    const liveContext = toLiveDataContext({
      ...context,
      suspensionSource,
    });

    if (!input) {
      return {
        state: 'empty',
        data: null,
        message: BILLING_EMPTY_MESSAGE,
        context: liveContext,
      };
    }

    return {
      state: 'ready',
      data: buildBillingSettingsView(input),
      context: liveContext,
    };
  } catch (error) {
    if (error instanceof SaaSOrgContextError) {
      return mapBillingContextError(error);
    }

    return {
      state: 'error',
      data: null,
      message: BILLING_LOAD_ERROR_MESSAGE,
    };
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
    const seatLimitResolution = await resolveTeamSeatLimit(context, deps);
    const input = await buildTeamSettingsViewInput(repository, {
      orgId: context.orgId,
      seatLimitOverride: seatLimitResolution.applies
        ? seatLimitResolution.seatLimit ?? undefined
        : undefined,
      actions: buildTeamActions(context, seatLimitResolution.applies),
      actor: {
        userId: context.userId,
        role: context.role,
      },
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
