# UI / Backend Contracts

This file defines the data shapes Claude UI may mock and Codex should later wire to real backend data.

No API is implied by this file yet. These are contracts for handoff and implementation planning.

## Common UI State

Every backend-wired page should support:

```ts
type ViewState = 'loading' | 'ready' | 'empty' | 'error' | 'gated';

interface GatedState {
  reason:
    | 'feature_disabled'
    | 'plan_required'
    | 'role_required'
    | 'billing_required'
    | 'not_configured';
  message: string;
}
```

## Settings Billing

UI path:

```text
app/(admin)/settings/billing/page.tsx
```

Backend owner: Codex.

```ts
interface BillingSettingsView {
  org: {
    id: string;
    name: string;
    plan: 'basic' | 'growth' | 'pro' | 'enterprise';
    status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  };
  subscription: {
    provider: 'manual' | 'ecpay' | 'stripe' | 'tappay' | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  invoiceSummary: {
    latestInvoiceId: string | null;
    latestInvoiceStatus: 'draft' | 'issued' | 'paid' | 'failed' | 'void' | null;
    billingEmail: string | null;
    taxId: string | null;
  };
  actions: {
    canUpdateBilling: boolean;
    canCancelRenewal: boolean;
    disabledReason?: string;
  };
}
```

## Settings Usage

UI path:

```text
app/(admin)/settings/usage/page.tsx
```

Backend owner: Codex.

```ts
interface UsageSettingsView {
  plan: {
    code: 'basic' | 'growth' | 'pro' | 'enterprise';
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
    type: 'returns_80' | 'returns_100' | 'ai_80' | 'ai_100' | 'seats_full';
    message: string;
  }>;
}
```

Return volume warnings are soft-limit signals only. UI may show `returns_80`
or `returns_100`, but return creation and daily operations must not be blocked
by return count. Consecutive monthly overage upgrade suggestions are computed
by Codex-owned backend policy, not UI state.

## Settings Team

UI path:

```text
app/(admin)/settings/team/page.tsx
```

Backend owner: Codex.

```ts
interface TeamSettingsView {
  orgId: string;
  seatLimit: number | null;
  members: Array<{
    id: string;
    email: string;
    displayName: string | null;
    role: 'owner' | 'admin' | 'staff' | 'viewer';
    status: 'active' | 'invited' | 'disabled';
    joinedAt: string | null;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: 'admin' | 'staff' | 'viewer';
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    expiresAt: string;
  }>;
  actions: {
    canInvite: boolean;
    canChangeRoles: boolean;
    disabledReason?: string;
  };
}
```

Invite creation backend foundation:

```text
lib/saas/invite-creation.ts
supabase/migrations/032_saas_invite_creation_rpc.sql
```

Codex owns:

- `createSaaSInvite()`
- `createSaaSInviteCreationRepository()`
- `generateSaaSInviteToken()`
- `buildCreateOrganizationInviteRpcArgs()`

Team invite UI should call the Codex-owned server route below. The service
validates email, role, seat availability, token, and expiration before the
`create_organization_invite` RPC write. Email sending remains unwired.

Team invite API foundation:

```text
POST /api/saas/team/invites
```

Request:

```ts
{
  email: string;
  role: 'admin' | 'staff' | 'viewer';
}
```

Success response:

```ts
{
  success: true;
  data: {
    created: true;
    inviteId: string;
    orgId: string;
    email: string;
    role: 'admin' | 'staff' | 'viewer';
    token: string;
    expiresAt: string;
    createdAt: string;
  };
}
```

Backend rules:

- Requires authenticated SaaS org context.
- Requires owner/admin role and writable subscription status.
- Counts active/non-disabled members plus pending invites before write.
- Rejects owner/member invite roles.
- Uses the `create_organization_invite` RPC through the invite creation service.
- Does not send email; Claude UI may show/copy the returned invite token/link after user action.

## Platform Organization List

