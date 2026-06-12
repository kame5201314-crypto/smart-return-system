import {
  getSaaSPlanDefinition,
  normalizeSaaSPlanCode,
  type SaaSPlanCode,
} from '@/lib/config/saas-plans';
import type {
  PlatformBillingEventSummary,
  PlatformOrgDetail,
  PlatformOrgSummary,
  PlatformOrgSubscriptionSnapshot,
} from '@/lib/saas/platform-admin-data';
import { resolveSaaSReturnUsagePolicy } from '@/lib/saas/return-usage-policy';
import { resolveSaaSTeamSeatUsage } from '@/lib/saas/team-limits';

export type ViewState = 'loading' | 'ready' | 'empty' | 'error' | 'gated';

export type GatedReason =
  | 'feature_disabled'
  | 'plan_required'
  | 'role_required'
  | 'billing_required'
  | 'not_configured';

export interface GatedState {
  reason: GatedReason;
  message: string;
}

export type OrgSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled';

export type BillingProvider = 'manual' | 'ecpay' | 'stripe' | 'tappay';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'failed' | 'void';
export type TeamMemberRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type TeamMemberStatus = 'active' | 'invited' | 'disabled';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type UsageWarningType =
  | 'returns_80'
  | 'returns_100'
  | 'ai_80'
  | 'ai_100'
  | 'seats_full';
export type BillingEventStatus = 'received' | 'processed' | 'failed' | 'ignored';

export interface BillingSettingsView {
  org: {
    id: string;
    name: string;
    plan: SaaSPlanCode;
    status: OrgSubscriptionStatus;
  };
  subscription: {
    provider: BillingProvider | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  invoiceSummary: {
    latestInvoiceId: string | null;
    latestInvoiceStatus: InvoiceStatus | null;
    billingEmail: string | null;
    taxId: string | null;
  };
  actions: {
    canUpdateBilling: boolean;
    canCancelRenewal: boolean;
    disabledReason?: string;
  };
}

export interface BillingSettingsViewInput {
  org: {
    id: string;
    name: string;
    plan: unknown;
    status: string;
  };
  subscription: {
    provider: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  invoiceSummary: {
    latestInvoiceId: string | null;
    latestInvoiceStatus: string | null;
    billingEmail: string | null;
    taxId: string | null;
  };
  actions: BillingSettingsView['actions'];
}

export interface UsageSettingsView {
  plan: {
    code: SaaSPlanCode;
    seatLimit: number | null;
    monthlyReturnSoftLimit: number | null;
    aiMonthlyLimit: number | null;
  };
  usage: {
    seatsUsed: number;
    returnsThisMonth: number;
    aiUsedThisMonth: number;
    periodStart: string;
    periodEnd: string;
  };
  warnings: Array<{
    type: UsageWarningType;
    message: string;
  }>;
}

export interface UsageSettingsViewInput {
  plan: unknown;
  usage: UsageSettingsView['usage'];
}

export interface TeamSettingsView {
  orgId: string;
  seatLimit: number | null;
  members: Array<{
    id: string;
    email: string;
    displayName: string | null;
    role: TeamMemberRole;
    status: TeamMemberStatus;
    joinedAt: string | null;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: Exclude<TeamMemberRole, 'owner'>;
    status: InviteStatus;
    expiresAt: string;
  }>;
  actions: {
    canInvite: boolean;
    canChangeRoles: boolean;
    disabledReason?: string;
  };
}

export interface TeamSettingsViewInput {
  orgId: string;
  plan: unknown;
  members: Array<{
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    status: string;
    joinedAt: string | null;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
  }>;
  actions: TeamSettingsView['actions'];
}

export interface PlatformOrganizationListView {
  summary: PlatformOrganizationSummary;
  organizations: PlatformOrganizationListItem[];
}

export interface PlatformOrganizationSummary {
  totalOrganizations: number;
  activeOrTrialingOrganizations: number;
  pausedOrPastDueOrganizations: number;
  trialingOrganizations: number;
  estimatedActiveMrrTwd: number;
  trialPipelineMrrTwd: number;
  atRiskOrganizations: number;
  aiLimitReachedOrganizations: number;
}

export type PlatformOrganizationRiskReason =
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'returns_high'
  | 'returns_limit'
  | 'ai_high'
  | 'ai_limit'
  | 'seats_full';

export interface PlatformOrganizationHealth {
  riskLevel: 'healthy' | 'watch' | 'at_risk';
  riskReasons: PlatformOrganizationRiskReason[];
  estimatedMrrTwd: number;
  trialPipelineMrrTwd: number;
  usagePercentages: {
    seats: number | null;
    returns: number | null;
    ai: number | null;
  };
}

export interface PlatformOrganizationListItem {
  id: string;
  name: string;
  slug: string;
  plan: SaaSPlanCode;
  status: OrgSubscriptionStatus;
  ownerEmail: string | null;
  memberCount: number;
  createdAt: string;
  trialEnd: string | null;
  daysUntilTrialEnd: number | null;
  usage: PlatformOrganizationUsage;
  health: PlatformOrganizationHealth;
}

export interface PlatformOrganizationUsage {
  returnsThisMonth: number;
  aiUsedThisMonth: number;
}

export interface PlatformOrganizationDetailView {
  organization: PlatformOrganizationListItem & {
    billingEmail: string | null;
    taxId: string | null;
    featureFlags: Record<string, boolean>;
  };
  members: TeamSettingsView['members'];
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
}

export interface PlatformBillingEventsView {
  events: Array<{
    id: string;
    orgId: string;
    orgName: string | null;
    provider: BillingProvider;
    eventType: string;
    status: BillingEventStatus;
    providerEventId: string | null;
    createdAt: string;
  }>;
}

export type PlatformAtRiskAlertType =
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'trial_ending'
  | 'trial_expired'
  | 'returns_80'
  | 'returns_100'
  | 'ai_80'
  | 'ai_100'
  | 'seats_full';

export type PlatformAtRiskAlertSeverity = 'info' | 'warning' | 'critical';
export type PlatformAtRiskAlertCategory = 'billing' | 'trial' | 'quota' | 'team';

export interface PlatformAtRiskAlertsView {
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    affectedOrganizations: number;
    billingAlerts: number;
    trialAlerts: number;
    quotaAlerts: number;
    teamAlerts: number;
  };
  alerts: PlatformAtRiskAlert[];
}

export interface PlatformAtRiskAlert {
  id: string;
  orgId: string;
  orgName: string;
  ownerEmail: string | null;
  plan: SaaSPlanCode;
  status: OrgSubscriptionStatus;
  type: PlatformAtRiskAlertType;
  severity: PlatformAtRiskAlertSeverity;
  category: PlatformAtRiskAlertCategory;
  message: string;
  metric: {
    used: number;
    limit: number;
    percent: number;
  } | null;
  dueAt: string | null;
  daysUntilDue: number | null;
}

export type PlatformTrialConversionLifecycle =
  | 'trialing'
  | 'trial_ending'
  | 'trial_expired'
  | 'converted_active'
  | 'not_trial';

export interface PlatformTrialConversionView {
  summary: {
    totalOrganizations: number;
    trialingOrganizations: number;
    trialEndingSoonOrganizations: number;
    convertedActiveOrganizations: number;
    expiredTrialOrganizations: number;
    onboardingIncompleteOrganizations: number;
    conversionRatePercent: number;
  };
  organizations: PlatformTrialConversionOrganization[];
}

export interface PlatformTrialConversionOrganization {
  orgId: string;
  orgName: string;
  ownerEmail: string | null;
  plan: SaaSPlanCode;
  status: OrgSubscriptionStatus;
  lifecycleState: PlatformTrialConversionLifecycle;
  createdAt: string;
  trialEnd: string | null;
  daysUntilTrialEnd: number | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  needsFollowUp: boolean;
}

export interface PlatformAdminDashboardView {
  generatedAt: string;
  organizations: PlatformOrganizationSummary;
  atRisk: {
    summary: PlatformAtRiskAlertsView['summary'];
    topAlerts: PlatformAtRiskAlert[];
  };
  trialConversion: {
    summary: PlatformTrialConversionView['summary'];
    followUpOrganizations: PlatformTrialConversionOrganization[];
  };
  billingEvents: {
    summary: {
      totalEvents: number;
      receivedEvents: number;
      processedEvents: number;
      failedEvents: number;
      ignoredEvents: number;
    };
    recentEvents: PlatformBillingEventsView['events'];
  };
}

export type PlatformOrgUsageById = Record<string, PlatformOrganizationUsage>;
export type PlatformOrgSubscriptionsById = Record<string, PlatformOrgSubscriptionSnapshot>;

const ORG_STATUSES: readonly OrgSubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'cancelled',
];

