# Active Work

Use this file to avoid Claude / Codex editing the same files at the same time.

This file is Codex-maintained. Claude should not edit it directly; Claude should declare task scope in the chat or commit message, and Codex records it here after handoff.

This is a coordination log, not a hard git lock. In one shared working tree, prefer serialized work: one agent finishes, commits, and pushes before the next agent starts.

Update format:

```text
Owner:
Started:
Scope:
Files:
Status:
Notes:
```

## Current

```text
Owner: none
Started:
Scope:
Files:
Status:
Notes: Closed Manual Beta is live and the first Beta customer has been provisioned. Latest production hotfix is `a3af638 fix(saas): keep onboarding guide available on legacy policy recursion` -> Vercel deployment `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` (Ready), aliased to `https://smart-return-system-saas.vercel.app`. It keeps `/onboarding` available when the optional return-policy signal hits legacy `users` RLS recursion. Sentry DSN is still not configured because no real DSN is available locally or in Vercel env. Beta/custom domain, email delivery provider, Billing/ECPay, and draft migrations 033-036 remain owner-blocked. Do not deploy again, run migrations, edit env/secrets, enable billing/provider, touch master/live/prod, or use production/internal Supabase without explicit owner authorization.
```

## Recent Completed

```text
Owner: Codex
Commit: this commit
Scope: Platform admin canonical entry routes
Files:
- app/admin/page.tsx
- app/admin/login/page.tsx
- lib/auth/public-routes.ts
- lib/auth/internal-login-redirect.ts
- proxy.ts
- scripts/saas/readiness-check.mjs
- tests/unit/internal-login-redirect.test.ts
- tests/unit/public-routes.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added `/admin` as the operator-facing platform admin entry and `/admin/login` as the platform-admin login alias. `/admin/login` is public so unauthenticated operators can reach the shared login form. Proxy-level unauthenticated `/admin` and `/internal/*` access now redirects to `/admin/login?next=...`, while merchant users remain routed to `/analytics` and authenticated non-admin internal access remains forbidden. Claude owns the visual login/forbidden/sidebar copy polish that explains the account switch clearly. No deployment, migration, env/secret edit, billing/provider enablement, or master/live/prod change was performed.
```

```text
Owner: Codex
Commit: a3af638
Scope: Onboarding guide legacy RLS recursion hotfix
Files:
- lib/saas/onboarding-live-data.ts
- tests/unit/saas-onboarding-live-data.test.ts
Status: done
Notes: Optional return-policy signal lookup now treats legacy `system_settings` -> `users` RLS recursion as an incomplete signal instead of failing the whole onboarding page. Deployed to Vercel production deployment `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`; unauthenticated `/onboarding` still redirects to `/login`. No migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Latest HEAD production deployment record
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Recorded owner-authorized deployment of latest develop-saas HEAD `c699e70` to Vercel production deployment `dpl_9KFNXG1Cw6k54uvSJNuruJchDb5H`. Predeploy gates passed, deployment is Ready, public routes returned 200, and protected unauthenticated routes redirected to /login. Sentry DSN remains missing because no real DSN value is available; no migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Latest deploy readiness status refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Read-only refresh recorded that `develop-saas` is synced at `4a1d7f8`, latest HEAD includes Claude UI improvements through `615ce7c`, and production still remains on Ready deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` until owner authorizes deploying latest HEAD. Sentry DSN, beta/custom domain, email provider delivery, Billing/ECPay, and draft migrations `033`-`036` remain owner-blocked. No deploy, migration, env/secret edit, domain/DNS change, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Claude
Commit: 615ce7c
Scope: Marketing mobile navigation drawer
Files:
- components/marketing/mobile-nav.tsx
- components/marketing/site-shell.tsx
Status: done
Notes: MarketingShell now exposes a mobile drawer below md for public links, legal links, and login while keeping the existing desktop nav and sticky conversion CTA. UI-only; no backend, route, persistence, billing, migration, env, or deploy changes were reported.
```