UI path:

```text
app/internal/orgs/page.tsx
```

Backend owner: Codex.

```ts
interface PlatformOrganizationListView {
  summary: {
    totalOrganizations: number;
    activeOrTrialingOrganizations: number;
    pausedOrPastDueOrganizations: number;
    trialingOrganizations: number;
    estimatedActiveMrrTwd: number;
    trialPipelineMrrTwd: number;
    atRiskOrganizations: number;
    aiLimitReachedOrganizations: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    plan: 'basic' | 'growth' | 'pro' | 'enterprise';
    status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
    ownerEmail: string | null;
    memberCount: number;
    createdAt: string;
    usage: {
      returnsThisMonth: number;
      aiUsedThisMonth: number;
    };
    health: {
      riskLevel: 'healthy' | 'watch' | 'at_risk';
      riskReasons: Array<
        | 'past_due'
        | 'suspended'
        | 'cancelled'
        | 'returns_high'
        | 'returns_limit'
        | 'ai_high'
        | 'ai_limit'
        | 'seats_full'
      >;
      estimatedMrrTwd: number;
      trialPipelineMrrTwd: number;
      usagePercentages: {
        seats: number | null;
        returns: number | null;
        ai: number | null;
      };
    };
  }>;
}
```

## Platform At-Risk Alerts

UI path:

```text
future platform admin alert surface under app/internal/**
```

Backend owner: Codex.

```ts
interface PlatformAtRiskAlertsView {
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
  alerts: Array<{
    id: string;
    orgId: string;
    orgName: string;
    ownerEmail: string | null;
    plan: 'basic' | 'growth' | 'pro' | 'enterprise';
    status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
    type:
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
    severity: 'info' | 'warning' | 'critical';
    category: 'billing' | 'trial' | 'quota' | 'team';
    message: string;
    metric: {
      used: number;
      limit: number;
      percent: number;
    } | null;
    dueAt: string | null;
    daysUntilDue: number | null;
  }>;
}
```

Rules:

- Derived from organizations, monthly return usage, monthly non-cached successful AI usage, seats, and subscription `trial_end` / `current_period_end`.
- Uses the existing platform admin auth and `multi_tenant_admin` feature flag gate.
- Read-only only. It does not suspend orgs, retry billing, send email, apply migrations, or change subscriptions.
- Return limit alerts are soft-limit signals; operations are not blocked by return count.
- AI 100% alerts represent the hard AI quota and should be treated as critical.

## Platform Trial Conversion

UI path:

```text
future platform admin trial/conversion surface under app/internal/**
```

Backend owner: Codex.

```ts
interface PlatformTrialConversionView {
  summary: {
    totalOrganizations: number;
    trialingOrganizations: number;
    trialEndingSoonOrganizations: number;
    convertedActiveOrganizations: number;
    expiredTrialOrganizations: number;
    onboardingIncompleteOrganizations: number;
    conversionRatePercent: number;
  };
  organizations: Array<{
    orgId: string;
    orgName: string;
    ownerEmail: string | null;
    plan: 'basic' | 'growth' | 'pro' | 'enterprise';
    status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
    lifecycleState:
      | 'trialing'
      | 'trial_ending'
      | 'trial_expired'
      | 'converted_active'
      | 'not_trial';
    createdAt: string;
    trialEnd: string | null;
    daysUntilTrialEnd: number | null;
    onboardingCompleted: boolean;
    onboardingCompletedAt: string | null;
    needsFollowUp: boolean;
  }>;
}
```

Rules:

- Derived from organizations plus subscription `trial_end`.
- `trialingOrganizations` counts current unexpired trial rows, including `trial_ending`.
- `convertedActiveOrganizations` counts active organizations.
- `expiredTrialOrganizations` counts organizations still marked `trialing` after `trial_end`.
- `onboardingIncompleteOrganizations` counts organizations with no `organizations.onboarding_completed_at`.
- Read-only only. It does not convert accounts, suspend trials, send email, apply migrations, or change subscription status.