const BILLING_PROVIDERS: readonly BillingProvider[] = ['manual', 'ecpay', 'stripe', 'tappay'];
const INVOICE_STATUSES: readonly InvoiceStatus[] = ['draft', 'issued', 'paid', 'failed', 'void'];
const TEAM_MEMBER_ROLES: readonly TeamMemberRole[] = ['owner', 'admin', 'staff', 'viewer'];
const TEAM_MEMBER_STATUSES: readonly TeamMemberStatus[] = ['active', 'invited', 'disabled'];
const INVITE_STATUSES: readonly InviteStatus[] = ['pending', 'accepted', 'expired', 'revoked'];
const BILLING_EVENT_STATUSES: readonly BillingEventStatus[] = [
  'received',
  'processed',
  'failed',
  'ignored',
];

function requireString(value: string | null | undefined, fieldName: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error(`Missing required UI backend contract field: ${fieldName}`);
  }
  return trimmed;
}

function requireUsage(
  usageByOrgId: PlatformOrgUsageById,
  orgId: string
): PlatformOrganizationUsage {
  const usage = usageByOrgId[orgId];
  if (!usage) {
    throw new Error(`Missing usage snapshot for organization: ${orgId}`);
  }
  return {
    returnsThisMonth: nonNegativeNumber(usage.returnsThisMonth, 'returnsThisMonth'),
    aiUsedThisMonth: nonNegativeNumber(usage.aiUsedThisMonth, 'aiUsedThisMonth'),
  };
}

function nonNegativeNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid non-negative number for ${fieldName}`);
  }
  return value;
}

function normalizeAllowed<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string
): T {
  if (allowedValues.includes(value as T)) {
    return value as T;
  }
  throw new Error(`Invalid ${fieldName}: ${value}`);
}

function normalizeOrgStatus(value: string): OrgSubscriptionStatus {
  return normalizeAllowed(value, ORG_STATUSES, 'organization status');
}

function normalizeBillingProvider(value: string): BillingProvider {
  return normalizeAllowed(value, BILLING_PROVIDERS, 'billing provider');
}

function normalizeInvoiceStatus(value: string): InvoiceStatus {
  return normalizeAllowed(value, INVOICE_STATUSES, 'invoice status');
}

function normalizeTeamMemberRole(value: string): TeamMemberRole {
  return normalizeAllowed(value, TEAM_MEMBER_ROLES, 'team member role');
}

function normalizeInviteRole(value: string): Exclude<TeamMemberRole, 'owner'> {
  const role = normalizeTeamMemberRole(value);
  if (role === 'owner') {
    throw new Error('Invalid invite role: owner');
  }
  return role;
}

function normalizeTeamMemberStatus(value: string): TeamMemberStatus {
  return normalizeAllowed(value, TEAM_MEMBER_STATUSES, 'team member status');
}

function normalizeInviteStatus(value: string): InviteStatus {
  return normalizeAllowed(value, INVITE_STATUSES, 'invite status');
}

function normalizeBillingEventStatus(value: string): BillingEventStatus {
  return normalizeAllowed(value, BILLING_EVENT_STATUSES, 'billing event status');
}

function requireBoolean(value: boolean | undefined, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Missing required UI backend contract field: ${fieldName}`);
  }
  return value;
}

function booleanFlagsOnly(flags: Record<string, unknown>): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(flags).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
  );
}

function buildUsageWarning(
  used: number,
  limit: number | null,
  eightyType: UsageWarningType,
  fullType: UsageWarningType,
  label: string
): UsageSettingsView['warnings'] {
  if (limit === null) {
    return [];
  }

  if (used >= limit) {
    return [
      {
        type: fullType,
        message: `${label} usage has reached the plan limit.`,
      },
    ];
  }

  if (used >= Math.ceil(limit * 0.8)) {
    return [
      {
        type: eightyType,
        message: `${label} usage has reached 80% of the plan limit.`,
      },
    ];
  }

  return [];
}

function buildReturnUsageWarning(
  used: number,
  limit: number | null
): UsageSettingsView['warnings'] {
  const policy = resolveSaaSReturnUsagePolicy({
    used,
    monthlyReturnSoftLimit: limit,
  });

  if (policy.warningType === 'returns_100') {
    return [
      {
        type: 'returns_100',
        message: 'Return usage has reached the plan soft limit.',
      },
    ];
  }

  if (policy.warningType === 'returns_80') {
    return [
      {
        type: 'returns_80',
        message: 'Return usage has reached 80% of the plan soft limit.',
      },
    ];
  }

  return [];
}

export function buildUsageSettingsView(input: UsageSettingsViewInput): UsageSettingsView {
  const plan = getSaaSPlanDefinition(input.plan);
  const seatsUsed = nonNegativeNumber(input.usage.seatsUsed, 'seatsUsed');
  const returnsThisMonth = nonNegativeNumber(
    input.usage.returnsThisMonth,
    'returnsThisMonth'
  );
  const aiUsedThisMonth = nonNegativeNumber(input.usage.aiUsedThisMonth, 'aiUsedThisMonth');

  return {
    plan: {
      code: plan.code,
      seatLimit: plan.seatLimit,
      monthlyReturnSoftLimit: plan.monthlyReturnSoftLimit,
      aiMonthlyLimit: plan.aiMonthlyLimit,
    },
    usage: {
      ...input.usage,
      seatsUsed,
      returnsThisMonth,
      aiUsedThisMonth,
    },
    warnings: [
      ...buildReturnUsageWarning(returnsThisMonth, plan.monthlyReturnSoftLimit),
      ...buildUsageWarning(
        aiUsedThisMonth,
        plan.aiMonthlyLimit,
        'ai_80',
        'ai_100',
        'AI'
      ),
      ...(plan.seatLimit !== null && seatsUsed >= plan.seatLimit
        ? [
            {
              type: 'seats_full' as const,
              message: 'Seat usage has reached the plan limit.',
            },
          ]
        : []),
    ],
  };
}

export function buildBillingSettingsView(input: BillingSettingsViewInput): BillingSettingsView {
  return {
    org: {
      id: requireString(input.org.id, 'billing.org.id'),
      name: requireString(input.org.name, 'billing.org.name'),
      plan: normalizeSaaSPlanCode(input.org.plan),
      status: normalizeOrgStatus(input.org.status),
    },
    subscription: input.subscription
      ? {
          provider: input.subscription.provider
            ? normalizeBillingProvider(input.subscription.provider)
            : null,
          currentPeriodStart: input.subscription.currentPeriodStart,
          currentPeriodEnd: input.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: requireBoolean(
            input.subscription.cancelAtPeriodEnd,
            'billing.subscription.cancelAtPeriodEnd'
          ),
        }
      : null,
    invoiceSummary: {
      latestInvoiceId: input.invoiceSummary.latestInvoiceId,
      latestInvoiceStatus: input.invoiceSummary.latestInvoiceStatus
        ? normalizeInvoiceStatus(input.invoiceSummary.latestInvoiceStatus)
        : null,
      billingEmail: input.invoiceSummary.billingEmail,
      taxId: input.invoiceSummary.taxId,
    },
    actions: {
      canUpdateBilling: requireBoolean(
        input.actions.canUpdateBilling,
        'billing.actions.canUpdateBilling'
      ),
      canCancelRenewal: requireBoolean(
        input.actions.canCancelRenewal,
        'billing.actions.canCancelRenewal'
      ),
      ...(input.actions.disabledReason ? { disabledReason: input.actions.disabledReason } : {}),
    },
  };
}

