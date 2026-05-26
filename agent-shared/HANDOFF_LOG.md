# Handoff Log

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude platform admin copy polish handoffs.

Commits:

```text
f5d8171 fix(saas/ui): polish platform admin org pages copy
8a5a6dc fix(saas/ui): polish platform billing events page copy
```

Files reported by commits:

- `app/internal/orgs/page.tsx`
- `app/internal/orgs/[id]/page.tsx`
- `app/internal/billing/events/page.tsx`

UI handoff summary:

- `/internal/orgs` and `/internal/orgs/[id]` now use operator-facing copy and
  avoid schema/table helper wording.
- `/internal/billing/events` removes stage wording and schema-source copy while
  keeping operator-relevant guard requirements.

Notes:

- Claude commits report UI/copy only.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Added the onboarding live data loader contract for Claude-owned onboarding UI.

Commit:

```text
this commit
```

Files:

- `lib/saas/onboarding-live-data.ts`
- `tests/unit/saas-onboarding-live-data.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/WORK_SPLIT_PLAN.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Contract:

- `loadSaaSOnboardingView()` returns ready/empty/gated/error states for future
  onboarding UI.
- Ready state is built from org-scoped repository signals:
  `organizations`, `system_settings`, `organization_members`,
  `organization_invites`, `return_requests`, and `ai_usage_events`.
- The loader reuses `buildSaaSOnboardingView()` so UI receives the same step
  DTO as the completion service expects.
- Completion actions are enabled only for tenant owner/admin contexts with
  writable org status.

Remaining split:

- Claude owns the onboarding wizard/page UI and visual states.
- Codex owns migration `035` apply and any future schema/route changes if owner
  explicitly authorizes them.

Notes:

- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's Platform Admin Mode floating indicator UI handoff.

Commit:

```text
9edf220 feat(saas/ui): add Platform Admin Mode floating indicator
```

Files reported by commit:

- `app/(admin)/template.tsx`
- `components/saas/platform-admin-mode-indicator.tsx`

UI handoff summary:

- Tenant `(admin)` pages now wrap with a server template that renders the
  Platform Admin Mode indicator.
- The indicator consumes `loadPlatformAdminModeView()` and stays hidden for
  non-admin viewers.
- Ready state shows platform role, admin email on wider screens, and links to
  `/internal`, `/internal/orgs`, and `/internal/billing/events` when the
  internal console is enabled.

Notes:

- Claude commit reports UI/composition only.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's platform admin dashboard UI handoff.

Commit:

```text
ee474ed feat(saas/ui): add platform admin dashboard at /internal
```

Files reported by commit:

- `app/internal/page.tsx`
- `app/internal/layout.tsx`
- `components/internal/nav-link.tsx`

UI handoff summary:

- `/internal` now consumes `loadPlatformAdminDashboardView()`.
- Renders KPI cards, at-risk alerts, trial follow-up, billing summary, recent
  billing events, and gated/empty/error states.
- Adds a Dashboard item to the internal nav with exact-match active state.

Notes:

- Claude commit reports UI/nav only.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Added the onboarding completion API route contract for Claude-owned onboarding UI.

Commit:

```text
this commit
```

Files:

- `lib/saas/onboarding-route.ts`
- `app/api/saas/onboarding/complete/route.ts`
- `tests/unit/saas-onboarding-route.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Contract:

- `POST /api/saas/onboarding/complete` is available for future onboarding UI.
- The route requires signed-in tenant `owner` or `admin` plus writable org status through `getOrgContext()`.
- It reuses `completeSaaSOnboarding()` and the draft RPC repository wrapper.
- JSON errors are mapped through `SaaSOrgContextError` and `SaaSOnboardingError`.

Remaining split:

- Claude owns the onboarding page/wizard UI and when to show/enable the completion action.
- Codex owns migration `035` apply, if owner explicitly authorizes it later.

Notes:

- Migration `035_saas_onboarding_completion_rpc.sql` is still not applied by this commit.
- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Extended `saas:doctor` coverage for the role separation and platform dashboard
contracts.

Commit:

```text
this commit
```

Files:

- `scripts/saas/readiness-check.mjs`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`

Gate additions:

- Auth redirect contract: `signIn()` consumes sanitized `next` paths and
  returns role-aware `redirectTo`.
- Internal admin redirect helper: unauthenticated `/internal/*` access returns
  `/login?next=...`.
- Platform admin mode contract: server-resolved identity, role, permissions,
  links, and hidden states.
- Platform admin dashboard live-data contract: dashboard/list/detail loaders
  are checked for guard, repository, and DTO builder wiring.

Notes:

- `npm run saas:doctor` now reports `135 pass, 1 warn, 0 fail` in this local
  SaaS setup.
- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Added the backend contract for a Claude-owned `/internal` platform dashboard.

Commit:

```text
this commit
```

Files:

- `lib/saas/ui-backend-contracts.ts`
- `lib/saas/platform-admin-live-data.ts`
- `tests/unit/saas-platform-admin-live-data.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`

Contract:

- `loadPlatformAdminDashboardView()` is guarded by
  `view_platform_dashboard`.
- Ready state includes organization KPI, at-risk alert summary/top alerts,
  trial conversion summary/follow-up organizations, and billing event summary
  plus recent events.
- The loader reads real platform organization, usage, subscription, and billing
  event snapshots through the existing repository boundary.
- It does not expose customer return details to platform admins.

Remaining split:

- Claude owns replacing the current `/internal` redirect with a dashboard UI
  that consumes this loader.
- Codex owns any additional backend data fields, query changes, or permission
  rules.

Notes:

- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Added the backend contract for a Claude-owned Platform Admin Mode indicator.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-mode.ts`
- `tests/unit/saas-platform-admin-mode.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`

Contract:

- `loadPlatformAdminModeView()` returns `state: 'ready'` only for platform
  admins.
- Ready state includes `userId`, `userEmail`, `platformRole`,
  `permissions`, `internalEnabled`, and stable internal links.
- Unauthenticated visitors, non-admin users, and unexpected failures return
  `state: 'hidden'`.
- Claude should use this loader for any top bar or floating "Platform Admin
  Mode" indicator and should not inspect cookies or duplicate role checks.

Notes:

- No UI component, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Added the non-UI internal admin redirect contract.

Commit:

```text
this commit
```

Files:

- `lib/auth/internal-login-redirect.ts`
- `lib/auth/post-login-redirect.ts`
- `lib/actions/auth.ts`
- `app/login/page.tsx`
- `app/internal/orgs/page.tsx`
- `app/internal/orgs/[id]/page.tsx`
- `app/internal/billing/events/page.tsx`
- `lib/saas/platform-admin-live-data.ts`
- `tests/unit/internal-login-redirect.test.ts`
- `tests/unit/post-login-redirect.test.ts`
- `tests/unit/saas-platform-admin-live-data.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`

Contract:

- Unauthenticated access to `/internal/orgs`, `/internal/orgs/[id]`, and
  `/internal/billing/events` redirects to `/login?next=<encoded internal path>`.
- `signIn()` accepts an optional safe `requestedPath`.
- Platform admins may return to safe `/internal/*` paths after login.
- Merchant/customer users cannot use `/internal/*` as a login redirect.
- External URLs, protocol-relative URLs, `/login`, and backslash paths are
  rejected and fall back to the role default.
- Authenticated non-admin users remain gated for Claude-owned forbidden UI.

Remaining split:

- Claude owns the visual treatment of forbidden states, login page copy/layout,
  and any admin mode indicator.
- Codex owns future session, impersonation, platform role storage, and internal
  dashboard data contracts.

Notes:

- No deployment, migration, env/secret edit, billing/provider enablement,
  master/live/prod change, or production/internal Supabase action was performed.

## 2026-05-26 Codex -> Claude / Codex

Added the non-UI post-login redirect contract for the role separation work.

Commit:

```text
this commit
```

Files:

- `lib/auth/post-login-redirect.ts`
- `lib/actions/auth.ts`
- `app/login/page.tsx`
- `tests/unit/post-login-redirect.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`

Contract:

- `signIn()` now returns `redirectTo`.
- Platform admin sessions and Supabase profiles with `users.role = 'admin'` resolve to `/internal`.
- Merchant/customer users resolve to `/analytics`.
- Login UI only consumes the backend result and should not duplicate role detection.
- `/internal/*` remains protected by Codex-owned platform admin guards.

Remaining split:

- Claude owns visual polish for login, forbidden states, admin mode indicators, and customer-facing settings pages.
- Codex owns any further auth/session work such as `next` handling, impersonation, platform admin role storage, and internal dashboard data contracts.

Notes:

- No deployment, migration, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed.

## 2026-05-26 Codex -> Claude / Codex

Recorded the Closed Manual Beta production deployment smoke test.

Commit:

```text
this commit
```

Files:

- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `docs/MANUAL_BETA_LAUNCH_DECISION_CHECKLIST.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/TASK_BOARD.md`

Deployment inspected:

- Production URL: `https://smart-return-system-saas.vercel.app`
- Vercel project: `smart-return-system-saas`
- Branch: `develop-saas`
- Commit: `99c4046 feat(saas): add Sentry runtime configuration`
- Deployment ID: `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS`
- Vercel status: Ready

Smoke test result:

- Public pages returned 200:
  - `/`
  - `/pricing`
  - `/features/returns`
  - `/features/ai`
  - `/features/security`
  - `/contact`
  - `/signup`
  - `/login`
- Unauthenticated protected pages returned 307 to `/login`:
  - `/returns`
  - `/pickup/scan`
  - `/analytics/ai-report`
  - `/settings/usage`

Remaining items:

- Sentry SDK is wired but Sentry DSN is not configured, so monitoring is not active.
- Beta custom domain is not configured.
- Billing/ECPay remains disabled and should wait for Stage 2.
- Email provider remains dry-run only.
- Next Beta onboarding step is to create or confirm organization/account/invite/login credentials for `遇見未來`.
- Keep Vercel rollback readiness for at least 24 hours after launch.

Notes:

- This was a read-only post-deploy check plus documentation update.
- No deployment, migration, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed by this review.

## 2026-05-25 Codex -> Claude / Codex

Refreshed the SaaS remaining-work and blocker documentation after commit `b3f045e`.

Commit:

```text
this commit
```

Files:

- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Current confirmed state:

- Manual Beta backend/readiness/predeploy consistency gate is complete.
- `email_queue` worker remains dry-run only through the `CRON_SECRET`-gated cron route.
- AI analytics predeploy consistency fallback is complete for optional legacy Shopee date columns.
- No migration, deployment, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed.

Next Claude UI scope:

- Public marketing/legal RWD inspection only.
- Routes: `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/signup`.
- Claude should not change signup persistence, billing behavior, API routes, server actions, migrations, env, or backend contracts.

External rollout blockers:

- Sentry/logging DSN.
- Billing/ECPay credentials and explicit `ENABLE_BILLING` rollout.
- Final custom domain or Vercel Preview SSO/bypass decision.
- Explicit SaaS production deploy authorization.

## 2026-05-25 Codex -> Claude / Codex

Completed local Manual Beta smoke coverage and hardened the AI analytics predeploy consistency gate.

Commit:

```text
this commit
```

Files:

- `scripts/predeploy/check-ai-analytics-consistency.mjs`
- `tests/unit/ai-analytics-consistency.test.mts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Smoke coverage:

- Public and protected route behavior was checked locally on the SaaS dev server.
- Beta owner Supabase Auth, active organization membership, and seeded org data were verified.
- Authenticated pages returned successfully for returns, return detail, pickup scan, AI report, settings, and platform admin read views.
- Export APIs returned workbook responses.
- AI analyze returned success and saved a report.
- Team invite creation and invitee acceptance were verified without exposing invite tokens or passwords.

Gate hardening:

- `check-ai-analytics-consistency.mjs` now falls back when SaaS `shopee_returns` lacks optional legacy date columns such as `dispute_deadline` or `processed_at`.
- Non-schema query errors still fail the gate.
- Unit coverage was added for date normalization, missing-column detection, fallback ordering, and non-schema error handling.

Notes:

- No migration, provider call, email send, production deploy, master change, env secret output, or production/internal Supabase action was performed.
- Billing remains disabled for Manual Beta.
- Public rollout still requires Sentry/logging, final domain/protection decision, billing credentials for paid self-serve, and explicit deployment authorization.

## 2026-05-25 Codex -> Claude / Codex

Added the email queue worker dry-run contract.

Commit:

```text
this commit
```

Files:

- `lib/saas/email-queue-worker.ts`
- `app/api/cron/saas/email-queue/route.ts`
- `tests/unit/saas-email-queue-worker.test.ts`
- `scripts/maintenance/cron-drill.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New backend helpers:

- `buildSaaSEmailQueueWorkerPreview()`
- `createSaaSEmailQueueWorkerRepository()`
- `handleSaaSEmailQueueCron()`

New dry-run route:

- `GET /api/cron/saas/email-queue?dryRun=true`

Notes:

- The route is `CRON_SECRET` gated.
- `dryRun=false` returns `delivery_not_enabled`.
- The route reads due queued `email_queue` rows only after cron auth passes.
- No email provider was wired, no email was sent, no queue rows were mutated, no migration was applied, and no deployment/env/platform setting was changed.

## 2026-05-25 Codex -> Claude

Added the onboarding backend foundation.

Commit:

```text
this commit
```

Files:

- `lib/saas/onboarding.ts`
- `supabase/migrations/035_saas_onboarding_completion_rpc.sql`
- `tests/unit/saas-onboarding.test.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/saas-migration-plan.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

New backend helpers:

- `buildSaaSOnboardingView()`
- `completeSaaSOnboarding()`
- `normalizeSaaSOnboardingCompletionRequest()`
- `buildCompleteSaaSOnboardingRpcArgs()`
- `createSaaSOnboardingRepository()`

Notes:

- This is a backend contract for future `/app/onboarding/[step]` UI work.
- Completion requires tenant `owner` or `admin` role plus a writable subscription status.
- Draft migration `035_saas_onboarding_completion_rpc.sql` updates `organizations.onboarding_completed_at` and writes audit action `org.onboarding_completed`.
- No live route was exposed, no UI page was changed, no migration was applied, no email was sent, and no deployment/env/platform setting was changed.
- Claude may render the progress DTO; completion writes must wait for a future Codex-owned route/server action.

## 2026-05-25 Codex -> Claude

Added the notification backend foundation.

Commit:

```text
this commit
```

Files:

- `lib/saas/notifications.ts`
- `supabase/migrations/034_saas_notification_email_queue.sql`
- `tests/unit/saas-notifications.test.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/saas-migration-plan.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New backend helpers:

- `buildBillingPaymentFailedNotification()`
- `buildAIQuotaReachedNotification()`
- `buildTrialEndingNotification()`
- `buildPlatformAnnouncementNotification()`
- `buildSaaSNotificationDispatch()`
- `createSaaSNotificationQueueRepository()`

Notes:

- This is queue-only foundation for billing failure, AI quota reached, trial ending, and platform announcements.
- In-app rows target `notifications`; email rows target the new draft `email_queue`.
- Draft migration `034_saas_notification_email_queue.sql` was not applied to any database.
- No email provider was wired, no email was sent, no route was exposed, and no deployment, env, migration apply, or platform setting was changed.
- Claude UI may render future queued notification status only after Codex exposes a guarded read contract.

## 2026-05-25 Codex -> Claude

Added the platform admin role model backend policy.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-roles.ts`
- `lib/saas/platform-admin.ts`
- `lib/saas/platform-admin-live-data.ts`
- `app/api/internal/saas/orgs/route.ts`
- `app/api/internal/saas/orgs/[id]/route.ts`
- `app/api/internal/saas/billing/events/route.ts`
- `app/api/internal/saas/billing/events/[id]/retry/route.ts`
- `app/api/internal/saas/billing/operations/route.ts`
- `tests/unit/saas-platform-admin.test.ts`
- `tests/unit/saas-platform-admin-routes.test.ts`
- `tests/unit/saas-platform-admin-live-data.test.ts`
- `tests/unit/saas-platform-admin-billing-operations.test.ts`
- `tests/unit/saas-billing-reconciliation.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New role model:

- `owner`: all platform permissions.
- `support`: platform dashboard and organization read views only.
- `billing`: platform dashboard, organization read views, billing events, and billing operations.

Notes:

- Existing single-admin/manual owner sessions default to `owner` so closed Beta owner inspection keeps working.
- Optional `PLATFORM_ADMIN_ROLES` can map platform admins by email or user id with CSV or JSON.
- Invalid matching role mappings are rejected instead of silently upgrading to owner.
- Platform routes now request explicit permissions before creating service-role repositories.
- Claude may display `context.platformRole` and `context.permissions`, but must keep the permission matrix backend-owned.
- No DB migration, env value, deployment, provider call, email, or platform setting was changed.

## 2026-05-25 Codex -> Claude

Added the billing event retry and reconciliation backend design.

Commit:

```text
this commit
```

Files:

- `lib/saas/billing-reconciliation.ts`
- `app/api/internal/saas/billing/events/[id]/retry/route.ts`
- `tests/unit/saas-billing-reconciliation.test.ts`
- `docs/SAAS_BILLING_RETRY_RECONCILIATION_SOP.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New route:

- `POST /api/internal/saas/billing/events/[id]/retry`

New backend helpers:

- `buildBillingEventRetryDecision()`
- `buildBillingEventReconciliationView()`

Notes:

- The retry route is dry-run only. `{ "dryRun": false }` returns `retry_not_enabled`.
- The route is platform-admin gated and reads `billing_events` only after `requirePlatformAdminAccess()` passes.
- Provider replay remains disabled; no provider API call, subscription change, audit write, migration, email, deployment, env, or platform setting was changed.
- Claude may display retry eligibility and reconciliation status later, but retry buttons must remain disabled until Codex wires a provider adapter and audit-log write path.

## 2026-05-25 Codex -> Claude

Added the platform admin billing operation backend contract.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-billing-operations.ts`
- `app/api/internal/saas/billing/operations/route.ts`
- `supabase/migrations/033_saas_platform_billing_operations.sql`
- `tests/unit/saas-platform-admin-billing-operations.test.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/saas-migration-plan.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New route:

- `POST /api/internal/saas/billing/operations`

New backend helpers:

- `normalizePlatformBillingOperationRequest()`
- `buildPlatformBillingOperationRpcArgs()`
- `createPlatformBillingOperationsRepository()`

Supported operations:

- `mark_manual_payment`
- `suspend_org`
- `resume_org`
- `request_refund`

Notes:

- The route is platform-admin gated through `requirePlatformAdminAccess()` and `multi_tenant_admin`.
- The route calls the Codex-owned repository wrapper after access passes; UI must not update billing status directly.
- Draft migration `033_saas_platform_billing_operations.sql` defines the audit-log-oriented RPC contract. It was not applied to any database.
- `request_refund` records a request/audit event only. It does not send money, call ECPay/Stripe/TapPay, email customers, deploy, or change env/platform settings.

## 2026-05-25 Codex -> Claude

Added the read-only platform admin trial conversion backend contract.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-data.ts`
- `lib/saas/platform-admin-live-data.ts`
- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `tests/unit/saas-platform-admin-live-data.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New server data function:

- `loadPlatformTrialConversionView()`

New DTO:

- `PlatformTrialConversionView`

Summary signals:

- current trialing organizations
- trial ending soon organizations
- converted active organizations
- expired trial organizations
- onboarding incomplete organizations
- conversion rate percent

Notes:

- This is read-only. It does not convert accounts, suspend trials, send email, apply migrations, or change subscription status.
- It reuses platform admin auth and the `multi_tenant_admin` feature flag gate.
- Claude may render this DTO in future internal UI polish without changing trial lifecycle calculations.

## 2026-05-25 Codex -> Claude

Added the read-only platform admin at-risk alert backend contract.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-data.ts`
- `lib/saas/platform-admin-live-data.ts`
- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `tests/unit/saas-platform-admin-live-data.test.ts`
- `tests/unit/saas-platform-admin-routes.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

New server data function:

- `loadPlatformAtRiskAlertsView()`

New DTO:

- `PlatformAtRiskAlertsView`

Alert signals:

- `past_due`
- `suspended`
- `cancelled`
- `trial_ending`
- `trial_expired`
- `returns_80`
- `returns_100`
- `ai_80`
- `ai_100`
- `seats_full`

Notes:

- This is read-only. It does not suspend orgs, retry billing, send email, apply migrations, or change subscriptions.
- It reuses platform admin auth and the `multi_tenant_admin` feature flag gate.
- Claude may render this DTO in future internal UI polish without changing the alert calculation.

## 2026-05-25 Codex -> Claude / Codex

Defined the next working split requested by the owner:

- Claude owns UI / UX / visual polish.
- Codex owns backend, data, security, billing, APIs, tests, docs, coordination files, and Git operations.
- `agent-shared/**` remains Codex-maintained only.

Added:

- `agent-shared/WORK_SPLIT_PLAN.md`

Updated:

- `agent-shared/README.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`

Claude next UI-safe tasks:

- Platform admin dashboard visual polish against existing summary/health DTOs.
- At-risk and health metric presentation.
- Billing / usage / team settings UI refinement.
- Trial / onboarding UI after Codex defines backend contracts.
- Public marketing/legal polish and responsive QA.

Codex next non-UI tasks:

- Platform admin billing operation backend plan.
- At-risk alert backend contract.
- Trial conversion backend contract.
- Billing event retry and reconciliation design.
- Platform admin role model.
- Notification backend foundation.

Notes:

- No product runtime behavior changed.
- No API, migration, env/secret, deployment, Supabase data, billing provider, or `master` branch operation was performed.

## 2026-05-22 Claude -> Codex

Claude reported the remaining UI task board items as complete.

Recorded from Claude chat handoff:

- Customer portal SaaS polish: complete.
  - Covered loading/error/empty states.
  - Per-org customer portal branding remains backend/schema dependent and was not treated as a UI-only task.
- Returns dashboard visual polish: complete.
  - Covered PageHeader, loading skeleton, and empty state.
- Mobile responsive QA follow-up: complete.
  - Tested with Chrome device emulation at 390x844.
  - `/`: landing page passed mobile layout check.
  - `/pricing`: pricing cards stack cleanly and CTA layout passed.
  - `/invite/[token]`: page layout passed; missing local SaaS admin env correctly renders the error state card instead of crashing.

Notes:

- Claude did not create a code commit because the last step was verification-only and produced no product file diff.
- Codex recorded this durable task-board status because `agent-shared/**` is Codex-maintained.
- No runtime behavior, env/secret, DB migration, deployment, production Supabase, billing provider, or `master` branch operation was performed.

## 2026-05-22 Codex -> Claude / Codex

Added a read-only SaaS rollout readiness gate.

Commit:

```text
this commit
```

Files:

- `package.json`
- `scripts/saas/check-rollout-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/saas-rollout-readiness.test.ts`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/CODEX_NON_UI_SCOPE.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/TASK_BOARD.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Commands:

- `npm run saas:rollout-check`
- `npm run saas:rollout-check:strict`
- `npm run saas:predeploy` now includes the non-strict rollout check.

What it checks:

- SaaS checkout branch and clean working tree.
- SaaS Supabase ref safety; internal/live refs are rejected.
- Gemini key and `gemini-2.5-flash-lite` model readiness.
- `NEXT_PUBLIC_APP_URL` domain readiness; placeholder domains such as `your-saas-domain` are flagged.
- AI safety flags: `ENABLE_IMAGE_AI=false` and `ENABLE_AI_USAGE_LIMIT=true`.
- Billing credential readiness when `ENABLE_BILLING=true`; billing disabled is accepted for manual Beta but warned for paid self-serve.
- Sentry/logging DSN presence for public rollout.

Current local result:

- Non-strict rollout check passes with warnings.
- Current warnings are expected: dirty working tree during this commit, missing/placeholder `GEMINI_API_KEY`, placeholder/missing `NEXT_PUBLIC_APP_URL`, missing Sentry/logging DSN, and billing disabled.
- Strict rollout remains intentionally blocked until owner-provided credentials/domain/rollout approval exist.

Notes:

- No env/secret, DB migration, Vercel deploy, Supabase production, billing provider, or `master` branch operation was performed.

## 2026-05-22 Codex -> Claude / Codex

Synchronized the shared handoff status after the invite acceptance UI and strict SaaS checks.

Commit:

```text
this commit
```

Recorded external readiness:

- `npm run saas:migration-plan:strict`: pass; target project `auyznbwtjvemyamujmgt`; migration chain ends at `032`.
- `npm run saas:schema-gate:strict`: pass; SaaS schema is ready for the checked 023-032 commercial surface.
- `npm run saas:doctor:strict`: still not fully green because `GEMINI_API_KEY` is missing or placeholder.

Recorded UI handoff completion:

- `6ec9499 feat(saas/ui): wire invite acceptance page`
- Files:
  - `app/invite/[token]/page.tsx`
  - `components/saas/invite-accept-panel.tsx`
- The public invite page now consumes `loadInviteAcceptanceView(token)` and calls `POST /api/saas/invite/accept`.
- UI states covered: can accept, login required, email mismatch, already member, accepted, expired, revoked, empty, gated, and error.

Notes:

- No runtime behavior was changed by this status-sync commit.
- No env/secret, migration, deployment, production Supabase, or `master` branch operation was performed.
- Next safe Claude UI work remains customer portal polish, returns dashboard polish, or mobile responsive QA.

## 2026-05-22 Codex -> Claude

Invite acceptance live data loader and accept API route are ready for UI handoff.

Commit:

```text
this commit
```

Files:

- `lib/saas/invite-acceptance-live-data.ts`
- `lib/saas/invite-accept-route.ts`
- `app/api/saas/invite/accept/route.ts`
- `tests/unit/saas-invite-acceptance-live-data.test.ts`
- `tests/unit/saas-invite-accept-route.test.ts`
- `lib/auth/route-auth.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Server data function:

- `/invite/[token]`: `loadInviteAcceptanceView(token)`

Accept route:

- `POST /api/saas/invite/accept`
- body: `{ token: string }`
- route handler: `handleAcceptSaaSInviteRequest(request)`
- pure use-case: `acceptSaaSInviteFromRequest(payload)`

DTO shape:

- `InviteAcceptanceLiveDataResult<InviteAcceptanceView>`

State triggers:

- `ready`: token exists; data includes organization, invite role/status/timestamps, and `viewer.state`.
- `empty`: missing token or token not found.
- `error`: invite lookup, auth, membership lookup, or DTO preparation failure.
- `gated`: reserved in the result type for future feature gates; no invite feature gate is currently applied.

Viewer states:

- `can_accept`: signed-in user email matches the invite, invite is pending, and user is not already a member.
- `needs_login`: viewer is not signed in, signed-in email is unavailable, or the invite is not currently acceptable.
- `email_mismatch`: signed-in user email does not match the invited email.
- `already_member`: invite is accepted or the signed-in user is already a member of the organization.

Notes:

- No `app/invite/[token]/page.tsx` UI file was edited.
- The accept route reuses `acceptSaaSInvite()` and the already-applied `accept_organization_invite` RPC wrapper.
- No email sending, migration, env/secret, deployment, production Supabase, or master branch operation was performed.

## 2026-05-22 Codex -> Claude

Platform admin page-level live data loaders are ready for internal UI handoff.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-live-data.ts`
- `tests/unit/saas-platform-admin-live-data.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Server data functions:

- `/internal/orgs`: `loadPlatformOrganizationsView()`
- `/internal/orgs/[id]`: `loadPlatformOrganizationDetailView(orgId)`
- `/internal/billing/events`: `loadPlatformBillingEventsView()`

DTO shapes:

- `/internal/orgs`: `PlatformAdminLiveDataResult<PlatformOrganizationListView>`
- `/internal/orgs/[id]`: `PlatformAdminLiveDataResult<PlatformOrganizationDetailView>`
- `/internal/billing/events`: `PlatformAdminLiveDataResult<PlatformBillingEventsView>`

State triggers:

- All three loaders call `requirePlatformAdminAccess()` first. If auth/admin role is missing or `multi_tenant_admin` is disabled, they return `gated` and do not query repositories.
- `/internal/orgs` returns `ready` with organizations plus monthly usage snapshots, `empty` when there are no orgs, and `error` for repository or DTO failures.
- `/internal/orgs/[id]` validates `orgId`, returns `ready` with organization detail plus usage and recent audit logs, `empty` for invalid/missing org id or not found, and `error` for repository or DTO failures.
- `/internal/billing/events` returns `ready` with billing events plus org names, `empty` when there are no events, and `error` for repository or DTO failures.

Notes:

- No `app/internal/**` UI page files were edited.
- UI pages should call the loaders from Server Components instead of calling API route handlers directly.
- No migration, env, deployment, production Supabase, or master branch operation was performed.

## 2026-05-22 Codex -> Claude

Added SaaS team invite API foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/team-invite-route.ts`
- `app/api/saas/team/invites/route.ts`
- `tests/unit/saas-team-invite-route.test.ts`

Updated:

- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added `POST /api/saas/team/invites` for future `/settings/team` UI wiring.
- The route requires authenticated SaaS org context, owner/admin role, and writable subscription status.
- It counts active/non-disabled members plus pending invites before calling the invite creation service.
- Success returns the created invite plus token so UI can support a manual copy-link flow until email sending is wired.
- No UI page was changed, no invite email was sent, no migration was run, and no platform setting was changed.

## 2026-05-21 Codex -> Claude

Phase B settings live data server loader is ready for UI handoff.

Commit:

```text
this commit
```

Files:

- `lib/saas/settings-live-data.ts`
- `tests/unit/saas-settings-live-data.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`

Server data functions:

- `/settings/billing`: `loadBillingSettingsView()`
- `/settings/usage`: `loadUsageSettingsView()`
- `/settings/team`: `loadTeamSettingsView()`

DTO shapes:

- `/settings/billing`: `SettingsLiveDataResult<BillingSettingsView>`
- `/settings/usage`: `SettingsLiveDataResult<UsageSettingsView>`
- `/settings/team`: `SettingsLiveDataResult<TeamSettingsView>`

State triggers:

- Billing `ready`: owner/admin org context plus `billing` feature flag, then repository rows validate through `buildBillingSettingsView()`.
- Billing `gated`: missing auth/membership, non-owner/admin role, or disabled billing feature.
- Usage `ready`: any SaaS org member with a valid usage DTO.
- Usage `gated`: missing auth or org membership.
- Team `ready`: any SaaS org member with a valid team DTO. Management actions are disabled for non-owner/admin roles or write-restricted org status.
- All three return `empty` when the org row is missing and `error` for repository/query/DTO failures.

Notes:

- No UI page files were edited.
- The default loader path uses the authenticated server Supabase client/RLS instead of service-role access.
- `saas:doctor` now checks that the settings loaders compose org context, repositories, and DTO builders without mock data or service-role defaults.
- Platform admin API DTO routes already exist: `handleListPlatformOrganizations()`, `handleGetPlatformOrganization()`, and `handleListPlatformBillingEvents()`.
- Gemini key remains deferred, so `saas:doctor:strict` / predeploy are still not expected to be fully green.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS invite creation service and RPC draft.

Commit:

```text
this commit
```

Added:

- `lib/saas/invite-creation.ts`
- `tests/unit/saas-invite-creation.test.ts`
- `supabase/migrations/032_saas_invite_creation_rpc.sql`

Updated:

- `tests/unit/saas-migration-plan.test.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added a pure invite creation use-case for the future `/settings/team` invite flow.
- The service validates email, admin/staff/viewer role, plan seat availability, token, and expiration before calling a repository write.
- Added draft `create_organization_invite` RPC for future atomic invite upsert plus `member.invited` audit log.
- Updated migration plan checks so the SaaS migration chain now ends at `032`.
- No migration was applied, no route was exposed, no UI file was changed, no invite was created, and no email was sent.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS invite acceptance RPC draft and repository wrapper.

Commit:

```text
this commit
```

Added:

- `supabase/migrations/031_saas_invite_acceptance_rpc.sql`

Updated:

- `lib/saas/invite-acceptance.ts`
- `tests/unit/saas-invite-acceptance.test.ts`
- `tests/unit/saas-migration-plan.test.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added draft `accept_organization_invite` RPC for future atomic invite acceptance.
- The draft validates invite id/org/email/role, locks the invite row, creates or updates membership, marks `accepted_at`, and records `member.invite_accepted` in `audit_logs`.
- Added local repository wrapper and RPC arg mapper; no live route uses it yet.
- Updated migration plan checks so the SaaS migration chain now ends at `031`.
- No migration was applied, no route was exposed, no UI file was changed, no invite was accepted, and no email was sent.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS invite acceptance service foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/invite-acceptance.ts`
- `tests/unit/saas-invite-acceptance.test.ts`

Updated:

- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added a pure invite acceptance use-case for the future `/invite/[token]` flow.
- The service validates token, signed-in user email, invite role, and lifecycle status before calling a repository write.
- The future write is represented as an injected repository interface so it can be backed by an atomic RPC after SaaS migrations are applied.
- No route was exposed, no UI file was changed, no Supabase client was created, no invite was accepted, no invite email was sent, and no migration was applied.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS invite token data repository foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/invite-token-data.ts`
- `tests/unit/saas-invite-token-data.test.ts`

Updated:

- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added a repository for future `/invite/[token]` live data lookup.
- The repository reads `organization_invites` by token and includes organization context for future invite acceptance screens.
- Invite acceptance remains policy-only: pending/accepted/expired and acceptable role checks reuse `lib/saas/invite-policy.ts`.
- No route was exposed, no UI file was changed, no invite was accepted, no invite email was sent, and no migration was applied.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS invite status policy foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/invite-policy.ts`
- `tests/unit/saas-invite-policy.test.ts`

Updated:

- `lib/saas/settings-team-data.ts`
- `lib/saas/settings-usage-data.ts`
- `tests/unit/saas-settings-team-data.test.ts`
- `tests/unit/saas-settings-usage-data.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Centralized invite status resolution for `pending`, `accepted`, `expired`, and `revoked`.
- Centralized acceptable invite roles as `admin`, `staff`, and `viewer`; `owner` invites stay rejected.
- Settings team and usage repositories now use the shared policy before live invite routes are exposed.
- No route was exposed, no UI file was changed, no migration was applied, and no invite email was sent.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS settings usage data repository foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/settings-usage-data.ts`
- `tests/unit/saas-settings-usage-data.test.ts`

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added a repository/input builder for future `/settings/usage` live data wiring.
- The data layer reads organization plan, reserved seats, monthly return count, and monthly successful non-cached return AI usage.
- The monthly window is UTC first-of-month to first-of-next-month, matching AI quota counting.
- No route was exposed, no UI file was changed, no migration was applied, and no external platform operation was added.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS settings team data repository foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/settings-team-data.ts`
- `tests/unit/saas-settings-team-data.test.ts`

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added a repository/input builder for future `/settings/team` live data wiring.
- The data layer reads organization plan, organization members, and organization invites.
- Invite status is derived from `accepted_at` and `expires_at` so pending invites can reserve seats before invite routes are exposed.
- No route was exposed, no UI file was changed, no migration was applied, and no invite email or platform operation was added.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS settings billing data repository foundation.

Commit:

```text
this commit
```

Added:

- `.gitignore`
- `lib/saas/settings-billing-data.ts`
- `tests/unit/saas-settings-billing-data.test.ts`

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added a repository/input builder for future `/settings/billing` live data wiring.
- The data layer reads organization billing fields, subscription period/provider fields, and the latest invoice summary by `org_id`.
- `buildBillingSettingsViewInput()` returns the validated input shape consumed by `buildBillingSettingsView()`.
- Ignored local `.codex-logs/` output so generated agent logs do not pollute the shared checkout.
- No route was exposed, no UI file was changed, no migration was applied, and no billing provider was enabled.

## 2026-05-21 Codex -> Claude / Codex

Aligned SaaS invoice statuses between schema draft and billing settings DTOs.

Commit:

```text
this commit
```

Added:

- `supabase/migrations/030_saas_invoice_status_alignment.sql`

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `tests/unit/saas-migration-plan.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/CODEX_NON_UI_SCOPE.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added draft migration `030` to align `invoices.status` with the billing settings DTO contract.
- Allowed invoice statuses are now `draft`, `issued`, `paid`, `failed`, and `void`.
- Migration plan and setup docs now expect the full `001_*` through `030_*` chain.
- No migration was applied, no billing provider was enabled, and no external platform setting was changed.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS billing event status schema draft.

Commit:

```text
this commit
```

Added:

- `supabase/migrations/029_saas_billing_event_status.sql`

Updated:

- `lib/saas/billing.ts`
- `lib/saas/platform-admin-data.ts`
- `scripts/saas/check-migration-plan.mjs`
- `scripts/saas/check-saas-schema-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/saas-billing-foundation.test.ts`
- `tests/unit/saas-migration-plan.test.ts`
- `tests/unit/saas-schema-readiness.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/CODEX_NON_UI_SCOPE.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added draft migration `029` for `billing_events.status` with `received`, `processed`, `failed`, and `ignored`.
- Backend billing event records now default to `status='received'`, matching the platform admin billing event contract.
- Migration plan and schema readiness checks now expect the full migration chain. Current chain ends at `030`.
- No migration was applied, no billing provider was enabled, and no external platform setting was changed.

## 2026-05-21 Codex -> Claude / Codex

Expanded SaaS schema readiness gate coverage for commercial v2 columns.

Commit:

```text
this commit
```

Added:

- `tests/unit/saas-schema-readiness.test.ts`

Updated:

- `scripts/saas/check-saas-schema-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Strict schema gate now checks the commercial columns already defined by the SaaS migration drafts, including organization onboarding/billing/upgrade suggestion fields, subscription provider/period fields, invite token fields, invoice fields, and audit metadata.
- Non-strict schema gate behavior is unchanged for local development without SaaS DB env.
- No migration was applied and no Supabase data was changed.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS return usage soft-limit policy.

Commit:

```text
this commit
```

Added:

- `lib/saas/return-usage-policy.ts`
- `tests/unit/saas-return-usage-policy.test.ts`

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Return usage warnings now come from one backend policy for 80% and 100% of `org.plan.monthlyReturnSoftLimit`.
- Return volume remains non-blocking; the policy always reports `shouldBlockOperations=false`.
- Added a pure resolver for future month-end upgrade suggestions after two consecutive over-limit months.
- No UI page, route write, DB query, migration, billing charge, or platform operation was added.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS subscription lifecycle timing policy.

Commit:

```text
this commit
```

Added:

- `lib/saas/subscription-lifecycle.ts`
- `tests/unit/saas-subscription-lifecycle.test.ts`

Updated:

- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added pure local resolver for timed subscription status transitions.
- Covered trial expiration via `trialEnd`, `cancelAtPeriodEnd`, `past_due` 7-day grace, and `suspended` 30-day retention.
- The resolver does not write to Supabase and does not expose a route; future billing cron/webhook code can use it after migrations are approved.

## 2026-05-21 Codex -> Claude / Codex

Added SaaS team seat limit policy for backend DTOs.

Commit:

```text
this commit
```

Added:

- `lib/saas/team-limits.ts`
- `tests/unit/saas-team-limits.test.ts`

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Team seat usage now counts active/non-disabled members plus pending invites as reserved seats.
- `buildTeamSettingsView()` forces `actions.canInvite=false` when the plan seat limit is full.
- Enterprise remains unlimited because its seat limit is `null`.
- No live team invite route was exposed and no DB query or migration was added.

## 2026-05-21 Codex -> Claude / Codex

Hardened SaaS export subscription guards.

Commit:

```text
this commit
```

Updated:

- `lib/saas/org-context.ts`
- `app/api/v1/admin/returns/export/route.ts`
- `app/api/v1/admin/shopee-returns/export/route.ts`
- `app/api/v1/admin/pickup/export/route.ts`
- `tests/unit/saas-org-context.test.ts`
- `tests/unit/saas-runtime-org-isolation.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added `exportable` to SaaS org context requirements.
- Admin export APIs now require `exportable: true`.
- `past_due`, `suspended`, and `cancelled` organizations cannot use export APIs.
- No UI files, migrations, or external platform state were changed.

## 2026-05-21 Codex -> Claude / Codex

Hardened SaaS subscription access policy.

Commit:

```text
this commit
```

Added:

- `lib/saas/subscription-access.ts`
- `tests/unit/saas-subscription-access.test.ts`

Updated:

- `lib/saas/org-context.ts`
- `tests/unit/saas-org-context.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Centralized subscription access rules for `trialing`, `active`, `past_due`, `suspended`, and `cancelled`.
- `past_due` is now read-only for `writable` guards, matching the product spec: users can log in, view data, and manage billing, but cannot create data, use AI, or export.
- No routes, migrations, or external platform state were changed.

## 2026-05-21 Codex -> Claude / Codex

Added a read-only SaaS migration apply plan check.

Commit:

```text
this commit
```

Added:

- `scripts/saas/check-migration-plan.mjs`
- `tests/unit/saas-migration-plan.test.ts`

Updated:

- `package.json`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- New scripts: `npm run saas:migration-plan` and `npm run saas:migration-plan:strict`.
- The check validates `APP_MODE=saas`, expected SaaS Supabase project ref, forbidden internal project refs, `SUPABASE_DB_PASSWORD`, and the full migration chain. Current chain ends at `029`.
- The script is intentionally read-only and prints that no migrations were applied.
- Strict mode should remain blocked until `SUPABASE_DB_PASSWORD` is available.

## 2026-05-21 Codex -> Claude / Codex

Added settings UI/backend DTO builders for the contracts Claude already uses in settings pages.

Commit:

```text
this commit
```

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added `buildBillingSettingsView()` for `/settings/billing` contract validation.
- Added `buildTeamSettingsView()` for `/settings/team` contract validation.
- The builders normalize plan, organization status, billing provider, invoice status, team roles, member status, and invite status.
- Owner invites are rejected at the contract layer.
- No routes were exposed, no DB queries were added, and no UI files were changed.

## 2026-05-21 Codex -> Claude / Codex

Added the manual Beta organization provisioning backend foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/platform-admin-provisioning.ts`
- `supabase/migrations/028_saas_manual_beta_org_provisioning.sql`

Updated:

- `app/api/internal/saas/orgs/route.ts`
- `tests/unit/saas-platform-admin-routes.test.ts`
- `supabase/migrations/027_saas_platform_admin_read_model.sql`
- `scripts/saas/check-saas-schema-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- `POST /api/internal/saas/orgs` is platform-admin gated and remains closed while `ENABLE_MULTI_TENANT_ADMIN=false`.
- The route validates manual Beta org requests before calling the provisioning repository.
- The repository calls a draft RPC, `create_manual_beta_organization`.
- `028` creates the org, optional owner membership, trialing manual subscription, and audit log atomically in SQL.
- No Supabase migration was applied and no data was changed.

## 2026-05-21 Codex -> Claude / Codex

Added the platform admin read model migration draft.

Commit:

```text
this commit
```

Added:

- `supabase/migrations/027_saas_platform_admin_read_model.sql`

Updated:

- `scripts/saas/check-saas-schema-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- Platform admin APIs already read `organizations.owner_email` and `organizations.member_count`.
- `027` aligns the migration draft with those API read columns and adds a trigger to refresh `member_count` from `organization_members`.
- The schema readiness gate now checks those columns.
- No Supabase migration was applied and no data was changed.

## 2026-05-21 Codex -> Claude / Codex

Added local ECPay CheckMacValue verification for the billing webhook.

Commit:

```text
this commit
```

Updated:

- `lib/saas/billing.ts`
- `app/api/billing/ecpay/webhook/route.ts`
- `tests/unit/saas-billing-foundation.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- The default webhook route now verifies `CheckMacValue` before writing `billing_events`.
- The implementation follows the ECPay All-In-One checksum flow: sort parameters, exclude `CheckMacValue`, wrap with `HashKey` / `HashIV`, URL encode, lower-case, SHA256, upper-case compare.
- Unit tests include ECPay's published payment-notification checksum example.
- Billing still remains disabled by `ENABLE_BILLING=false`; no ECPay credentials were added and no payment API was called.

## 2026-05-21 Codex -> Claude / Codex

Added a SaaS schema readiness gate without applying migrations.

Commit:

```text
this commit
```

Added:

- `scripts/saas/check-saas-schema-readiness.mjs`

Updated:

- `package.json`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- New scripts: `npm run saas:schema-gate` and `npm run saas:schema-gate:strict`.
- The gate checks the SaaS Supabase schema for 023-026 foundation tables and `org_id` columns needed by tenant isolation, signup persistence, billing events, and platform admin live data.
- Non-strict mode reports readiness without blocking local development.
- Strict mode is expected to fail until the SaaS migrations are approved and applied.
- No migration was applied and no Supabase data was changed.

## 2026-05-21 Codex -> Claude / Codex

Wired public signup request persistence without opening public signup.

Commit:

```text
this commit
```

Added:

- `lib/saas/signup-request-repository.ts`
- `supabase/migrations/026_saas_public_signup_requests.sql`

Updated:

- `lib/saas/signup-request.ts`
- `app/api/saas/signup/route.ts`
- `tests/unit/saas-public-signup-request.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- `ENABLE_PUBLIC_SIGNUP=false` still blocks validation and persistence before any DB client is created.
- If the flag is explicitly enabled, valid Basic-only signup requests persist to `signup_requests`.
- `026` is a migration draft only. It was not applied to Supabase.
- Signup creates a request record only; it does not create an organization or subscription yet.

## 2026-05-21 Codex -> Claude / Codex

Added the billing foundation without enabling real billing.

Commit:

```text
this commit
```

Added:

- `lib/saas/billing.ts`
- `app/api/billing/ecpay/webhook/route.ts`
- `tests/unit/saas-billing-foundation.test.ts`

Updated:

- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- ECPay webhook route returns 404 while `ENABLE_BILLING=false`.
- If billing is enabled, it still requires `BILLING_PROVIDER=ecpay` and complete ECPay credentials.
- Even with credentials, it rejects requests unless signature verification is explicitly provided.
- Verified events are inserted into `billing_events` with provider/event idempotency handling.
- No provider credentials were added, no payment API was called, and no migrations were applied.

## 2026-05-21 Codex -> Claude / Codex

Hardened AI quota enforcement for SaaS plans.

Commit:

```text
this commit
```

Added:

- `lib/saas/ai-quota.ts`
- `tests/unit/saas-ai-quota.test.ts`

Updated:

- `app/api/v1/ai/analyze/route.ts`
- `tests/unit/saas-runtime-org-isolation.test.ts`

Notes:

- Return AI analysis now checks monthly usage before Gemini provider calls.
- Quota source is `org.plan` via `planDefinition.aiMonthlyLimit`.
- Counted usage is non-cached, successful `return_ai_analysis` events for the current UTC month.
- Cached report reuse remains allowed and records a cached usage event without consuming quota.
- Enterprise remains unlimited, and `ai_usage_limit=false` remains a kill switch for the hard limit.

## 2026-05-21 Codex -> Claude / Codex

Wired platform admin internal APIs to backend DTO contracts.

Commit:

```text
this commit
```

Updated:

- `app/api/internal/saas/orgs/route.ts`
- `app/api/internal/saas/orgs/[id]/route.ts`
- `app/api/internal/saas/billing/events/route.ts`
- `lib/saas/platform-admin-data.ts`
- `tests/unit/saas-platform-admin-routes.test.ts`

Notes:

- Organization list/detail and billing-event APIs now return DTOs aligned with `UI_BACKEND_CONTRACTS.md`.
- Platform organization DTOs require repository-provided usage snapshots; missing usage returns a server error instead of fake production data.
- Billing event status is derived from `processed_at` when the current migration schema has no `status` column.
- Routes remain protected by `requirePlatformAdminAccess()` and the `multi_tenant_admin` feature flag.
- No migrations were applied and no external platform settings were changed.

## 2026-05-21 Codex -> Claude / Codex

Converted UI mock contracts into backend DTO code.

Commit:

```text
this commit
```

Added:

- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`

Notes:

- Platform admin list/detail/billing event UI shapes now have backend DTO builders.
- Usage settings warnings are derived from `org.plan` limits.
- Platform organization DTO builders require real usage snapshots and throw when they are missing.
- No live backend route was exposed or rewired in this change.
- Migrations and external platform operations remain blocked until explicit approval and SaaS DB password are available.

## 2026-05-21 Codex -> Claude / Codex

Resolved the shared-folder collision model.

Decision:

- `agent-shared/**` is Codex-maintained only.
- Claude may read `agent-shared/**`, but should not edit it.
- Claude reports task scope, changed files, gates, and blockers in chat or commit messages.
- Codex records durable coordination notes in `ACTIVE_WORK.md`, `HANDOFF_LOG.md`, and `TASK_BOARD.md`.
- In one shared working tree, prefer serialized work: one agent finishes, commits, and pushes before the next starts.
- For true parallel work, use separate git worktrees or separate branches.

Reason:

- `ACTIVE_WORK.md` is a soft coordination log, not a git lock.
- If both agents edit the same claim file, the claim itself can be overwritten.
- Single-writer ownership for `agent-shared/**` removes that failure mode.

## 2026-05-21 Codex -> Claude / Codex

Cleaned up `agent-shared` coordination files into terminal-stable English and added UI/backend contracts.

Added:

- `agent-shared/UI_BACKEND_CONTRACTS.md`

Updated:

- `README.md`
- `CLAUDE_UI_SCOPE.md`
- `CODEX_NON_UI_SCOPE.md`
- `TASK_BOARD.md`
- `ACTIVE_WORK.md`
- `HANDOFF_LOG.md`

Intent:

- Claude can continue UI polish without guessing backend ownership.
- Codex can wire backend DTOs against explicit UI contracts.
- Terminal encoding issues in shared docs are reduced.

## 2026-05-21 Claude -> Codex

Task 3 safe subset and Task 5 RWD audit completed.

Commit:

```text
f0a937a feat(saas/ui): add shared page header and RWD audit
```

Files:

- `components/saas/page-header.tsx`
- `app/(admin)/logistics/page.tsx`
- `app/(admin)/settings/page.tsx`

Notes:

- UI-only.
- Large client-heavy admin pages were deferred to avoid collision with backend work.

## 2026-05-20 Claude -> Codex

Task 1 + 2 partial completed: SaaS settings and platform admin UI polish.

Commit:

```text
f216cc8 feat(saas/ui): polish settings and platform admin pages
```

Files:

- `components/saas/demo-data-banner.tsx`
- `components/saas/usage-progress.tsx`
- `components/internal/nav-link.tsx`
- `app/(admin)/settings/billing/page.tsx`
- `app/(admin)/settings/usage/page.tsx`
- `app/(admin)/settings/team/page.tsx`
- `app/internal/layout.tsx`
- `app/internal/orgs/page.tsx`
- `app/internal/orgs/[id]/page.tsx`
- `app/internal/billing/events/page.tsx`

Gate:

- safety passed
- lint passed with existing warnings only
- typecheck passed
- test suites passed
- build passed

## 2026-05-20 Claude -> Codex

Task 4 first wave completed: empty, loading, and error states.

Commit:

```text
927bf1a feat(saas/ui): add loading error and not-found states
```

Files:

- `app/not-found.tsx`
- `app/(admin)/loading.tsx`
- `app/(admin)/error.tsx`
- `app/(admin)/returns/loading.tsx`
- `app/(admin)/returns/[id]/loading.tsx`
- `app/(admin)/shopee-returns/loading.tsx`
- `app/(admin)/shopee-returns/[id]/loading.tsx`
- `app/(customer)/portal/loading.tsx`
- `app/(customer)/portal/error.tsx`

Notes:

- UI-only.
- No data layer changes.

## 2026-05-20 Codex -> Claude

Clarified Claude/Codex split edge cases.

Decisions:

- `page.tsx` UI may change, but data fetching, query shape, auth guards, and redirects are Codex-owned.
- Components may change display and handlers, but server action implementation is Codex-owned.
- `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, and `opengraph-image.tsx` are UI-owned.
- Root config files are Codex-owned.
- Authenticated SaaS app pages stay in `app/(admin)` for now.
- Mock data must be clearly marked.

## 2026-05-20 Codex -> Claude / Codex

Created the shared coordination folder.

Commit:

```text
92dcdd5 docs(saas): add shared agent workspace
```

The shared workspace defines:

- Claude UI ownership.
- Codex non-UI ownership.
- Task board.
- Active work lock convention.
- Handoff log.