## Platform Organization Detail

UI path:

```text
app/internal/orgs/[id]/page.tsx
```

Backend owner: Codex.

```ts
interface PlatformOrganizationDetailView {
  organization: PlatformOrganizationListView['organizations'][number] & {
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
```

## Platform Billing Events

UI path:

```text
app/internal/billing/events/page.tsx
```

Backend owner: Codex.

```ts
interface PlatformBillingEventsView {
  events: Array<{
    id: string;
    orgId: string;
    orgName: string | null;
    provider: 'manual' | 'ecpay' | 'stripe' | 'tappay';
    eventType: string;
    status: 'received' | 'processed' | 'failed' | 'ignored';
    providerEventId: string | null;
    createdAt: string;
  }>;
}
```

## Platform Billing Operations

UI path:

```text
future platform admin billing operation controls under app/internal/**
```

Backend owner: Codex.

Route:

```text
POST /api/internal/saas/billing/operations
```

Request:

```ts
type PlatformBillingOperation =
  | 'mark_manual_payment'
  | 'suspend_org'
  | 'resume_org'
  | 'request_refund';

interface PlatformBillingOperationRequest {
  operation: PlatformBillingOperation;
  orgId: string;
  reason?: string;
  amountTwd?: number;
  periodStart?: string;
  periodEnd?: string;
  effectiveAt?: string;
  paidAt?: string;
  idempotencyKey?: string;
  invoiceId?: string;
  metadata?: Record<string, unknown>;
}
```

Success response:

```ts
{
  success: true;
  data: {
    operation: PlatformBillingOperation;
    orgId: string;
    subscriptionId: string | null;
    auditLogId: string | null;
    billingEventId: string | null;
    invoiceId: string | null;
    nextStatus: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' | null;
  };
}
```

Backend rules:

- Requires platform admin auth plus the existing `multi_tenant_admin` feature flag.
- Uses service-role access only after `requirePlatformAdminAccess()` passes.
- Calls draft RPC `perform_platform_billing_operation` through `createPlatformBillingOperationsRepository()`.
- `mark_manual_payment` requires `amountTwd` and `periodEnd`; it records a processed manual billing event and moves org/subscription to `active`.
- `suspend_org` requires `reason`; it moves org/subscription to `suspended`.
- `resume_org` requires `reason`; it moves org/subscription to `active`.
- `request_refund` requires `amountTwd` and `reason`; it records a refund request event and audit log only. It does not call a payment provider or issue money.
- Every operation is designed to write `audit_logs` in the RPC. UI must not mutate status locally or bypass this route.
- Migration `033_saas_platform_billing_operations.sql` is a draft only in this commit. No migration was applied.

## Platform Billing Event Retry And Reconciliation

UI path:

```text
future platform admin billing event detail/retry surface under app/internal/**
```

Backend owner: Codex.

Dry-run route:

```text
POST /api/internal/saas/billing/events/[id]/retry
body: { "dryRun": true }
```

Success response:

```ts
{
  success: true;
  data: {
    eventId: string;
    orgId: string;
    provider: 'manual' | 'ecpay' | 'stripe' | 'tappay';
    eventType: string;
    status: 'received' | 'processed' | 'failed' | 'ignored';
    providerEventId: string | null;
    retryEnabled: boolean;
    canRetry: boolean;
    dryRunOnly: boolean;
    blockedReason:
      | 'already_processed'
      | 'ignored_event'
      | 'missing_provider_event_id'
      | 'unsupported_provider'
      | 'non_retryable_event_type'
      | 'provider_replay_not_enabled'
      | null;
    operation: 'provider_webhook_replay' | 'no_op';
    message: string;
  };
}
```

Rules:

- Requires platform admin auth plus the existing `multi_tenant_admin` feature flag.
- `{ "dryRun": false }` returns `retry_not_enabled`; provider replay is intentionally not enabled.
- The route reads a single `billing_events` row only after the guard passes.
- It does not call ECPay/Stripe/TapPay, update subscriptions, send email, write audit logs, apply migrations, or mutate provider state.
- UI may display the dry-run result, but must keep retry actions disabled until Codex wires a provider adapter and audit-log write path.
- SOP lives in `docs/SAAS_BILLING_RETRY_RECONCILIATION_SOP.md`.

## Platform Admin Role Model

Backend owner: Codex.

Roles:

```ts
type PlatformAdminRole = 'owner' | 'support' | 'billing';

type PlatformAdminPermission =
  | 'view_platform_dashboard'
  | 'view_organizations'
  | 'view_billing_events'
  | 'manage_billing_operations'
  | 'provision_organizations'
  | 'manage_platform_roles';
```

Default permissions:

| Role | Permissions |
|---|---|
| `owner` | all platform permissions |
| `support` | `view_platform_dashboard`, `view_organizations` |
| `billing` | `view_platform_dashboard`, `view_organizations`, `view_billing_events`, `manage_billing_operations` |

Rules:

- `requirePlatformAdminAccess()` now resolves a `platformRole` and `permissions`.
- Existing single-admin/manual owner sessions default to `owner` for backward compatibility.
- Optional env mapping `PLATFORM_ADMIN_ROLES` can assign roles by user email or user id:
  - CSV: `support@example.com=support,billing@example.com=billing`
  - JSON: `{ "support@example.com": "support" }`
- Invalid matching role mappings are rejected instead of silently upgrading to owner.
- Platform admin routes now request explicit permissions before creating service-role repositories.
- Claude UI may render `context.platformRole` / `context.permissions`, but must not duplicate or override the permission matrix client-side.

## Platform Admin Live Data Server Loader

Codex has server-side platform admin live data loaders in:

```text
lib/saas/platform-admin-live-data.ts
```

Available helpers:

- `loadPlatformOrganizationsView()`
- `loadPlatformOrganizationDetailView(orgId)`
- `loadPlatformBillingEventsView()`
- `loadPlatformAtRiskAlertsView()`
- `loadPlatformTrialConversionView()`

These helpers are for Claude UI handoff on the internal platform admin pages.
They call `requirePlatformAdminAccess()` before creating the service-role
platform admin repository, then build DTOs through `lib/saas/ui-backend-contracts.ts`.
UI pages should consume these loaders from Server Components instead of calling
API route handlers directly.

`PlatformAdminLiveDataContext` includes:

```ts
{
  userId: string;
  userEmail?: string;
  isPlatformAdmin: true;
  platformRole: PlatformAdminRole;
  permissions: readonly PlatformAdminPermission[];
  featureFlags: Record<string, boolean>;
}
```

Each helper returns:

```ts
type PlatformAdminLiveDataResult<T> =
  | { state: 'ready'; data: T; context: PlatformAdminLiveDataContext }
  | { state: 'empty'; data: null; message: string; context: PlatformAdminLiveDataContext }
  | { state: 'gated'; data: null; gated: GatedState }
  | { state: 'error'; data: null; message: string };
```

### `/internal/orgs`

Server data function:

```ts
loadPlatformOrganizationsView()
```

DTO shape:

```ts
PlatformOrganizationListView
```

State triggers:

- `ready`: platform admin auth and `multi_tenant_admin` flag pass, organizations and monthly usage snapshots validate through `buildPlatformOrganizationListView()`.
- `empty`: no organizations exist.
- `gated`: missing auth/admin role or disabled `multi_tenant_admin` feature flag. The repository is not queried.
- `error`: repository query failure or DTO contract validation failure.

### `/internal/orgs/[id]`

Server data function:

```ts
loadPlatformOrganizationDetailView(orgId)
```

DTO shape:

```ts
PlatformOrganizationDetailView
```