export function buildTeamSettingsView(input: TeamSettingsViewInput): TeamSettingsView {
  const plan = getSaaSPlanDefinition(input.plan);
  const members = input.members.map((member) => ({
    id: requireString(member.id, 'team.member.id'),
    email: requireString(member.email, 'team.member.email'),
    displayName: member.displayName,
    role: normalizeTeamMemberRole(member.role),
    status: normalizeTeamMemberStatus(member.status),
    joinedAt: member.joinedAt,
  }));
  const invites = input.invites.map((invite) => ({
    id: requireString(invite.id, 'team.invite.id'),
    email: requireString(invite.email, 'team.invite.email'),
    role: normalizeInviteRole(invite.role),
    status: normalizeInviteStatus(invite.status),
    expiresAt: requireString(invite.expiresAt, 'team.invite.expiresAt'),
  }));
  const seatUsage = resolveSaaSTeamSeatUsage({
    seatLimit: plan.seatLimit,
    activeMemberCount: members.filter((member) => member.status !== 'disabled').length,
    pendingInviteCount: invites.filter((invite) => invite.status === 'pending').length,
  });
  const requestedCanInvite = requireBoolean(input.actions.canInvite, 'team.actions.canInvite');
  const canInvite = requestedCanInvite && !seatUsage.isFull;

  return {
    orgId: requireString(input.orgId, 'team.orgId'),
    seatLimit: plan.seatLimit,
    members,
    invites,
    actions: {
      canInvite,
      canChangeRoles: requireBoolean(
        input.actions.canChangeRoles,
        'team.actions.canChangeRoles'
      ),
      ...(input.actions.disabledReason || (!canInvite && requestedCanInvite && seatUsage.isFull)
        ? {
            disabledReason:
              input.actions.disabledReason || 'Seat limit has been reached for this plan.',
          }
        : {}),
    },
  };
}

export function buildPlatformOrganizationListView(
  organizations: PlatformOrgSummary[],
  usageByOrgId: PlatformOrgUsageById,
  options: {
    subscriptionsByOrgId?: PlatformOrgSubscriptionsById;
    now?: Date;
  } = {}
): PlatformOrganizationListView {
  const now = options.now ?? new Date();
  const subscriptionsByOrgId = options.subscriptionsByOrgId ?? {};
  const items = organizations.map((org) =>
    buildPlatformOrganizationListItem(org, usageByOrgId, subscriptionsByOrgId[org.id], now)
  );

  return {
    summary: buildPlatformOrganizationSummary(items),
    organizations: items,
  };
}

export function buildPlatformOrganizationDetailView(
  organization: PlatformOrgDetail,
  input: {
    usageByOrgId: PlatformOrgUsageById;
    subscriptionsByOrgId?: PlatformOrgSubscriptionsById;
    recentAuditLogs: PlatformOrganizationDetailView['recentAuditLogs'];
    now?: Date;
  }
): PlatformOrganizationDetailView {
  const now = input.now ?? new Date();
  return {
    organization: {
      ...buildPlatformOrganizationListItem(
        organization,
        input.usageByOrgId,
        input.subscriptionsByOrgId?.[organization.id],
        now
      ),
      billingEmail: organization.billingEmail,
      taxId: organization.taxId,
      featureFlags: booleanFlagsOnly(organization.featureFlags),
    },
    members: organization.members.map((member) => ({
      id: requireString(member.id, 'member.id'),
      email: requireString(member.email, 'member.email'),
      displayName: null,
      role: normalizeTeamMemberRole(member.role),
      status: normalizeTeamMemberStatus(member.status),
      joinedAt: null,
    })),
    recentAuditLogs: input.recentAuditLogs.map((log) => ({
      id: requireString(log.id, 'auditLog.id'),
      action: requireString(log.action, 'auditLog.action'),
      actorEmail: log.actorEmail,
      createdAt: requireString(log.createdAt, 'auditLog.createdAt'),
    })),
  };
}

export function buildPlatformBillingEventsView(
  events: PlatformBillingEventSummary[],
  orgNamesById: Record<string, string | null> = {}
): PlatformBillingEventsView {
  return {
    events: events.map((event) => ({
      id: requireString(event.id, 'billingEvent.id'),
      orgId: requireString(event.orgId, 'billingEvent.orgId'),
      orgName: orgNamesById[event.orgId] ?? null,
      provider: normalizeBillingProvider(event.provider),
      eventType: requireString(event.eventType, 'billingEvent.eventType'),
      status: normalizeBillingEventStatus(event.status),
      providerEventId: event.providerEventId,
      createdAt: requireString(event.createdAt, 'billingEvent.createdAt'),
    })),
  };
}

