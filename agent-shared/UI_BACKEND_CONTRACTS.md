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
  }>;
}
```

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