State triggers:

- `ready`: platform admin auth and `multi_tenant_admin` flag pass, `orgId` is valid, organization detail, usage, and audit logs validate through `buildPlatformOrganizationDetailView()`.
- `empty`: invalid `orgId` or organization not found.
- `gated`: missing auth/admin role or disabled `multi_tenant_admin` feature flag. The repository is not queried.
- `error`: repository query failure or DTO contract validation failure.

### `/internal/billing/events`

Server data function:

```ts
loadPlatformBillingEventsView()
```

DTO shape:

```ts
PlatformBillingEventsView
```

State triggers:

- `ready`: platform admin auth and `multi_tenant_admin` flag pass, billing events and organization names validate through `buildPlatformBillingEventsView()`.
- `empty`: no billing events exist.
- `gated`: missing auth/admin role or disabled `multi_tenant_admin` feature flag. The repository is not queried.
- `error`: repository query failure or DTO contract validation failure.

### Platform at-risk alerts

Server data function:

```ts
loadPlatformAtRiskAlertsView()
```

DTO shape:

```ts
PlatformAtRiskAlertsView
```

State triggers:

- `ready`: platform admin auth and `multi_tenant_admin` flag pass, organizations, monthly usage snapshots, and subscription snapshots validate through `buildPlatformAtRiskAlertsView()`.
- `empty`: no organizations exist.
- `gated`: missing auth/admin role or disabled `multi_tenant_admin` feature flag. The repository is not queried.
- `error`: repository query failure or DTO contract validation failure.

### Platform trial conversion

Server data function:

```ts
loadPlatformTrialConversionView()
```

DTO shape:

```ts
PlatformTrialConversionView
```

State triggers:

- `ready`: platform admin auth and `multi_tenant_admin` flag pass, organizations and subscription snapshots validate through `buildPlatformTrialConversionView()`.
- `empty`: no organizations exist.
- `gated`: missing auth/admin role or disabled `multi_tenant_admin` feature flag. The repository is not queried.
- `error`: repository query failure or DTO contract validation failure.

## Onboarding Backend Foundation

UI path:

```text
future /app/onboarding/[step] surfaces
```

Backend owner: Codex.

Current helpers:

```text
lib/saas/onboarding.ts
supabase/migrations/035_saas_onboarding_completion_rpc.sql
```

Progress DTO:

```ts
interface SaaSOnboardingView {
  org: {
    id: string;
    name: string;
    onboardingCompletedAt: string | null;
  };
  summary: {
    totalSteps: number;
    completedSteps: number;
    percentComplete: number;
    currentStepId:
      | 'organization_profile'
      | 'return_policy'
      | 'team_setup'
      | 'first_return'
      | 'ai_review'
      | 'complete'
      | null;
  };
  steps: Array<{
    id:
      | 'organization_profile'
      | 'return_policy'
      | 'team_setup'
      | 'first_return'
      | 'ai_review'
      | 'complete';
    title: string;
    description: string;
    required: boolean;
    complete: boolean;
    status: 'complete' | 'current' | 'pending' | 'blocked';
  }>;
  actions: {
    canComplete: boolean;
    disabledReason?: string;
  };
}
```

Completion contract:

```ts
completeSaaSOnboarding(value, {
  context,
  repository,
  now,
})
```

Rules:

- Completion requires tenant `owner` or `admin` role.
- Completion requires a writable subscription state through `canWriteSaaSOrgData()`.
- The repository calls draft RPC `complete_organization_onboarding`.
- Draft migration `035_saas_onboarding_completion_rpc.sql` updates `organizations.onboarding_completed_at` and writes `audit_logs` action `org.onboarding_completed`.
- This does not expose a route, change UI, apply migrations, send email, deploy, or change external settings.
- Claude UI may render the progress DTO, but final completion writes must go through a future Codex-owned route/server action using this service.

## Notification Queue Foundation