export function buildPlatformAtRiskAlertsView(
  organizations: PlatformOrgSummary[],
  usageByOrgId: PlatformOrgUsageById,
  subscriptionsByOrgId: PlatformOrgSubscriptionsById = {},
  options: { now?: Date } = {}
): PlatformAtRiskAlertsView {
  const organizationItems = buildPlatformOrganizationListView(
    organizations,
    usageByOrgId,
    {
      subscriptionsByOrgId,
      now: options.now,
    }
  ).organizations;
  const now = options.now ?? new Date();
  const alerts = organizationItems.flatMap((org) =>
    buildPlatformAtRiskAlertsForOrganization(org, subscriptionsByOrgId[org.id], now)
  );

  alerts.sort(comparePlatformAtRiskAlerts);

  return {
    summary: buildPlatformAtRiskAlertSummary(alerts),
    alerts,
  };
}

export function buildPlatformTrialConversionView(
  organizations: PlatformOrgSummary[],
  subscriptionsByOrgId: PlatformOrgSubscriptionsById = {},
  options: { now?: Date } = {}
): PlatformTrialConversionView {
  const now = options.now ?? new Date();
  const items = organizations.map((org) =>
    buildPlatformTrialConversionOrganization(org, subscriptionsByOrgId[org.id], now)
  );

  items.sort(comparePlatformTrialConversionOrganizations);

  return {
    summary: buildPlatformTrialConversionSummary(items),
    organizations: items,
  };
}

export function buildPlatformAdminDashboardView(input: {
  organizations: PlatformOrgSummary[];
  usageByOrgId: PlatformOrgUsageById;
  subscriptionsByOrgId?: PlatformOrgSubscriptionsById;
  billingEvents?: PlatformBillingEventSummary[];
  billingEventOrgNamesById?: Record<string, string | null>;
  now?: Date;
  topAlertLimit?: number;
  trialFollowUpLimit?: number;
  billingEventLimit?: number;
}): PlatformAdminDashboardView {
  const now = input.now ?? new Date();
  const organizationList = buildPlatformOrganizationListView(
    input.organizations,
    input.usageByOrgId,
    {
      subscriptionsByOrgId: input.subscriptionsByOrgId,
      now,
    }
  );
  const atRisk = buildPlatformAtRiskAlertsView(
    input.organizations,
    input.usageByOrgId,
    input.subscriptionsByOrgId,
    { now }
  );
  const trialConversion = buildPlatformTrialConversionView(
    input.organizations,
    input.subscriptionsByOrgId,
    { now }
  );
  const billingEvents = buildPlatformBillingEventsView(
    input.billingEvents ?? [],
    input.billingEventOrgNamesById
  );

  return {
    generatedAt: now.toISOString(),
    organizations: organizationList.summary,
    atRisk: {
      summary: atRisk.summary,
      topAlerts: atRisk.alerts.slice(0, clampDashboardLimit(input.topAlertLimit, 5)),
    },
    trialConversion: {
      summary: trialConversion.summary,
      followUpOrganizations: trialConversion.organizations
        .filter((organization) => organization.needsFollowUp)
        .slice(0, clampDashboardLimit(input.trialFollowUpLimit, 5)),
    },
    billingEvents: {
      summary: buildPlatformBillingEventDashboardSummary(billingEvents.events),
      recentEvents: billingEvents.events.slice(0, clampDashboardLimit(input.billingEventLimit, 5)),
    },
  };
}

function clampDashboardLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 20);
}

function buildPlatformBillingEventDashboardSummary(
  events: PlatformBillingEventsView['events']
): PlatformAdminDashboardView['billingEvents']['summary'] {
  return {
    totalEvents: events.length,
    receivedEvents: events.filter((event) => event.status === 'received').length,
    processedEvents: events.filter((event) => event.status === 'processed').length,
    failedEvents: events.filter((event) => event.status === 'failed').length,
    ignoredEvents: events.filter((event) => event.status === 'ignored').length,
  };
}

function buildPlatformOrganizationListItem(
  org: PlatformOrgSummary,
  usageByOrgId: PlatformOrgUsageById,
  subscription: PlatformOrgSubscriptionSnapshot | undefined = undefined,
  now: Date = new Date()
): PlatformOrganizationListItem {
  const id = requireString(org.id, 'organization.id');
  const plan = getSaaSPlanDefinition(org.plan);
  const planCode = normalizeSaaSPlanCode(org.plan);
  const status = normalizeOrgStatus(org.status);
  const memberCount = nonNegativeNumber(org.memberCount, 'organization.memberCount');
  const usage = requireUsage(usageByOrgId, id);
  const trialEnd = status === 'trialing' ? subscription?.trialEnd ?? null : null;

  return {
    id,
    name: requireString(org.name, 'organization.name'),
    slug: requireString(org.slug, 'organization.slug'),
    plan: planCode,
    status,
    ownerEmail: org.ownerEmail,
    memberCount,
    createdAt: requireString(org.createdAt, 'organization.createdAt'),
    trialEnd,
    daysUntilTrialEnd: daysUntil(now, trialEnd),
    usage,
    health: buildPlatformOrganizationHealth({
      plan,
      status,
      memberCount,
      usage,
    }),
  };
}

