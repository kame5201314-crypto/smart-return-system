import {
  createPlatformAdminDataRepository,
  type PlatformAdminDataRepository,
  type PlatformAdminQueryClient,
} from '@/lib/saas/platform-admin-data';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import {
  buildPlatformAtRiskAlertsView,
  buildPlatformBillingEventsView,
  buildPlatformOrganizationDetailView,
  buildPlatformOrganizationListView,
  buildPlatformTrialConversionView,
  type GatedState,
  type PlatformAtRiskAlertsView,
  type PlatformBillingEventsView,
  type PlatformOrganizationDetailView,
  type PlatformOrganizationListView,
  type PlatformTrialConversionView,
  type ViewState,
} from '@/lib/saas/ui-backend-contracts';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { PlatformAdminPermission } from '@/lib/saas/platform-admin-roles';

export interface PlatformAdminLiveDataContext {
  userId: string;
  userEmail?: string;
  isPlatformAdmin: true;
  platformRole: PlatformAdminContext['platformRole'];
  permissions: PlatformAdminContext['permissions'];
  featureFlags: PlatformAdminContext['featureFlags'];
}

export type PlatformAdminLiveDataResult<T> =
  | {
      state: Extract<ViewState, 'ready'>;
      data: T;
      context: PlatformAdminLiveDataContext;
    }
  | {
      state: Extract<ViewState, 'empty'>;
      data: null;
      message: string;
      context: PlatformAdminLiveDataContext;
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

export interface PlatformAdminLiveDataDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  createQueryClient?: () => PlatformAdminQueryClient;
  repository?: PlatformAdminDataRepository;
  now?: Date;
}

export interface LoadPlatformOrganizationsOptions extends PlatformAdminLiveDataDependencies {
  limit?: number;
}

export interface LoadPlatformBillingEventsOptions extends PlatformAdminLiveDataDependencies {
  limit?: number;
}

export interface LoadPlatformAtRiskAlertsOptions extends PlatformAdminLiveDataDependencies {
  limit?: number;
}

export interface LoadPlatformTrialConversionOptions extends PlatformAdminLiveDataDependencies {
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_DETAIL_AUDIT_LIMIT = 20;

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 100);
}

function getCurrentMonthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function toLiveDataContext(context: PlatformAdminContext): PlatformAdminLiveDataContext {
  return {
    userId: context.userId,
    userEmail: context.userEmail,
    isPlatformAdmin: true,
    platformRole: context.platformRole,
    permissions: context.permissions,
    featureFlags: context.featureFlags,
  };
}

async function loadAccess(
  deps: PlatformAdminLiveDataDependencies,
  requiredPermission?: PlatformAdminPermission
): Promise<PlatformAdminContext> {
  return (deps.requireAccess ?? (() => requirePlatformAdminAccess({
    requiredPermission,
  })))();
}

function getRepository(deps: PlatformAdminLiveDataDependencies): PlatformAdminDataRepository {
  return deps.repository ?? createPlatformAdminDataRepository(
    deps.createQueryClient
      ? deps.createQueryClient()
      : (createUntypedAdminClient() as unknown as PlatformAdminQueryClient)
  );
}

function normalizeOrgId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapAccessError(error: PlatformAdminAccessError): PlatformAdminLiveDataResult<never> {
  return {
    state: 'gated',
    data: null,
    gated: {
      reason: error.code === 'feature_disabled' ? 'feature_disabled' : 'role_required',
      message: error.message,
    },
  };
}

function mapLiveDataError(
  error: unknown,
  fallbackMessage: string
): PlatformAdminLiveDataResult<never> {
  if (error instanceof PlatformAdminAccessError) {
    return mapAccessError(error);
  }

  return {
    state: 'error',
    data: null,
    message: error instanceof Error && error.message ? error.message : fallbackMessage,
  };
}