Backend owner: Codex.

Current helpers:

```text
lib/saas/notifications.ts
supabase/migrations/034_saas_notification_email_queue.sql
```

Supported event types:

```ts
type SaaSNotificationEventType =
  | 'billing_payment_failed'
  | 'ai_quota_reached'
  | 'trial_ending'
  | 'platform_announcement';
```

Available builders:

- `buildBillingPaymentFailedNotification()`
- `buildAIQuotaReachedNotification()`
- `buildTrialEndingNotification()`
- `buildPlatformAnnouncementNotification()`
- `buildSaaSNotificationDispatch()`
- `createSaaSNotificationQueueRepository()`

Dispatch shape:

```ts
interface SaaSNotificationDispatch {
  eventType: SaaSNotificationEventType;
  notifications: Array<{
    org_id: string;
    user_id: string;
    notification_type: SaaSNotificationEventType;
    title: string;
    message: string;
    action_url: string | null;
    metadata: Record<string, unknown>;
    idempotency_key: string | null;
  }>;
  emailQueue: Array<{
    org_id: string;
    recipient_user_id: string | null;
    recipient_email: string;
    template_key:
      | 'billing.payment_failed'
      | 'usage.ai_quota_reached'
      | 'trial.ending'
      | 'platform.announcement';
    subject: string;
    event_type: SaaSNotificationEventType;
    payload: Record<string, unknown>;
    status: 'queued';
    send_after: string | null;
    idempotency_key: string | null;
  }>;
}
```

Rules:

- This is queue-only backend foundation. It does not send email, call an email provider, expose a route, apply migrations, deploy, or change external platform settings.
- In-app notifications are inserted only for recipients with `userId` and `in_app` channel.
- Email queue rows are inserted only for recipients with a valid email and `email` channel.
- Draft migration `034_saas_notification_email_queue.sql` extends `notifications` with action URL, metadata, idempotency, and delivery status, and adds `email_queue` as a service-role-only queue.
- Claude UI may render future notification status only after Codex wires a guarded read contract. UI must not call email providers or mutate queue status directly.

## Email Queue Worker Dry-Run

Backend owner: Codex.

Current helpers:

```text
lib/saas/email-queue-worker.ts
app/api/cron/saas/email-queue/route.ts
```

Cron route:

```text
GET /api/cron/saas/email-queue?dryRun=true
Authorization: Bearer <CRON_SECRET>
```

Response shape:

```ts
{
  success: true;
  data: {
    checkedAt: string;
    deliveryProviderEnabled: false;
    dryRunOnly: true;
    summary: {
      scanned: number;
      sendable: number;
      blocked: number;
      maxAttempts: number;
    };
    decisions: Array<{
      emailQueueId: string;
      orgId: string;
      recipientEmail: string;
      templateKey: string;
      eventType:
        | 'billing_payment_failed'
        | 'ai_quota_reached'
        | 'trial_ending'
        | 'platform_announcement';
      status: 'queued' | 'sent' | 'failed' | 'cancelled';
      attemptCount: number;
      canSend: false;
      dryRunOnly: true;
      blockedReason:
        | 'not_queued'
        | 'not_due'
        | 'max_attempts_exceeded'
        | 'delivery_provider_not_configured'
        | 'delivery_disabled'
        | null;
    }>;
  };
}
```

Rules:

- The route is `CRON_SECRET` gated.
- `{ dryRun: false }` / `?dryRun=false` returns `delivery_not_enabled`.
- It reads due `email_queue` rows with service-role access after cron auth passes.
- It does not send email, call an email provider, update queue rows, apply migrations, deploy, or change platform settings.
- Claude UI may not call this route. It is for backend cron readiness and future operator diagnostics only.

## Implementation Rule

Claude may use these contracts as mock UI data.

Codex must not expose live backend routes until:

- required migrations are applied to the SaaS project only;
- feature flags are checked;
- role guards are checked;
- tests cover tenant isolation and error states.