const TRIAL_CONVERSION_ORDER: Record<PlatformTrialConversionLifecycle, number> = {
  trial_expired: 0,
  trial_ending: 1,
  trialing: 2,
  converted_active: 3,
  not_trial: 4,
};

function comparePlatformTrialConversionOrganizations(
  left: PlatformTrialConversionOrganization,
  right: PlatformTrialConversionOrganization
): number {
  const lifecycleDiff =
    TRIAL_CONVERSION_ORDER[left.lifecycleState] -
    TRIAL_CONVERSION_ORDER[right.lifecycleState];
  if (lifecycleDiff !== 0) {
    return lifecycleDiff;
  }

  if (left.daysUntilTrialEnd !== null && right.daysUntilTrialEnd !== null) {
    return left.daysUntilTrialEnd - right.daysUntilTrialEnd;
  }

  if (left.daysUntilTrialEnd !== null) {
    return -1;
  }

  if (right.daysUntilTrialEnd !== null) {
    return 1;
  }

  return left.orgName.localeCompare(right.orgName);
}

function buildPlatformTrialConversionSummary(
  organizations: PlatformTrialConversionOrganization[]
): PlatformTrialConversionView['summary'] {
  const convertedActiveOrganizations = organizations.filter(
    (org) => org.lifecycleState === 'converted_active'
  ).length;
  const trialingOrganizations = organizations.filter((org) =>
    org.lifecycleState === 'trialing' || org.lifecycleState === 'trial_ending'
  ).length;
  const expiredTrialOrganizations = organizations.filter(
    (org) => org.lifecycleState === 'trial_expired'
  ).length;
  const funnelOrganizations =
    convertedActiveOrganizations + trialingOrganizations + expiredTrialOrganizations;

  return {
    totalOrganizations: organizations.length,
    trialingOrganizations,
    trialEndingSoonOrganizations: organizations.filter(
      (org) => org.lifecycleState === 'trial_ending'
    ).length,
    convertedActiveOrganizations,
    expiredTrialOrganizations,
    onboardingIncompleteOrganizations: organizations.filter(
      (org) => !org.onboardingCompleted
    ).length,
    conversionRatePercent:
      funnelOrganizations > 0
        ? Math.round((convertedActiveOrganizations / funnelOrganizations) * 100)
        : 0,
  };
}

function buildPlatformTrialConversionOrganization(
  org: PlatformOrgSummary,
  subscription: PlatformOrgSubscriptionSnapshot | undefined,
  now: Date
): PlatformTrialConversionOrganization {
  const id = requireString(org.id, 'trialConversion.organization.id');
  const status = normalizeOrgStatus(org.status);
  const trialEnd = subscription?.trialEnd ?? null;
  const daysUntilTrialEnd = daysUntil(now, trialEnd);
  const lifecycleState = resolveTrialConversionLifecycle(status, daysUntilTrialEnd);
  const onboardingCompletedAt = org.onboardingCompletedAt ?? null;
  const onboardingCompleted = onboardingCompletedAt !== null;

  return {
    orgId: id,
    orgName: requireString(org.name, 'trialConversion.organization.name'),
    ownerEmail: org.ownerEmail,
    plan: normalizeSaaSPlanCode(org.plan),
    status,
    lifecycleState,
    createdAt: requireString(org.createdAt, 'trialConversion.organization.createdAt'),
    trialEnd,
    daysUntilTrialEnd,
    onboardingCompleted,
    onboardingCompletedAt,
    needsFollowUp:
      lifecycleState === 'trial_ending' ||
      lifecycleState === 'trial_expired' ||
      (status === 'trialing' && !onboardingCompleted),
  };
}

function resolveTrialConversionLifecycle(
  status: OrgSubscriptionStatus,
  daysUntilTrialEnd: number | null
): PlatformTrialConversionLifecycle {
  if (status === 'active') {
    return 'converted_active';
  }

  if (status !== 'trialing') {
    return 'not_trial';
  }

  if (daysUntilTrialEnd !== null && daysUntilTrialEnd <= 0) {
    return 'trial_expired';
  }

  if (daysUntilTrialEnd !== null && daysUntilTrialEnd <= 3) {
    return 'trial_ending';
  }

  return 'trialing';
}

const ALERT_SEVERITY_ORDER: Record<PlatformAtRiskAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function comparePlatformAtRiskAlerts(
  left: PlatformAtRiskAlert,
  right: PlatformAtRiskAlert
): number {
  const severityDiff = ALERT_SEVERITY_ORDER[left.severity] - ALERT_SEVERITY_ORDER[right.severity];
  if (severityDiff !== 0) {
    return severityDiff;
  }

  if (left.daysUntilDue !== null && right.daysUntilDue !== null) {
    return left.daysUntilDue - right.daysUntilDue;
  }

  if (left.daysUntilDue !== null) {
    return -1;
  }

  if (right.daysUntilDue !== null) {
    return 1;
  }

  return left.orgName.localeCompare(right.orgName);
}