export async function loadPlatformOrganizationsView(
  options: LoadPlatformOrganizationsOptions = {}
): Promise<PlatformAdminLiveDataResult<PlatformOrganizationListView>> {
  try {
    const access = await loadAccess(options, 'view_organizations');
    const context = toLiveDataContext(access);
    const repository = getRepository(options);
    const organizations = await repository.listOrganizations({
      limit: clampLimit(options.limit),
    });

    if (organizations.length === 0) {
      return {
        state: 'empty',
        data: null,
        message: 'No platform organizations were found.',
        context,
      };
    }

    const usageByOrgId = await repository.listOrganizationUsage({
      orgIds: organizations.map((org) => org.id),
      periodStart: getCurrentMonthStartIso(options.now),
    });

    return {
      state: 'ready',
      data: buildPlatformOrganizationListView(organizations, usageByOrgId),
      context,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load platform organizations.');
  }
}

export async function loadPlatformOrganizationDetailView(
  orgId: string | null | undefined,
  deps: PlatformAdminLiveDataDependencies = {}
): Promise<PlatformAdminLiveDataResult<PlatformOrganizationDetailView>> {
  try {
    const access = await loadAccess(deps, 'view_organizations');
    const context = toLiveDataContext(access);
    const normalizedOrgId = normalizeOrgId(orgId);

    if (!normalizedOrgId) {
      return {
        state: 'empty',
        data: null,
        message: 'A valid organization id is required.',
        context,
      };
    }

    const repository = getRepository(deps);
    const organization = await repository.getOrganization({
      orgId: normalizedOrgId,
    });

    if (!organization) {
      return {
        state: 'empty',
        data: null,
        message: 'Organization not found.',
        context,
      };
    }

    const [usageByOrgId, recentAuditLogs] = await Promise.all([
      repository.listOrganizationUsage({
        orgIds: [organization.id],
        periodStart: getCurrentMonthStartIso(deps.now),
      }),
      repository.listAuditLogs({
        orgId: organization.id,
        limit: DEFAULT_DETAIL_AUDIT_LIMIT,
      }),
    ]);

    return {
      state: 'ready',
      data: buildPlatformOrganizationDetailView(organization, {
        usageByOrgId,
        recentAuditLogs,
      }),
      context,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load platform organization detail.');
  }
}

export async function loadPlatformBillingEventsView(
  options: LoadPlatformBillingEventsOptions = {}
): Promise<PlatformAdminLiveDataResult<PlatformBillingEventsView>> {
  try {
    const access = await loadAccess(options, 'view_billing_events');
    const context = toLiveDataContext(access);
    const repository = getRepository(options);
    const events = await repository.listBillingEvents({
      limit: clampLimit(options.limit),
    });

    if (events.length === 0) {
      return {
        state: 'empty',
        data: null,
        message: 'No platform billing events were found.',
        context,
      };
    }

    const orgNamesById = await repository.listOrganizationNames({
      orgIds: Array.from(new Set(events.map((event) => event.orgId))),
    });

    return {
      state: 'ready',
      data: buildPlatformBillingEventsView(events, orgNamesById),
      context,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load platform billing events.');
  }
}

export async function loadPlatformAtRiskAlertsView(
  options: LoadPlatformAtRiskAlertsOptions = {}
): Promise<PlatformAdminLiveDataResult<PlatformAtRiskAlertsView>> {
  try {
    const access = await loadAccess(options, 'view_organizations');
    const context = toLiveDataContext(access);
    const repository = getRepository(options);
    const organizations = await repository.listOrganizations({
      limit: clampLimit(options.limit),
    });

    if (organizations.length === 0) {
      return {
        state: 'empty',
        data: null,
        message: 'No platform organizations were found.',
        context,
      };
    }

    const orgIds = organizations.map((org) => org.id);
    const [usageByOrgId, subscriptionsByOrgId] = await Promise.all([
      repository.listOrganizationUsage({
        orgIds,
        periodStart: getCurrentMonthStartIso(options.now),
      }),
      repository.listOrganizationSubscriptions({
        orgIds,
      }),
    ]);

    return {
      state: 'ready',
      data: buildPlatformAtRiskAlertsView(
        organizations,
        usageByOrgId,
        subscriptionsByOrgId,
        { now: options.now }
      ),
      context,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load platform at-risk alerts.');
  }
}

export async function loadPlatformTrialConversionView(
  options: LoadPlatformTrialConversionOptions = {}
): Promise<PlatformAdminLiveDataResult<PlatformTrialConversionView>> {
  try {
    const access = await loadAccess(options, 'view_organizations');
    const context = toLiveDataContext(access);
    const repository = getRepository(options);
    const organizations = await repository.listOrganizations({
      limit: clampLimit(options.limit),
    });

    if (organizations.length === 0) {
      return {
        state: 'empty',
        data: null,
        message: 'No platform organizations were found.',
        context,
      };
    }

    const subscriptionsByOrgId = await repository.listOrganizationSubscriptions({
      orgIds: organizations.map((org) => org.id),
    });

    return {
      state: 'ready',
      data: buildPlatformTrialConversionView(organizations, subscriptionsByOrgId, {
        now: options.now,
      }),
      context,
    };
  } catch (error) {
    return mapLiveDataError(error, 'Failed to load platform trial conversion.');
  }
}