## Current Backend DTO Helpers

Codex has local DTO builders for contract validation in:

```text
lib/saas/ui-backend-contracts.ts
```

Available builders:

- `buildUsageSettingsView()`
- `buildBillingSettingsView()`
- `buildTeamSettingsView()`
- `buildPlatformOrganizationListView()`
- `buildPlatformOrganizationDetailView()`
- `buildPlatformBillingEventsView()`
- `buildPlatformAtRiskAlertsView()`
- `buildPlatformTrialConversionView()`

These helpers do not expose routes by themselves. They validate and normalize backend data before a future route or server action returns it to UI.

Codex also has a local usage settings data repository foundation in:

```text
lib/saas/settings-usage-data.ts
```

Available helpers:

- `createSettingsUsageDataRepository()`
- `buildUsageSettingsViewInput()`
- `buildCurrentUsagePeriod()`

These helpers prepare future `/settings/usage` live data from `organizations`, `organization_members`, `organization_invites`, `return_requests`, and `ai_usage_events` rows. They do not expose a route, run migrations, enable billing, or change UI by themselves.

Codex also has a local billing settings data repository foundation in:

```text
lib/saas/settings-billing-data.ts
```

Available helpers:

- `createSettingsBillingDataRepository()`
- `buildBillingSettingsViewInput()`

These helpers prepare future `/settings/billing` live data from `organizations`, `subscriptions`, and latest `invoices` rows. They do not expose a route, run migrations, enable billing, or change UI by themselves.

Codex also has a local team settings data repository foundation in:

```text
lib/saas/settings-team-data.ts
```

Available helpers:

- `createSettingsTeamDataRepository()`
- `buildTeamSettingsViewInput()`

These helpers prepare future `/settings/team` live data from `organizations`, `organization_members`, and `organization_invites` rows. They do not expose a route, send invites, run migrations, or change UI by themselves.

Codex also has a local invite token data repository foundation in:

```text
lib/saas/invite-token-data.ts
```

Available helpers:

- `createInviteTokenDataRepository()`
- `getInviteByToken()`

These helpers prepare future `/invite/[token]` live data from `organization_invites` plus organization context. They resolve pending, accepted, and expired invite states through the shared invite policy. They do not expose a route, accept an invite, send email, run migrations, or change UI by themselves.

Codex also has a local invite acceptance service foundation in:

```text
lib/saas/invite-acceptance.ts
```

Available helpers:

- `acceptSaaSInvite()`
- `createSaaSInviteAcceptanceRepository()`
- `buildAcceptOrganizationInviteRpcArgs()`

This helper prepares the future invite acceptance flow behind repository interfaces. It validates the token, signed-in user email, invite role, and invite lifecycle state before calling the `accept_organization_invite` RPC wrapper. The RPC is only a migration draft in `supabase/migrations/031_saas_invite_acceptance_rpc.sql`. This does not expose a route, accept live invites, send email, run migrations, or change UI by itself.

## Invite Acceptance Live Data And Route

Codex has server-side invite acceptance live data and accept route helpers in:

```text
lib/saas/invite-acceptance-live-data.ts
lib/saas/invite-accept-route.ts
app/api/saas/invite/accept/route.ts
```

Available helpers:

- `loadInviteAcceptanceView(token)`
- `acceptSaaSInviteFromRequest(payload)`
- `handleAcceptSaaSInviteRequest(request)`

### `/invite/[token]`

Server data function:

```ts
loadInviteAcceptanceView(token)
```

DTO shape:

```ts
type InviteAcceptanceLiveDataResult<T> =
  | { state: 'ready'; data: T }
  | { state: 'empty'; data: null; message: string }
  | { state: 'gated'; data: null; gated: GatedState }
  | { state: 'error'; data: null; message: string };

interface InviteAcceptanceView {
  invite: {
    id: string;
    token: string;
    email: string;
    role: 'admin' | 'staff' | 'viewer' | null;
    inviteStatus: 'pending' | 'accepted' | 'expired' | 'revoked';
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
    state: 'can_accept' | 'needs_login' | 'email_mismatch' | 'already_member';
    userId: string | null;
    userEmail: string | null;
  };
}
```