function buildPlatformAtRiskAlertSummary(
  alerts: PlatformAtRiskAlert[]
): PlatformAtRiskAlertsView['summary'] {
  return {
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter((alert) => alert.severity === 'critical').length,
    warningAlerts: alerts.filter((alert) => alert.severity === 'warning').length,
    affectedOrganizations: new Set(alerts.map((alert) => alert.orgId)).size,
    billingAlerts: alerts.filter((alert) => alert.category === 'billing').length,
    trialAlerts: alerts.filter((alert) => alert.category === 'trial').length,
    quotaAlerts: alerts.filter((alert) => alert.category === 'quota').length,
    teamAlerts: alerts.filter((alert) => alert.category === 'team').length,
  };
}

function buildPlatformAtRiskAlertsForOrganization(
  org: PlatformOrganizationListItem,
  subscription: PlatformOrgSubscriptionSnapshot | undefined,
  now: Date
): PlatformAtRiskAlert[] {
  const alerts: PlatformAtRiskAlert[] = [];
  const usageAlertMap: Partial<
    Record<
      PlatformOrganizationRiskReason,
      Pick<
        PlatformAtRiskAlert,
        'type' | 'severity' | 'category' | 'message' | 'metric' | 'dueAt' | 'daysUntilDue'
      >
    >
  > = {
    past_due: {
      type: 'past_due',
      severity: 'critical',
      category: 'billing',
      message: 'Payment is past due. Writes, AI, and exports should remain restricted.',
      metric: null,
      dueAt: addDaysIso(subscription?.currentPeriodEnd ?? null, 7),
      daysUntilDue: daysUntil(now, addDaysIso(subscription?.currentPeriodEnd ?? null, 7)),
    },
    suspended: {
      type: 'suspended',
      severity: 'critical',
      category: 'billing',
      message: 'Organization is suspended and should be handled before data-retention deadlines.',
      metric: null,
      dueAt: null,
      daysUntilDue: null,
    },
    cancelled: {
      type: 'cancelled',
      severity: 'critical',
      category: 'billing',
      message: 'Organization is cancelled. Confirm retention and reactivation policy before support action.',
      metric: null,
      dueAt: null,
      daysUntilDue: null,
    },
    returns_high: {
      type: 'returns_80',
      severity: 'warning',
      category: 'quota',
      message: 'Return volume has reached 80% of the plan soft limit.',
      metric: buildUsageMetric(
        org.usage.returnsThisMonth,
        getSaaSPlanDefinition(org.plan).monthlyReturnSoftLimit,
        org.health.usagePercentages.returns
      ),
      dueAt: null,
      daysUntilDue: null,
    },
    returns_limit: {
      type: 'returns_100',
      severity: 'warning',
      category: 'quota',
      message: 'Return volume has reached the plan soft limit. Operations are not blocked.',
      metric: buildUsageMetric(
        org.usage.returnsThisMonth,
        getSaaSPlanDefinition(org.plan).monthlyReturnSoftLimit,
        org.health.usagePercentages.returns
      ),
      dueAt: null,
      daysUntilDue: null,
    },
    ai_high: {
      type: 'ai_80',
      severity: 'warning',
      category: 'quota',
      message: 'AI usage has reached 80% of the plan hard limit.',
      metric: buildUsageMetric(
        org.usage.aiUsedThisMonth,
        getSaaSPlanDefinition(org.plan).aiMonthlyLimit,
        org.health.usagePercentages.ai
      ),
      dueAt: null,
      daysUntilDue: null,
    },
    ai_limit: {
      type: 'ai_100',
      severity: 'critical',
      category: 'quota',
      message: 'AI usage has reached the plan hard limit. AI actions should stay blocked.',
      metric: buildUsageMetric(
        org.usage.aiUsedThisMonth,
        getSaaSPlanDefinition(org.plan).aiMonthlyLimit,
        org.health.usagePercentages.ai
      ),
      dueAt: null,
      daysUntilDue: null,
    },
    seats_full: {
      type: 'seats_full',
      severity: 'warning',
      category: 'team',
      message: 'Seat usage has reached the plan limit.',
      metric: buildUsageMetric(
        org.memberCount,
        getSaaSPlanDefinition(org.plan).seatLimit,
        org.health.usagePercentages.seats
      ),
      dueAt: null,
      daysUntilDue: null,
    },
  };

  for (const reason of org.health.riskReasons) {
    const alert = usageAlertMap[reason];
    if (!alert) {
      continue;
    }

    alerts.push(toPlatformAtRiskAlert(org, alert));
  }

  const trialAlert = buildTrialAlert(org, subscription, now);
  if (trialAlert) {
    alerts.push(trialAlert);
  }

  return alerts;
}

function toPlatformAtRiskAlert(
  org: PlatformOrganizationListItem,
  alert: Pick<
    PlatformAtRiskAlert,
    'type' | 'severity' | 'category' | 'message' | 'metric' | 'dueAt' | 'daysUntilDue'
  >
): PlatformAtRiskAlert {
  return {
    id: `${org.id}:${alert.type}`,
    orgId: org.id,
    orgName: org.name,
    ownerEmail: org.ownerEmail,
    plan: org.plan,
    status: org.status,
    ...alert,
  };
}

function buildUsageMetric(
  used: number,
  limit: number | null,
  percent: number | null
): PlatformAtRiskAlert['metric'] {
  if (limit === null || percent === null) {
    return null;
  }

  return {
    used,
    limit,
    percent,
  };
}