```text
Owner: Claude
Commit: 60e702d
Scope: Onboarding next-step focus card
Files:
- app/(admin)/onboarding/page.tsx
Status: done
Notes: /onboarding now surfaces the current setup step above the progress card from loadSaaSOnboardingView(), reusing existing step metadata and the existing completion button path. UI-only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported. Completion writes still depend on explicit migration 035 apply before production enablement.
```

```text
Owner: Claude
Commit: 64e6345
Scope: Billing trial countdown and cancellation banners
Files:
- app/(admin)/settings/billing/page.tsx
Status: done
Notes: /settings/billing now shows prominent trial countdown and cancel-at-period-end banners from existing BillingSettingsView fields. UI-only; no loader/contract/backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: 0dc1fcb
Scope: Settings sub-page PageHeader consistency
Files:
- app/(admin)/settings/billing/page.tsx
- app/(admin)/settings/team/page.tsx
- app/(admin)/settings/usage/page.tsx
Status: done
Notes: Settings billing, team, and usage pages now share the PageHeader component for consistent title/description/action layout. UI refactor only; no copy, backend, contract, auth, API, migration, env, or deploy changes were reported.
```

```text
Owner: Claude
Commit: e8fa91f
Scope: Platform at-risk and health label localization
Files:
- app/internal/page.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- components/internal/platform-labels.ts
Status: done
Notes: Platform dashboard and org views now localize org status, risk level, risk reasons, and alert severity labels while using existing DTO fields. UI/label-only; no backend, contract, route, migration, env, billing, or deployment changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: External rollout blocker refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Read-only Vercel check confirmed deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` remains Ready, production URL remains `https://smart-return-system-saas.vercel.app`, no custom domains are configured, `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are absent, ECPay env values are absent, email delivery remains dry-run, draft migrations `033`-`036` remain unapplied, and no deploy/env/domain/billing/provider/migration/master/live/prod change was performed.
```

```text
Owner: Claude
Commit: 85f65bd
Scope: Tenant preview start button UI
Files:
- app/internal/orgs/[id]/page.tsx
- components/internal/start-tenant-preview-button.tsx
Status: done
Notes: Platform org detail now exposes a client action button that POSTs /api/internal/saas/orgs/[id]/preview, then routes to the returned previewPath so the tenant preview banner can render. UI/route-consumption only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: da23eff
Scope: Tenant preview banner UI
Files:
- app/(admin)/template.tsx
- components/saas/tenant-preview-banner.tsx
- components/saas/tenant-preview-exit-button.tsx
Status: done
Notes: Tenant pages now render a read-only orange preview banner from loadPlatformTenantPreviewMode() and expose a client exit button wired to DELETE /api/internal/saas/tenant-preview. UI/composition only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: 1924065
Scope: Onboarding progress banner
Files:
- app/(admin)/template.tsx
- components/saas/onboarding-progress-banner.tsx
Status: done
Notes: Tenant pages now show a slim onboarding progress banner from loadSaaSOnboardingView() until onboarding is complete. UI/composition only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: f46c344
Scope: Onboarding sidebar entry
Files:
- app/(admin)/layout.tsx
Status: done
Notes: Tenant sidebar now surfaces `/onboarding` as `設定指引` with a Compass icon. UI/navigation only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform tenant preview audit trail
Files:
- lib/saas/platform-tenant-preview.ts
- app/api/internal/saas/orgs/[id]/preview/route.ts
- app/api/internal/saas/tenant-preview/route.ts
- tests/unit/saas-platform-tenant-preview.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added audit_logs coverage for platform tenant preview start/clear events. Start requires the audit write before returning the signed cookie. Clear deletes the cookie even if the audit insert fails, with the failure logged server-side, so admins are not trapped in preview mode. No UI, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform tenant preview backend contract
Files:
- lib/saas/platform-tenant-preview.ts
- app/api/internal/saas/orgs/[id]/preview/route.ts
- app/api/internal/saas/tenant-preview/route.ts
- tests/unit/saas-platform-tenant-preview.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/WORK_SPLIT_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a signed, one-hour platform tenant preview cookie and guarded internal start/get/clear routes for future Claude UI. It requires platform admin view_organizations permission and organization lookup before issuing the cookie. The preview session is intentionally not wired into getOrgContext() or tenant write permissions. No UI, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin role management backend foundation
Files:
- lib/saas/platform-admin-role-management.ts
- app/api/internal/saas/platform-admins/route.ts
- tests/unit/saas-platform-admin-role-management.test.ts
- supabase/migrations/036_saas_platform_admin_roles.sql
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/WORK_SPLIT_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added an owner-gated platform admin role management contract for future internal admin UI. It lists/upserts/disables platform admin role assignments through a service-role repository and draft RPC, with audit-log metadata. Migration 036 was not applied, the live guard remains on the existing admin/profile/env role source, and no UI, deployment, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Onboarding live data loader contract
Files:
- lib/saas/onboarding-live-data.ts
- tests/unit/saas-onboarding-live-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/WORK_SPLIT_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added loadSaaSOnboardingView() and an org-scoped onboarding signal repository for future Claude onboarding UI. It reads organization profile, return policy, team setup, first return, and AI review signals without serving mock data. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Claude
Commit: 8a5a6dc
Scope: Platform billing events copy polish
Files:
- app/internal/billing/events/page.tsx
Status: done
Notes: /internal/billing/events copy no longer uses Stage 2 or schema-source wording, while keeping operator-relevant guard requirements. UI/copy only; no backend/auth/contract/test/deploy changes were reported.
```