State triggers:

- `ready`: token exists and invite data validates; `viewer.state` decides whether the signed-in viewer can accept.
- `empty`: missing token or token not found.
- `error`: invite lookup, auth, membership lookup, or DTO preparation failure.

Viewer state:

- `can_accept`: signed-in user email matches the invite, invite is pending, and user is not already a member.
- `needs_login`: viewer is not signed in, signed-in email is unavailable, or invite is not currently acceptable.
- `email_mismatch`: signed-in user email does not match the invited email.
- `already_member`: invite is accepted or the signed-in user is already a member of the organization.

Accept route:

```text
POST /api/saas/invite/accept
body: { "token": "..." }
```

Success:

```ts
{
  success: true;
  data: {
    accepted: true;
    inviteId: string;
    orgId: string;
    membershipId: string | null;
    role: 'admin' | 'staff' | 'viewer';
    acceptedAt: string;
  };
}
```

Failure:

```ts
{
  success: false;
  error: string;
  code: string;
}
```

The route requires a signed-in user with an email, reuses `acceptSaaSInvite()`,
and calls the already-applied `accept_organization_invite` RPC through the
repository wrapper. No email sending, UI wiring, migration, deployment, or
platform setting change is included.

## Settings Live Data Server Loader

Codex has server-side settings live data loaders in:

```text
lib/saas/settings-live-data.ts
```

Available helpers:

- `loadBillingSettingsView()`
- `loadUsageSettingsView()`
- `loadTeamSettingsView()`

The default loader path uses the authenticated server Supabase client/RLS, not
service-role access. Claude may consume these from Server Components after
handoff, but should not change query shape or repository logic.

Each helper returns:

```ts
type SettingsLiveDataResult<T> =
  | { state: 'ready'; data: T; context: SettingsLiveDataContext }
  | { state: 'empty'; data: null; message: string; context: SettingsLiveDataContext }
  | { state: 'gated'; data: null; gated: GatedState }
  | { state: 'error'; data: null; message: string };
```

### `/settings/billing`

Server data function:

```ts
loadBillingSettingsView()
```

DTO shape:

```ts
BillingSettingsView
```

State triggers:

- `ready`: `getOrgContext()` passes owner/admin role and `billing` feature flag, and billing rows build a valid DTO.
- `empty`: organization billing row is missing.
- `gated`: missing auth/membership, non-owner/admin role, or disabled billing feature.
- `error`: repository query failure or DTO contract validation failure.

### `/settings/usage`

Server data function:

```ts
loadUsageSettingsView()
```

DTO shape:

```ts
UsageSettingsView
```

State triggers:

- `ready`: `getOrgContext()` finds a SaaS org membership and usage rows build a valid DTO.
- `empty`: organization usage plan row is missing.
- `gated`: missing auth or membership.
- `error`: repository query failure or DTO contract validation failure.

### `/settings/team`

Server data function:

```ts
loadTeamSettingsView()
```

DTO shape:

```ts
TeamSettingsView
```

State triggers:

- `ready`: `getOrgContext()` finds a SaaS org membership and team rows build a valid DTO.
- `empty`: organization team plan row is missing.
- `gated`: missing auth or membership.
- `error`: repository query failure or DTO contract validation failure.

Action behavior:

- Owner/admin on writable org: `canInvite=true`, `canChangeRoles=true`, subject to seat-limit validation in the DTO builder.
- Non-owner/admin: `ready` state with management actions disabled and `disabledReason`.
- Suspended/cancelled/past_due write-restricted org: `ready` state with management actions disabled and `disabledReason`.