function buildTrialAlert(
  org: PlatformOrganizationListItem,
  subscription: PlatformOrgSubscriptionSnapshot | undefined,
  now: Date
): PlatformAtRiskAlert | null {
  if (org.status !== 'trialing' || !subscription?.trialEnd) {
    return null;
  }

  const days = daysUntil(now, subscription.trialEnd);
  if (days === null) {
    return null;
  }

  if (days <= 0) {
    return toPlatformAtRiskAlert(org, {
      type: 'trial_expired',
      severity: 'critical',
      category: 'trial',
      message: 'Trial has expired but the organization is still trialing.',
      metric: null,
      dueAt: subscription.trialEnd,
      daysUntilDue: days,
    });
  }

  if (days <= 3) {
    return toPlatformAtRiskAlert(org, {
      type: 'trial_ending',
      severity: 'warning',
      category: 'trial',
      message: 'Trial ends within 3 days. Owner outreach may be needed.',
      metric: null,
      dueAt: subscription.trialEnd,
      daysUntilDue: days,
    });
  }

  return null;
}

function toValidDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysIso(value: string | null, days: number): string | null {
  const date = toValidDate(value);
  if (!date) {
    return null;
  }

  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function daysUntil(now: Date, value: string | null): number | null {
  const date = toValidDate(value);
  if (!date) {
    return null;
  }

  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function percentageOrNull(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) {
    return null;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function pushUsageRisk(
  reasons: PlatformOrganizationRiskReason[],
  used: number,
  limit: number | null,
  highReason: PlatformOrganizationRiskReason,
  limitReason: PlatformOrganizationRiskReason
): void {
  if (limit === null || limit <= 0) {
    return;
  }

  if (used >= limit) {
    reasons.push(limitReason);
    return;
  }

  if (used >= Math.ceil(limit * 0.8)) {
    reasons.push(highReason);
  }
}

function buildPlatformOrganizationHealth(input: {
  plan: ReturnType<typeof getSaaSPlanDefinition>;
  status: OrgSubscriptionStatus;
  memberCount: number;
  usage: PlatformOrganizationUsage;
}): PlatformOrganizationHealth {
  const riskReasons: PlatformOrganizationRiskReason[] = [];

  if (input.status === 'past_due') {
    riskReasons.push('past_due');
  }

  if (input.status === 'suspended') {
    riskReasons.push('suspended');
  }

  if (input.status === 'cancelled') {
    riskReasons.push('cancelled');
  }

  pushUsageRisk(
    riskReasons,
    input.usage.returnsThisMonth,
    input.plan.monthlyReturnSoftLimit,
    'returns_high',
    'returns_limit'
  );
  pushUsageRisk(
    riskReasons,
    input.usage.aiUsedThisMonth,
    input.plan.aiMonthlyLimit,
    'ai_high',
    'ai_limit'
  );

  if (input.plan.seatLimit !== null && input.memberCount >= input.plan.seatLimit) {
    riskReasons.push('seats_full');
  }

  const isAtRisk = riskReasons.some((reason) =>
    ['past_due', 'suspended', 'cancelled', 'returns_limit', 'ai_limit', 'seats_full'].includes(reason)
  );

  return {
    riskLevel: isAtRisk ? 'at_risk' : riskReasons.length > 0 ? 'watch' : 'healthy',
    riskReasons,
    estimatedMrrTwd:
      input.status === 'active' && input.plan.monthlyPriceTwd !== null
        ? input.plan.monthlyPriceTwd
        : 0,
    trialPipelineMrrTwd:
      input.status === 'trialing' && input.plan.monthlyPriceTwd !== null
        ? input.plan.monthlyPriceTwd
        : 0,
    usagePercentages: {
      seats: percentageOrNull(input.memberCount, input.plan.seatLimit),
      returns: percentageOrNull(
        input.usage.returnsThisMonth,
        input.plan.monthlyReturnSoftLimit
      ),
      ai: percentageOrNull(input.usage.aiUsedThisMonth, input.plan.aiMonthlyLimit),
    },
  };
}

function buildPlatformOrganizationSummary(
  organizations: PlatformOrganizationListItem[]
): PlatformOrganizationSummary {
  return {
    totalOrganizations: organizations.length,
    activeOrTrialingOrganizations: organizations.filter((org) =>
      org.status === 'active' || org.status === 'trialing'
    ).length,
    pausedOrPastDueOrganizations: organizations.filter((org) =>
      org.status === 'suspended' || org.status === 'past_due'
    ).length,
    trialingOrganizations: organizations.filter((org) => org.status === 'trialing').length,
    estimatedActiveMrrTwd: organizations.reduce(
      (sum, org) => sum + org.health.estimatedMrrTwd,
      0
    ),
    trialPipelineMrrTwd: organizations.reduce(
      (sum, org) => sum + org.health.trialPipelineMrrTwd,
      0
    ),
    atRiskOrganizations: organizations.filter((org) => org.health.riskLevel === 'at_risk')
      .length,
    aiLimitReachedOrganizations: organizations.filter((org) =>
      org.health.riskReasons.includes('ai_limit')
    ).length,
  };
}
