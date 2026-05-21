import {
  getSaaSPlanDefinition,
  normalizeSaaSPlanCode,
  type SaaSPlanCode,
} from '@/lib/config/saas-plans';
import type {
  PlatformBillingEventSummary,
  PlatformOrgDetail,
  PlatformOrgSummary,
} from '@/lib/saas/platform-admin-data';

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
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';
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

export interface PlatformOrganizationListView {
  organizations: PlatformOrganizationListItem[];
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
  usage: PlatformOrganizationUsage;
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

export type PlatformOrgUsageById = Record<string, PlatformOrganizationUsage>;

const ORG_STATUSES: readonly OrgSubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'suspended',
  'cancelled',
];

const BILLING_PROVIDERS: readonly BillingProvider[] = ['manual', 'ecpay', 'stripe', 'tappay'];
const TEAM_MEMBER_ROLES: readonly TeamMemberRole[] = ['owner', 'admin', 'staff', 'viewer'];
const TEAM_MEMBER_STATUSES: readonly TeamMemberStatus[] = ['active', 'invited', 'disabled'];
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

function normalizeTeamMemberRole(value: string): TeamMemberRole {
  return normalizeAllowed(value, TEAM_MEMBER_ROLES, 'team member role');
}

function normalizeTeamMemberStatus(value: string): TeamMemberStatus {
  return normalizeAllowed(value, TEAM_MEMBER_STATUSES, 'team member status');
}

function normalizeBillingEventStatus(value: string): BillingEventStatus {
  return normalizeAllowed(value, BILLING_EVENT_STATUSES, 'billing event status');
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

export function buildUsageSettingsView(input: {
  plan: unknown;
  usage: UsageSettingsView['usage'];
}): UsageSettingsView {
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
      ...buildUsageWarning(
        returnsThisMonth,
        plan.monthlyReturnSoftLimit,
        'returns_80',
        'returns_100',
        'Return'
      ),
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

export function buildPlatformOrganizationListView(
  organizations: PlatformOrgSummary[],
  usageByOrgId: PlatformOrgUsageById
): PlatformOrganizationListView {
  return {
    organizations: organizations.map((org) => buildPlatformOrganizationListItem(org, usageByOrgId)),
  };
}

export function buildPlatformOrganizationDetailView(
  organization: PlatformOrgDetail,
  input: {
    usageByOrgId: PlatformOrgUsageById;
    recentAuditLogs: PlatformOrganizationDetailView['recentAuditLogs'];
  }
): PlatformOrganizationDetailView {
  return {
    organization: {
      ...buildPlatformOrganizationListItem(organization, input.usageByOrgId),
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

function buildPlatformOrganizationListItem(
  org: PlatformOrgSummary,
  usageByOrgId: PlatformOrgUsageById
): PlatformOrganizationListItem {
  const id = requireString(org.id, 'organization.id');

  return {
    id,
    name: requireString(org.name, 'organization.name'),
    slug: requireString(org.slug, 'organization.slug'),
    plan: normalizeSaaSPlanCode(org.plan),
    status: normalizeOrgStatus(org.status),
    ownerEmail: org.ownerEmail,
    memberCount: nonNegativeNumber(org.memberCount, 'organization.memberCount'),
    createdAt: requireString(org.createdAt, 'organization.createdAt'),
    usage: requireUsage(usageByOrgId, id),
  };
}