```text
Owner: Claude
Commit: f5d8171
Scope: Platform admin org pages copy polish
Files:
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
Status: done
Notes: /internal/orgs and org detail copy now use operator-facing wording and remove schema/table helper text. UI/copy only; no backend/auth/contract/test/deploy changes were reported.
```

```text
Owner: Claude
Commit: 9edf220
Scope: Platform Admin Mode floating indicator
Files:
- app/(admin)/template.tsx
- components/saas/platform-admin-mode-indicator.tsx
Status: done
Notes: Tenant admin pages now render a server-fetched Platform Admin Mode indicator from loadPlatformAdminModeView(). UI/composition only; no backend/auth/contract/test/deploy changes were reported.
```

```text
Owner: Claude
Commit: ee474ed
Scope: Platform admin dashboard visual polish
Files:
- app/internal/page.tsx
- app/internal/layout.tsx
- components/internal/nav-link.tsx
Status: done
Notes: /internal now renders the Codex loadPlatformAdminDashboardView() contract with KPI cards, at-risk alerts, trial follow-up, billing summary, recent billing events, and gated/empty/error states. UI/nav only; no backend/auth/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: Onboarding completion API route contract
Files:
- lib/saas/onboarding-route.ts
- app/api/saas/onboarding/complete/route.ts
- tests/unit/saas-onboarding-route.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a guarded owner/admin writable-org onboarding completion API wrapper for Claude onboarding UI handoff. The route reuses completeSaaSOnboarding() and stable JSON error mapping. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed. Migration 035 still needs explicit approval/apply before production UI enables completion writes.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS doctor coverage for role separation contracts
Files:
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: saas:doctor now checks the role-aware login redirect contract, internal admin login redirect helper, platform admin mode contract, and platform dashboard live-data contract. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin dashboard backend contract
Files:
- lib/saas/ui-backend-contracts.ts
- lib/saas/platform-admin-live-data.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added loadPlatformAdminDashboardView() for Claude-owned /internal dashboard UI. The contract combines organization KPI, at-risk alerts, trial conversion follow-up, and billing event summaries from real platform repositories without exposing customer return details. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin mode backend contract
Files:
- lib/saas/platform-admin-mode.ts
- tests/unit/saas-platform-admin-mode.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added loadPlatformAdminModeView() for Claude-owned admin mode indicator UI. The contract reports ready platform admin identity, role, permissions, internal links, and whether the internal console flag is enabled; unauthenticated or non-admin users get hidden state. No UI component, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Internal admin unauthenticated redirect contract
Files:
- lib/auth/internal-login-redirect.ts
- lib/auth/post-login-redirect.ts
- lib/actions/auth.ts
- app/login/page.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- app/internal/billing/events/page.tsx
- lib/saas/platform-admin-live-data.ts
- tests/unit/internal-login-redirect.test.ts
- tests/unit/post-login-redirect.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Unauthenticated /internal page access redirects to /login?next=<internal path>. Authenticated non-admin users still receive gated/forbidden state for Claude UI treatment. Login accepts a safe requestedPath but rejects external, protocol-relative, login, backslash, and unauthorized /internal redirects. No visual redesign, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Role-based post-login redirect contract
Files:
- lib/auth/post-login-redirect.ts
- lib/actions/auth.ts
- app/login/page.tsx
- tests/unit/post-login-redirect.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: signIn() now returns redirectTo so platform admins land on /internal and merchant users land on /analytics. The login page only consumes this backend result; no visual UI redesign, deployment, migration, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Closed Manual Beta post-deploy smoke documentation
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/MANUAL_BETA_LAUNCH_DECISION_CHECKLIST.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/TASK_BOARD.md
Status: done
Notes: Verified production URL `https://smart-return-system-saas.vercel.app` public routes return 200, protected unauthenticated routes redirect to `/login`, and Vercel deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` remains Ready. No deployment, migration, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed by this review.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS remaining-work and blocker documentation refresh
Files:
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Reconciled the post-b3f045e state: Manual Beta backend/readiness/predeploy consistency gate is complete, email_queue remains dry-run/CRON_SECRET-gated, AI analytics consistency fallback is complete, Claude's next UI scope is public marketing/legal RWD inspection, and public rollout is blocked only by external setup/approval items. No migration, deployment, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was made.
```

```text
Owner: Codex
Commit: this commit
Scope: Manual Beta smoke and consistency gate hardening
Files:
- scripts/predeploy/check-ai-analytics-consistency.mjs
- tests/unit/ai-analytics-consistency.test.mts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Verified local Manual Beta auth/data smoke for beta owner and invitee paths, exports, AI analyze, invite acceptance, settings, returns, and platform admin read pages. Hardened the AI analytics predeploy consistency check so SaaS DBs without optional legacy Shopee date columns still pass while non-schema query errors remain fatal. No migration, provider call, deployment, env secret output, master, or production/internal Supabase change was made.
```

```text
Owner: Codex
Commit: this commit
Scope: Email queue worker dry-run contract
Files:
- lib/saas/email-queue-worker.ts
- app/api/cron/saas/email-queue/route.ts
- tests/unit/saas-email-queue-worker.test.ts
- scripts/maintenance/cron-drill.mjs
- scripts/saas/readiness-check.mjs
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added CRON_SECRET-gated dry-run email_queue inspection for due queued records. The endpoint rejects dryRun=false and does not send email, mutate queue rows, call a provider, apply migrations, deploy, or change env/platform settings.
```

```text
Owner: Codex
Commit: this commit
Scope: Onboarding backend foundation
Files:
- lib/saas/onboarding.ts
- supabase/migrations/035_saas_onboarding_completion_rpc.sql
- tests/unit/saas-onboarding.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added onboarding progress DTO builder plus owner/admin writable-org completion service and RPC wrapper. Draft migration 035 updates organizations.onboarding_completed_at and writes audit_logs. No route, UI change, migration apply, deployment, env, email, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Notification backend foundation
Files:
- lib/saas/notifications.ts
- supabase/migrations/034_saas_notification_email_queue.sql
- tests/unit/saas-notifications.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added queue-only builders and repository wrapper for billing failure, AI quota reached, trial ending, and platform announcements. Draft migration 034 extends notifications and adds email_queue. No email provider, migration apply, DB write, deployment, env, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin role model
Files:
- lib/saas/platform-admin-roles.ts
- lib/saas/platform-admin.ts
- lib/saas/platform-admin-live-data.ts
- app/api/internal/saas/orgs/route.ts
- app/api/internal/saas/orgs/[id]/route.ts
- app/api/internal/saas/billing/events/route.ts
- app/api/internal/saas/billing/events/[id]/retry/route.ts
- app/api/internal/saas/billing/operations/route.ts
- tests/unit/saas-platform-admin.test.ts
- tests/unit/saas-platform-admin-routes.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- tests/unit/saas-platform-admin-billing-operations.test.ts
- tests/unit/saas-billing-reconciliation.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added owner/support/billing platform admin role policy and route-level permission gates. Existing single-admin sessions default to owner; optional PLATFORM_ADMIN_ROLES can narrow specific admins by email or user id. No DB migration, env change, deployment, provider call, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Billing event retry and reconciliation design
Files:
- lib/saas/billing-reconciliation.ts
- app/api/internal/saas/billing/events/[id]/retry/route.ts
- tests/unit/saas-billing-reconciliation.test.ts
- docs/SAAS_BILLING_RETRY_RECONCILIATION_SOP.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added dry-run retry eligibility and reconciliation issue contracts before any UI retry button is enabled. Provider replay remains disabled; no provider API call, DB mutation, audit write, migration, email, deployment, env, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin billing operation backend plan
Files:
- lib/saas/platform-admin-billing-operations.ts
- app/api/internal/saas/billing/operations/route.ts
- supabase/migrations/033_saas_platform_billing_operations.sql
- tests/unit/saas-platform-admin-billing-operations.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added a platform-admin-gated billing operations contract for manual payment marking, suspend/resume, and refund request audit logging. The RPC migration is a draft only; no migration, provider payment, email, deployment, env, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin trial conversion backend contract
Files:
- lib/saas/platform-admin-data.ts
- lib/saas/platform-admin-live-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added read-only PlatformTrialConversionView and loadPlatformTrialConversionView for trialing, converted active, expired trial, and onboarding incomplete counts. No route, migration, DB write, email, deployment, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin at-risk alert backend contract
Files:
- lib/saas/platform-admin-data.ts
- lib/saas/platform-admin-live-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- tests/unit/saas-platform-admin-routes.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added read-only PlatformAtRiskAlertsView and loadPlatformAtRiskAlertsView for billing, quota, team-seat, and trial expiry signals. No route, migration, DB write, billing provider action, email, deployment, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Claude/Codex work split plan
Files:
- agent-shared/WORK_SPLIT_PLAN.md
- agent-shared/README.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added the owner-requested split: Claude owns UI/UX/page polish; Codex owns backend, data, security, billing, APIs, tests, docs, coordination, and Git. No runtime behavior changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Record Claude UI completion handoff
Files:
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Recorded Claude's report that customer portal SaaS polish, returns dashboard visual polish, and mobile responsive QA follow-up are complete. The mobile QA used 390x844 Chrome emulation for /, /pricing, and /invite/[token]. No product code changed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS rollout readiness check
Files:
- package.json
- scripts/saas/check-rollout-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-rollout-readiness.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a read-only rollout gate and wired it into saas:predeploy in non-strict mode. The check validates SaaS project safety, Gemini key, NEXT_PUBLIC_APP_URL/domain readiness, AI safety flags, billing credential readiness, and Sentry/logging status. It does not change env, DB, Vercel, Supabase, billing, production, or master.
```

```text
Owner: Codex
Commit: this commit
Scope: Shared coordination and external setup status sync
Files:
- agent-shared/TASK_BOARD.md
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Recorded Claude invite acceptance UI completion, confirmed migration-plan strict and schema-gate strict pass through chain 032, and narrowed the remaining strict blocker to missing/placeholder GEMINI_API_KEY. No runtime behavior, env/secret, migration, deployment, production Supabase, or master branch operation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Invite acceptance live data loader and accept route
Files:
- lib/saas/invite-acceptance-live-data.ts
- lib/saas/invite-accept-route.ts
- app/api/saas/invite/accept/route.ts
- tests/unit/saas-invite-acceptance-live-data.test.ts
- tests/unit/saas-invite-accept-route.test.ts
- lib/auth/route-auth.ts
- scripts/saas/readiness-check.mjs
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/TASK_BOARD.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added /invite/[token] page loader with viewer state plus POST /api/saas/invite/accept using the invite acceptance service and RPC wrapper. No UI page was changed, no email was sent, no migration was run, no env/secret was changed, and no deployment was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin page-level live data loaders
Files:
- lib/saas/platform-admin-live-data.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/TASK_BOARD.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added /internal/orgs, /internal/orgs/[id], and /internal/billing/events page loaders that call requirePlatformAdminAccess before service-role repository access and return ready/empty/gated/error DTO states. No UI page was changed, no migration was run, no env/secret was changed, and no deployment was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS team invite API foundation
Files:
- app/api/saas/team/invites/route.ts
- lib/saas/team-invite-route.ts
- tests/unit/saas-team-invite-route.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added owner/admin writable-org team invite API handler for Claude team UI handoff. It counts active seats plus pending invites and calls the invite creation RPC wrapper. No UI page was changed, no email was sent, no migration was run, and no platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings live data server loader
Files:
- lib/saas/settings-live-data.ts
- tests/unit/saas-settings-live-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
Status: done
Notes: Added server-side billing, usage, and team settings loaders that compose org context, server Supabase/RLS client, repository input builders, and UI DTO builders. No UI page was changed, no mock data is served, no migration was run, and no platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite creation service and RPC draft
Files:
- lib/saas/invite-creation.ts
- tests/unit/saas-invite-creation.test.ts
- supabase/migrations/032_saas_invite_creation_rpc.sql
- tests/unit/saas-migration-plan.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository-backed invite creation use-case, URL-safe token generation, and draft atomic invite creation RPC. No migration was applied, no route was exposed, no UI file was changed, no invite email was sent, and no live invite was created.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite acceptance RPC draft and repository
Files:
- supabase/migrations/031_saas_invite_acceptance_rpc.sql
- lib/saas/invite-acceptance.ts
- tests/unit/saas-invite-acceptance.test.ts
- tests/unit/saas-migration-plan.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added draft atomic invite acceptance RPC and local repository wrapper. No migration was applied, no route was exposed, no UI file was changed, no invite email was sent, and no live invite was accepted.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite acceptance service foundation
Files:
- lib/saas/invite-acceptance.ts
- tests/unit/saas-invite-acceptance.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added pure invite acceptance use-case over repository interfaces. No route was exposed, no UI file was changed, no Supabase client was created, no invite email was sent, and no migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite token data repository foundation
Files:
- lib/saas/invite-token-data.ts
- tests/unit/saas-invite-token-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added token lookup repository for future /invite/[token] live data from organization_invites plus organization context. No route was exposed, no UI file was changed, no invite email was sent, and no migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite status policy foundation
Files:
- lib/saas/invite-policy.ts
- lib/saas/settings-team-data.ts
- lib/saas/settings-usage-data.ts
- tests/unit/saas-invite-policy.test.ts
- tests/unit/saas-settings-team-data.test.ts
- tests/unit/saas-settings-usage-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Centralized invite pending/accepted/expired/revoked status and admin/staff/viewer acceptability rules. No route was exposed, no UI file was changed, no migration was applied, and no invite email was sent.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings usage data repository foundation
Files:
- lib/saas/settings-usage-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-settings-usage-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository/input builder for future usage settings live data from organizations, seats, return_requests, and successful non-cached AI usage. No route was exposed, no UI file was changed, no migration was applied, and no platform operation was added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings team data repository foundation
Files:
- lib/saas/settings-team-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-settings-team-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository/input builder for future team settings live data from organizations, organization_members, and organization_invites. No route was exposed, no UI file was changed, no migration was applied, and no invite email was sent.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings billing data repository foundation
Files:
- .gitignore
- lib/saas/settings-billing-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-settings-billing-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository/input builder for future billing settings live data from organizations, subscriptions, and latest invoices. No route was exposed, no UI file was changed, no migration was applied, and no billing provider was enabled.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invoice status schema and DTO alignment
Files:
- supabase/migrations/030_saas_invoice_status_alignment.sql
- lib/saas/ui-backend-contracts.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-migration-plan.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added draft 030 for invoices.status and aligned billing settings DTOs on draft/issued/paid/failed/void. No DB migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS billing event status schema draft
Files:
- supabase/migrations/029_saas_billing_event_status.sql
- lib/saas/billing.ts
- lib/saas/platform-admin-data.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-billing-foundation.test.ts
- tests/unit/saas-migration-plan.test.ts
- tests/unit/saas-schema-readiness.test.ts
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added draft 029 for billing_events.status, aligned backend record defaults to received, and updated migration/schema gates. Current chain ends at 030. No migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS schema gate commercial v2 coverage
Files:
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-schema-readiness.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Strict schema gate now checks commercial v2 fields from the migration drafts, including upgrade suggestion, subscription period/provider, invoice, invite token, and audit metadata columns. No DB migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS return usage soft-limit policy
Files:
- lib/saas/return-usage-policy.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-return-usage-policy.test.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Centralized return volume soft-limit warnings at 80/100 percent and added consecutive 2-month upgrade suggestion resolver. Return volume remains non-blocking.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS subscription lifecycle timing policy
Files:
- lib/saas/subscription-lifecycle.ts
- tests/unit/saas-subscription-lifecycle.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added pure local timed status resolver for trial_end expiry, cancel_at_period_end, past_due 7-day grace, and suspended 30-day retention. No route or DB write was added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS team seat limit policy
Files:
- lib/saas/team-limits.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-team-limits.test.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Team DTOs now reserve seats for active members and pending invites before enabling invites. No live invite route or DB query was added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS export subscription guard
Files:
- lib/saas/org-context.ts
- app/api/v1/admin/returns/export/route.ts
- app/api/v1/admin/shopee-returns/export/route.ts
- app/api/v1/admin/pickup/export/route.ts
- tests/unit/saas-org-context.test.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Admin export APIs now require exportable subscription access so past_due, suspended, and cancelled orgs cannot export data.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS subscription access policy
Files:
- lib/saas/subscription-access.ts
- lib/saas/org-context.ts
- tests/unit/saas-subscription-access.test.ts
- tests/unit/saas-org-context.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Centralized subscription status access policy and made past_due read-only for writable guards, matching the product spec.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS migration apply plan check
Files:
- scripts/saas/check-migration-plan.mjs
- package.json
- tests/unit/saas-migration-plan.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a read-only pre-apply migration plan check that validates SaaS project ref, forbidden internal refs, DB password readiness, and the full migration chain. Current chain ends at 029. No migration is applied by the script.
```

```text
Owner: Codex
Commit: this commit
Scope: Settings UI/backend DTO builders
Files:
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Added billing and team settings DTO builders with validation tests. No routes were exposed, no DB queries were added, and no UI files were changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Manual Beta org provisioning backend foundation
Files:
- lib/saas/platform-admin-provisioning.ts
- app/api/internal/saas/orgs/route.ts
- tests/unit/saas-platform-admin-routes.test.ts
- supabase/migrations/027_saas_platform_admin_read_model.sql
- supabase/migrations/028_saas_manual_beta_org_provisioning.sql
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added gated platform admin POST foundation for manual Beta org provisioning via draft RPC. ENABLE_MULTI_TENANT_ADMIN remains false, and no migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin read model migration draft
Files:
- supabase/migrations/027_saas_platform_admin_read_model.sql
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a draft migration for organizations.owner_email and organizations.member_count because platform admin APIs already read those fields. No migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: ECPay webhook signature verification
Files:
- lib/saas/billing.ts
- app/api/billing/ecpay/webhook/route.ts
- tests/unit/saas-billing-foundation.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Default ECPay webhook path now verifies CheckMacValue before recording billing_events. Billing remains closed by ENABLE_BILLING=false and no provider credentials or API calls were added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS schema readiness gate
Files:
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- package.json
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added read-only SaaS schema readiness scripts for 023-026 tables/columns and tenant org_id checks. This does not apply migrations; strict mode is expected to fail until SaaS migrations are approved and applied.
```

```text
Owner: Codex
Commit: this commit
Scope: Signup persistence backend
Files:
- lib/saas/signup-request.ts
- lib/saas/signup-request-repository.ts
- app/api/saas/signup/route.ts
- tests/unit/saas-public-signup-request.test.ts
- scripts/saas/readiness-check.mjs
- supabase/migrations/026_saas_public_signup_requests.sql
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Public signup remains closed by default. When explicitly enabled after SaaS migrations, requests persist to signup_requests via service-role server repository; org creation is still a separate approval step.
```

```text
Owner: Codex
Commit: this commit
Scope: Billing foundation
Files:
- lib/saas/billing.ts
- app/api/billing/ecpay/webhook/route.ts
- tests/unit/saas-billing-foundation.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: ECPay webhook route stays closed by default, requires billing flag, credentials, and signature verification, and records idempotent billing_events only after verification.
```

```text
Owner: Codex
Commit: this commit
Scope: AI quota enforcement hardening
Files:
- lib/saas/ai-quota.ts
- app/api/v1/ai/analyze/route.ts
- tests/unit/saas-ai-quota.test.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Return AI analysis now checks monthly non-cached successful AI usage against org.plan before Gemini provider calls. Cache hits remain allowed and do not consume quota.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin API DTO wiring
Files:
- app/api/internal/saas/orgs/route.ts
- app/api/internal/saas/orgs/[id]/route.ts
- app/api/internal/saas/billing/events/route.ts
- lib/saas/platform-admin-data.ts
- tests/unit/saas-platform-admin-routes.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Internal platform admin APIs now return UI contract DTOs and require real usage snapshots. Feature flag remains closed by default.
```

```text
Owner: Codex
Commit: this commit
Scope: Convert UI mock contracts to backend DTOs
Files:
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: No live backend routes exposed. DTO builders require real usage snapshots instead of fake production data.
```

```text
Owner: Claude
Commit: f0a937a
Scope: Task 3 safe subset + Task 5 RWD audit
Files:
- components/saas/page-header.tsx
- app/(admin)/logistics/page.tsx
- app/(admin)/settings/page.tsx
Status: done
Notes: UI-only. Large client-heavy admin pages remain deferred.
```

```text
Owner: Claude
Commit: f216cc8
Scope: Task 1 + 2 partial - SaaS settings and platform admin UI polish
Files:
- components/saas/demo-data-banner.tsx
- components/saas/usage-progress.tsx
- components/internal/nav-link.tsx
- app/(admin)/settings/billing/page.tsx
- app/(admin)/settings/usage/page.tsx
- app/(admin)/settings/team/page.tsx
- app/internal/layout.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- app/internal/billing/events/page.tsx
Status: done
Notes: UI-only. Build issue from server-to-client icon prop was fixed by using an iconName string.
```

```text
Owner: Claude
Commit: 927bf1a
Scope: Task 4 - Empty / loading / error states
Files:
- app/not-found.tsx
- app/(admin)/loading.tsx
- app/(admin)/error.tsx
- app/(admin)/returns/loading.tsx
- app/(admin)/returns/[id]/loading.tsx
- app/(admin)/shopee-returns/loading.tsx
- app/(admin)/shopee-returns/[id]/loading.tsx
- app/(customer)/portal/loading.tsx
- app/(customer)/portal/error.tsx
Status: done
Notes: UI-only, no data layer changes.
```

```text
Owner: Codex
Commit: 6863003
Scope: Shared review checklist
Files:
- agent-shared/REVIEW_CHECKLIST.md
- agent-shared/README.md
- agent-shared/TASK_BOARD.md
Status: done
Notes: Added handoff, commit, and push checklist.
```
