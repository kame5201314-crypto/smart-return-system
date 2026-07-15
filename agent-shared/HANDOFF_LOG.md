# Handoff Log

## 2026-07-15 - Three-Day Google Trial Contract Handoff

- Shortened the Google self-service trial contract from 14 days to 3 days in
  draft migration `040` and updated the public marketing, signup, login,
  billing-status, expiry-notice, and rollout/spec copy to match.
- Bumped the self-service trial terms version to `2026-07-15-v2` so the material
  duration change is explicitly accepted when trial signup is enabled.
- The single successful real AI analysis policy remains unchanged.
- No migration, env/secret, Google/Supabase provider, deployment, billing,
  email provider, or master/live/internal Supabase change was made.

## 2026-07-15 - Single-Use Google Trial AI Handoff

- Added token-owned, atomic reservation/complete/release RPCs to unapplied
  draft migration `040` (`c47c752`). A stale reservation is recoverable after
  10 minutes and every RPC remains service-role only.
- Enforced one successful real AI analysis for Google self-service trials
  (`c022f2a`). Cached reports, fixed demos, local fallback, parse failures, and
  provider failures do not consume the trial run.
- Added merchant `0/1` status, fixed no-cost demo, confirmation, and upgrade CTA
  (`25a0cda`), plus commercial operations source/expiry/token-free AI status
  (`be1569d`).
- No migration, env/secret, Google/Supabase provider, deployment, billing,
  email provider, or master/live/internal Supabase change was made.
- At this historical handoff, the next step was the rollout sequence in
  `docs/SAAS_GOOGLE_AUTH_TRIAL_ROLLOUT.md`, including disposable concurrent
  reservation and expiry QA before enabling Google self-service trial. The
  later Production rollout resolution at the end of this log supersedes it.

## 2026-07-14 - Google OAuth / Self-Service Trial Handoff

- Implemented and pushed existing-merchant Google OAuth (`d05f89f`),
  self-service trial foundation plus draft migration `040` (`1eb9a7f`), scoped
  trial expiry plus draft migration `041` (`5ac9a8d`), and readiness/rollout
  gate alignment (`ceb42ae`, `4782088`).
- Added `docs/SAAS_GOOGLE_AUTH_TRIAL_ROLLOUT.md` as the authoritative activation
  order and disposable QA matrix.
- No Google Cloud/Supabase provider setting, migration, env/secret, deployment,
  billing, email provider, or master/live/internal Supabase change was made.
- At this historical handoff, the remaining sequence was to configure external Google/Supabase settings;
  enable Phase 1 only and QA existing merchants; separately authorize `040`
  and `041`; run the full identity/lifecycle QA matrix; only then enable Google
  trial and scoped expiry together. The later Production rollout resolution at
  the end of this log records completion.


## 2026-07-14 Codex -> Owner / Claude

Completed owner-authorized production deployment of the signed return-image
runtime and the follow-up private bucket switch.

Completed:

- Re-ran preflight and `npm run safety:agent-boundary`; branch was
  `develop-saas` and the worktree was clean before the run.
- Ran `npm run saas:predeploy`; safety/env/rollout/schema/lint/typecheck,
  scripts/backend, unit, e2e, integration, and build all passed. Rollout
  warnings were the expected local admin-password, Sentry/local logging, and
  billing-disabled warnings.
- Deployed `f009621 fix(saas): sign return image storage URLs` to Vercel
  Production project `smart-return-system-saas`.
- Vercel deployment `dpl_qJfFc3z5UFc7Qqb6u5DmNCSoae8v` is Ready and aliased to
  `https://smart-return-system-saas.vercel.app`.
- After the deployment was Ready, switched SaaS Supabase project
  `auyznbwtjvemyamujmgt` bucket `return-images` from `public=true` to
  `public=false`.
- Verified storage bucket state with service role:
  - `return-images public=false`
  - no existing object was found in the bucket during the signed/public URL
    smoke, so there was no live object URL to fetch.
- Ran `npm run saas:production-smoke`; 16 pass, 0 warn, 0 fail.
- Updated rollout docs and shared coordination files.

Not performed:

- No migration.
- No env/secret edit.
- No domain/DNS setting change.
- No email provider enablement.
- No billing/provider enablement.
- No public signup enablement.
- No master/live/internal Supabase action.

Next:

- If future customer uploads create `return-images` objects, verify one
  merchant return-detail image and one portal tracking image render through
  signed URLs.
- Remaining public/paid rollout blockers are still invoice/legal finalization,
  Resend credentials plus explicit delivery authorization, Stage 2 ECPay
  billing, public signup posture, optional `PLATFORM_ADMIN_ROLES`, and
  separately authorized migrations `034`/`036`.

## 2026-07-09 Codex -> Owner / Claude

Completed owner-authorized migration `033_saas_platform_billing_operations.sql`
apply and platform tenant suspend/resume UI wiring.

Completed:

- Re-ran preflight and `npm run safety:agent-boundary`; branch was
  `develop-saas`.
- Confirmed the target linked SaaS Supabase project was
  `auyznbwtjvemyamujmgt`.
- Ran `npm run saas:migration-plan:strict` before applying the migration.
- Applied only
  `supabase/migrations/033_saas_platform_billing_operations.sql` with
  `npx supabase db query --linked --file ...`.
- Marked only remote migration history version `033` as applied.
- Rechecked remote migration history: `033`, `035`, `037`, and `038` are
  applied; `034` and `036` remain unapplied.
- Verified `perform_platform_billing_operation(...)` exists and `service_role`
  has execute privilege.
- Added `/internal/orgs/[id]` controls for `暫停租戶` and `恢復租戶` through
  the existing guarded `/api/internal/saas/billing/operations` route. The UI
  requires a reason, shows a confirmation dialog, refreshes after success, and
  does not enable billing/provider automation.
- Updated `saas:doctor` auth-redirect readiness coverage so it validates the
  current server-side `/admin`, `/internal`, and `/internal/*` non-admin
  redirect contract instead of the older `/admin`-only check.
- Updated rollout status docs and shared coordination files.

Validation:

- `npm run safety:agent-boundary`: passed.
- `npm run saas:migration-plan:strict`: passed before migration apply.
- `npm run saas:schema-gate:strict`: passed.
- `npm run saas:doctor`: passed with 167 pass / 1 expected local warning /
  0 fail.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Relevant unit tests passed:
  `proxy-login-redirect`, `saas-platform-admin-billing-operations`, and
  `saas-ui-backend-contracts`.

Not performed:

- No deployment.
- No migration other than `033`.
- No env/secret edit.
- No domain/DNS change.
- No email provider enablement.
- No billing/provider enablement.
- No public signup enablement.
- No master/live/internal Supabase action.

Next:

- `034` and `036` remain blocked until separately authorized.

## 2026-07-02 Codex -> Owner / Claude

Completed production Closed Manual Beta flag-lock verification without
changing any Vercel env, provider, billing, signup, deployment, migration, or
database state.

Completed:

- Re-ran preflight and `npm run safety:agent-boundary`; branch was
  `develop-saas` and the worktree was clean before changes.
- Checked Vercel Production env names with `npx vercel env ls production`.
- Pulled Vercel Production env values into a Windows temporary file only long
  enough to parse non-secret rollout flags, then immediately deleted the temp
  file. No secret values were printed, committed, or written into repo.
- Confirmed:
  - `ENABLE_BILLING=false`
  - `ENABLE_PUBLIC_SIGNUP=false`
  - `RESEND_API_KEY`: missing
  - `EMAIL_FROM`: missing
  - `EMAIL_PROVIDER`: missing
  - `ENABLE_EMAIL_PROVIDER`: missing
  - `EMAIL_DELIVERY_ENABLED`: missing
- Confirmed `/admin`, `/internal`, and `/internal/orgs` unauthenticated route
  behavior still redirects through the platform admin login path.
- Confirmed a signed production platform-admin `admin_session` reaches:
  - `/internal` with HTTP `200`
  - `/internal/orgs` with HTTP `200`
- Reused the existing 2026-07-02 authenticated merchant QA evidence for the
  merchant-account denial claim; no merchant password was used or reset in this
  flag-lock pass.

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email provider enablement.
- No billing/provider enablement.
- No public signup enablement.
- No master/live/internal Supabase action.

Next:

- Keep D/E/F disabled for Closed Manual Beta.
- Owner may start Closed Manual Beta customer onboarding on the Vercel
  production URL.
- First paid customer remains blocked on invoice/receipt and legal/accounting
  confirmation.

## 2026-07-02 Codex -> Owner / Claude

Completed SaaS D/E/F readiness pass for Resend email provider, ECPay/billing,
and public signup without enabling any external provider.

Completed:

- Re-ran preflight and `npm run safety:agent-boundary`; branch was
  `develop-saas` and the worktree was clean before changes.
- Checked Vercel Production env names without printing values:
  - `RESEND_API_KEY`: missing
  - `EMAIL_FROM`: missing
  - `EMAIL_PROVIDER`: missing
  - `ECPAY_MERCHANT_ID`: missing
  - `ECPAY_HASH_KEY`: missing
  - `ECPAY_HASH_IV`: missing
  - `ENABLE_BILLING`: set
- Added `lib/saas/email-delivery-provider.ts` as a disabled-by-default Resend
  adapter skeleton.
- Added unit coverage proving:
  - email provider delivery is disabled by default;
  - `ENABLE_EMAIL_DELIVERY=true`, `EMAIL_PROVIDER=resend`,
    `RESEND_API_KEY`, and `EMAIL_FROM` are all required before readiness is
    `ready`;
  - the adapter does not call Resend when disabled;
  - mocked Resend success/error handling works without real provider calls.
- Updated `scripts/saas/readiness-check.mjs` so `saas:doctor` records the
  disabled-by-default Resend readiness skeleton.
- Confirmed the current email queue cron route remains dry-run only and still
  rejects `dryRun=false` with `delivery_not_enabled`.
- Confirmed current ECPay billing foundation remains webhook/event-recording
  only and does not implement recurring authorization, paid/past_due/suspended
  automation, invoice issuing, provider replay, or refund execution.
- Confirmed current public signup remains closed by `ENABLE_PUBLIC_SIGNUP=false`;
  if opened later, it records a Basic-plan `signup_requests` lead/request only
  and does not create auth users, orgs, memberships, subscriptions, trials,
  invoices, or billing authorizations.
- Updated:
  - `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
  - `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
  - `agent-shared/TASK_BOARD.md`

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email provider enablement.
- No billing/provider enablement.
- No public signup enablement.
- No master/live/internal Supabase action.

Next:

- Owner provides Resend account, verified sender domain, `RESEND_API_KEY`,
  `EMAIL_FROM`, delivery scope, and explicit `ENABLE_EMAIL_DELIVERY=true`
  authorization before any real email delivery.
- Owner provides ECPay MerchantID / HashKey / HashIV, invoice method,
  payment-failure grace policy, refund SOP, sandbox test account, and explicit
  Stage 2 `ENABLE_BILLING=true` authorization before billing provider work.
- Owner decides public signup posture and automatic provisioning requirements
  before opening `ENABLE_PUBLIC_SIGNUP=true`.

## 2026-07-02 Codex -> Owner / Claude

Completed production authenticated admin verification, disposable QA team
verification, and paid-customer invoice/legal readiness documentation.

Completed:

- Re-ran preflight and `npm run safety:agent-boundary`; branch was
  `develop-saas` and the worktree was clean before checks.
- Confirmed Vercel Production env names include:
  - `ENABLE_MULTI_TENANT_ADMIN`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
- Confirmed `PLATFORM_ADMIN_ROLES` is not listed in Vercel Production env
  names. This remains optional owner work only if per-email platform operator
  roles are needed.
- Used the configured production admin username/password path without printing
  secret values.
- Authenticated production admin check passed:
  - `/admin` redirects clean unauthenticated users to `/login?next=%2Finternal`.
  - Platform admin login reaches `/internal`.
  - `/internal` renders the operations console.
  - `/internal/orgs` renders the tenant list.
- Disposable QA check used only
  `QA Team Management Test 20260624041704`
  (`791748d1-7d3f-4b61-a9e5-3138a98f7262`).
- Reset QA owner/member temporary passwords without printing or storing them.
- QA owner login passed.
- QA owner pages passed:
  - `/analytics`
  - `/shopee-returns`
  - `/analytics/ai-report`
  - `/settings/team`
- QA team operations passed:
  - owner can see member;
  - member role change;
  - member disable;
  - invite create;
  - invite resend/regenerate token;
  - invite revoke.
- Merchant account access to `/internal` is denied by the platform-admin gated
  state and does not expose platform operations data.
- Added invoice/receipt and legal-finalization owner checklist to
  `docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`.

Result:

- No code fix was required.
- First paid customer is still blocked on owner/legal/accounting confirmation
  of legal entity, tax id, registered address, contact email, invoice method,
  invoice issuer owner, retention period, personal-data deletion contact,
  subprocessor list, and paid refund rules.

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

Next:

- Owner/legal/accounting finalizes invoice/receipt and legal-page values before
  collecting money.
- Owner decides public signup posture.
- Owner provides and authorizes Resend/email delivery credentials when ready.
- Owner separately authorizes Stage 2 Billing/ECPay and any draft migrations
  `033`, `034`, or `036`.

## 2026-07-01 Codex -> Owner / Claude

Completed read-only production admin verification.

Completed:

- Re-ran preflight and `npm run safety:agent-boundary`; branch was
  `develop-saas` and the worktree was clean before checks.
- Used Vercel CLI read-only commands only.
- Confirmed Vercel Production env names include:
  - `ENABLE_MULTI_TENANT_ADMIN`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
- Confirmed `PLATFORM_ADMIN_ROLES` is not listed in Vercel Production env
  names.
- Confirmed deployment `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76` is Ready.
- Confirmed unauthenticated `/admin` and `/internal` redirect to
  `/admin/login?next=%2Finternal`.
- Confirmed `/admin/login?next=%2Finternal` redirects to
  `/login?next=%2Finternal`.
- `npm run saas:production-smoke` passed with 16 pass, 0 warn, 0 fail.

Not verified:

- Authenticated platform-admin login, because no admin credentials were used in
  this read-only run.

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

Next:

- If per-email platform operator roles are needed, owner must authorize adding
  `PLATFORM_ADMIN_ROLES` to Vercel Production env.
- Otherwise, run authenticated platform-admin login QA with the existing admin
  username/password through an approved secure credential handoff.
- Run disposable-org merchant-to-platform and team-management browser QA
  before inviting real multi-member merchants.

## 2026-07-01 Codex -> Owner / Claude

Applied the owner-authorized team member visibility migration to the SaaS
project.

Completed:

- Owner authorized applying only
  `supabase/migrations/038_saas_org_member_visibility.sql` to SaaS Supabase
  project `auyznbwtjvemyamujmgt`.
- Preflight and `npm run safety:agent-boundary` passed before mutation.
- Remote migration list before apply showed `035` and `037` applied, while
  `033`, `034`, `036`, and `038` were pending.
- Applied only `supabase/migrations/038_saas_org_member_visibility.sql`
  through the linked SaaS DB query path.
- Repaired remote migration history for version `038` to `applied`.
- Remote migration list after apply shows `035`, `037`, and `038` applied
  while `033`, `034`, and `036` remain unapplied.
- Confirmed `public.is_organization_member(uuid, text[])` exists.
- Confirmed `organization_members` policy
  `members_select_org_memberships` exists for authenticated same-org SELECT.
- Verification passed:
  - `npm run saas:schema-gate:strict`
  - `npm run saas:migration-plan:strict`
  - `npm run saas:doctor`
  - `npm run lint`
  - `npm run test:all`
  - `npm run saas:production-smoke`

Not performed:

- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No migrations `033`, `034`, or `036`.
- No master/live/internal Supabase action.

Next:

- Set or confirm production `PLATFORM_ADMIN_ROLES` before relying on
  individual platform-admin identity in production.
- Run disposable-org `/settings/team` browser QA before inviting real merchant
  staff.

## 2026-07-01 Codex -> Owner / Claude

Added the read-only production smoke script.

Completed:

- Added `scripts/saas/production-smoke.mjs`.
- Added npm script `saas:production-smoke`.
- Linked the script from `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md`.
- Updated `docs/SAAS_EXTERNAL_SETUP_STATUS.md` and `agent-shared/**`.

The script checks:

- public route `200` responses for `/`, `/pricing`, `/signup`, `/login`,
  `/robots.txt`, and `/sitemap.xml`;
- `/pricing` contains 499/699 markers and not old 1490/2990 markers;
- unauthenticated merchant protected routes redirect to `/login`;
- unauthenticated platform routes redirect to the platform-admin login path.

Usage:

```powershell
npm run saas:production-smoke
```

Optional target override:

```powershell
npm run saas:production-smoke -- --url=https://example.vercel.app
```

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Added the Closed Manual Beta onboarding runbook.

Completed:

- Added `docs/SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md`.
- Linked it from:
  - `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`
  - `docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`
  - `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
  - `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
  - `agent-shared/TASK_BOARD.md`
  - `agent-shared/ACTIVE_WORK.md`

The runbook covers:

- Production entry points for prospects, merchants, and platform operators.
- Account handoff rules that avoid storing temporary passwords in docs, chat,
  or Git.
- First-session walkthrough across merchant login, dashboard, Shopee returns,
  manual returns, AI report, and usage settings.
- Beta scope language: Shopee automated import; official website/momo manual
  entry; email/billing/custom domain/public signup disabled.
- Platform operator follow-up in `/internal`.
- Daily Beta tracking fields, escalation rules, and acceptance criteria.

Not performed:

- No account was provisioned.
- No password was generated or stored.
- No customer data was imported.
- No migration.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Completed owner-authorized production deploy of latest `develop-saas` HEAD
`3fadd75 docs(saas): record production deployment gap`.

Deployment:

- Vercel project: `smart-return-system-saas`
- Runtime source: `3fadd75`
- Deployment ID: `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76`
- Deployment URL:
  `https://smart-return-system-saas-jq1nrrc1k-kaweis-projects.vercel.app`
- Production alias: `https://smart-return-system-saas.vercel.app`
- Status: Ready

Pre-deploy gate:

- Preflight and `npm run safety:agent-boundary` passed.
- `npm run saas:predeploy` passed, including lint, typecheck, unit tests, e2e
  tests, integration tests, and production build.

Production smoke:

- Public routes returned `200`: `/`, `/pricing`, `/signup`, `/login`,
  `/robots.txt`, `/sitemap.xml`.
- `/pricing` shows 499/699 markers and the multi-channel honesty copy.
- Checked `/pricing` response no longer exposes old `1,490` / `2,990`
  pricing markers.
- Tenant protected routes redirect to `/login`.
- Platform protected routes redirect to `/admin/login?next=...`.

Notes:

- Vercel still lists historical `app.smart-return.tw`; owner has deferred
  domain purchase/setup, and no DNS/domain command was run.
- `npx vercel logs` filtered scan was not completed because the current CLI
  rejected the `--level` / `--since` filter combination. Inspect and smoke
  passed.

Not performed:

- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Recorded the production deployment gap after the multi-channel honesty copy
landed in Git.

Read-only production result:

- `/`: `200`
- `/pricing`: `200`
- `/login`: `200`
- unauthenticated `/internal`: `307` to `/admin/login?next=%2Finternal`
- `/pricing` still exposes old pricing markers:
  - `1,490`
  - `2,990`
  - `Basic`
  - `Growth`

Current source/runtime split:

- Latest pushed source: `8ae2aa7 fix(saas/ui): make multi-channel honesty explicit on homepage`
- Current production runtime: `f634bc0 fix(saas): keep SEO metadata routes public`

Conclusion:

- 499/699 pricing and the multi-channel honesty copy are in Git but not yet
  visible on production.
- Owner must explicitly authorize a Vercel Production deployment before Beta
  prospects use the public site as the current source of truth.

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Added the privacy, DPA, and data deletion SOP for paid/public rollout
readiness.

Completed:

- Added `docs/SAAS_PRIVACY_DPA_DELETION_SOP.md`.
- Linked it from `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`,
  `docs/SAAS_EXTERNAL_SETUP_STATUS.md`, and
  `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`.
- Updated `agent-shared/TASK_BOARD.md` and `agent-shared/ACTIVE_WORK.md`.

The SOP covers:

- SaaS privacy roles and platform-admin privacy boundary.
- Data categories and draft retention defaults.
- Subprocessor register draft.
- Merchant data deletion request workflow.
- DPA checklist for merchant customers.
- Security incident workflow.
- Cookie/analytics tracking checklist.

Still required before paid/public rollout:

- Owner/legal reviews and approves public legal wording.
- Owner confirms company/tax/invoice details for terms and invoice handling.
- Owner confirms exact retention/deletion windows and support contacts.

Not performed:

- No customer data was exported or deleted.
- No legal page was finalized.
- No migration.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Added the manual payment and support SOP for early paid/manual Beta operations.

Completed:

- Added `docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`.
- Linked it from `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`,
  `docs/SAAS_EXTERNAL_SETUP_STATUS.md`, and
  `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`.
- Updated `agent-shared/TASK_BOARD.md` and `agent-shared/ACTIVE_WORK.md`.

The SOP covers:

- Manual payment record fields.
- Manual payment workflow.
- Manual refund review workflow.
- Low-touch support SLA for Basic/Growth.
- Beta onboarding checklist.
- Escalation triggers for overage, high support demand, legal/privacy, and
  enterprise needs.

Still required before collecting money:

- Owner/legal/accounting confirms invoice or receipt capability.
- Owner finalizes public legal/refund wording for paid use.

Not performed:

- No payment was collected.
- No invoice was issued.
- No migration.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Completed the local, non-external go-live execution pass.

Completed:

- Ran `npm run safety:agent-boundary`.
- Ran `npm run lint`.
- Ran `npm run typecheck`.
- Ran `npm run saas:migration-plan:strict`.
- Ran `npm run saas:schema-gate:strict`.
- Ran `npm run test:all`.
- Ran `npm run saas:doctor`.
- Ran `npm run build`.
- Updated `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`,
  `docs/SAAS_EXTERNAL_SETUP_STATUS.md`, and `agent-shared/**` with the pass
  result and remaining authorization blockers.

Results:

- Local gate status: pass.
- `saas:doctor`: 165 pass, 1 expected local warning, 0 fail.
- The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`, which remains the
  local platform-admin preview posture and not a code failure.

Still requires explicit owner authorization:

- Applying only `038_saas_org_member_visibility.sql`.
- Read-only production `/admin` and `/internal` Vercel env/route verification.
- Disposable-org browser QA that writes test return/team data.
- Any deployment, env change, provider enablement, billing change, DNS change,
  or live/internal Supabase action.

Not performed:

- No migration.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-07-01 Codex -> Owner / Claude

Added the current go-live risk and service plan.

Completed:

- Added `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`.
- Linked the plan from `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md` and
  `docs/SAAS_EXTERNAL_SETUP_STATUS.md`.
- Updated `agent-shared/TASK_BOARD.md` and `agent-shared/ACTIVE_WORK.md` so
  future Claude/Codex handoffs use the same ordered queue.
- Clarified stage decisions:
  - Closed free/manual Beta is acceptable with controlled scope.
  - First paid manual customers require invoice/receipt capability, finalized
    legal/refund wording, and manual payment tracking.
  - Public self-serve paid SaaS remains blocked by email delivery, ECPay
    recurring billing/invoice flow, public signup/provisioning posture,
    lifecycle automation, and provider-backed alerts.

Next:

- Owner may explicitly authorize applying only
  `038_saas_org_member_visibility.sql` if multi-member team QA is required.
- Owner may explicitly authorize a read-only production `/admin` and
  `/internal` Vercel env/route smoke.
- After those, run the disposable-org merchant-to-platform QA plan in
  `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md`.

Not performed:

- No migration.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-06-30 Codex -> Owner / Claude

Added a platform admin privacy-boundary regression test.

Completed:

- Updated `tests/unit/saas-platform-admin-live-data.test.ts` with a fixture
  that includes extra customer return detail fields such as order number, buyer
  name, phone, address, return reason, and nested return request rows.
- Asserted the platform dashboard, organization list, and organization detail
  DTO payloads do not contain those customer detail fields or values.
- Updated the AI returns platform QA plan to record this automated privacy
  boundary check.

Not performed:

- No migration.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-06-30 Codex -> Owner / Claude

Added the AI return system to commercial platform admin QA contract.

Completed:

- Added `tests/unit/saas-platform-admin-data.test.ts` to assert platform admin
  usage summaries are built from tenant-scoped `return_requests` and
  non-cached successful `ai_usage_events`.
- Added draft migration `038_saas_org_member_visibility.sql` so owner/admin
  users can read same-org `organization_members` rows through
  `public.is_organization_member(...)` without recursive RLS.
- Updated migration-plan and SaaS doctor readiness coverage so the local draft
  migration chain now ends at `038`.
- Added `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md` with merchant workspace to
  platform admin data-flow checks, commercial admin QA steps, and the exact
  owner authorization text required before applying `038`.

Not performed:

- No Supabase migration was applied.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

Next:

- If owner wants full real-DB `/settings/team` browser QA, owner must
  separately authorize applying only `038_saas_org_member_visibility.sql` to
  SaaS project `auyznbwtjvemyamujmgt`.
- Continue keeping merchant workspace entry `/login -> /analytics` separate
  from platform admin entry `/admin -> /internal`.

## 2026-06-30 Codex -> Owner / Claude

Refreshed the SaaS pricing contract to the finalized 499 / 699 model.

Completed:

- Updated runtime plan definitions to:
  - `basic`: NT$499, 3 seats, 300 monthly return soft limit, 10 AI analyses.
  - `growth`: NT$699, 5 seats, 800 monthly return soft limit, 25 AI analyses,
    and advanced analytics enabled.
  - `enterprise`: quote-only, contract limits, API access enabled.
- Retired runtime `pro` from the TypeScript plan union and marketing plan
  order.
- Updated public pricing/home/AI copy, manual Beta provisioning options,
  readiness checks, UI/backend contracts, tests, and product/architecture docs.
- Kept existing migration history untouched; historical migrations still contain
  legacy `pro` checks and should only be changed through an owner-authorized
  migration strategy if needed.
- Ran focused plan/contract tests, `npm run lint`, `npm run typecheck`,
  `npm run test:all`, `npm run saas:doctor`, and `npm run build`.

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No billing/provider enablement.
- No domain/DNS change.
- No master/live/internal Supabase action.

Next:

- Claude can continue the introduction/marketing-page copy work on top of this
  contract.
- Before broad public rollout, owner/Codex should separately decide whether any
  real database rows still use legacy `pro` and, if so, authorize a migration or
  data repair plan.

## 2026-06-26 Codex -> Owner / Claude

Applied the owner-authorized team invite status migration to the SaaS project.

Completed:

- Owner authorized applying only `037_saas_team_invite_status.sql` to SaaS
  Supabase project `auyznbwtjvemyamujmgt`.
- Preflight and `npm run safety:agent-boundary` passed before mutation.
- Remote migration list before apply showed `035` applied and `033`, `034`,
  `036`, and `037` pending.
- Applied only `supabase/migrations/037_saas_team_invite_status.sql` through
  the linked SaaS DB query path.
- Repaired remote migration history for version `037` to `applied`.
- Remote migration list after apply shows `035` and `037` applied while `033`,
  `034`, and `036` remain unapplied.
- `npm run saas:schema-gate:strict`, `npm run saas:migration-plan:strict`,
  `npm run saas:doctor`, `npm run lint`, `npm run typecheck`, and
  `npm run test:all` passed.

Not performed:

- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No migrations `033`, `034`, or `036`.
- No master/live/internal Supabase action.

Next:

- Claude/browser QA can resume the `/settings/team` 1-9 point test because
  `organization_invites.status` now exists in the SaaS DB.
- Do not deploy the team-management UI to production unless the owner
  separately authorizes deployment.

## 2026-06-26 Codex -> Owner / Claude

Fixed the repo/schema contract blocker found by Claude QA for merchant team
management P1.

Problem:

- `/settings/team` reads and writes `organization_invites.status`.
- The applied SaaS DB schema through `032` does not include that column.
- Real SaaS DB QA therefore fails before the 1-9 point-test can exercise
  invite revoke/resend.

Completed in this repo:

- Added draft migration `037_saas_team_invite_status.sql`.
- `037` adds `organization_invites.status` with
  `pending/accepted/expired/revoked`.
- `037` backfills accepted and expired states.
- `037` adds `idx_organization_invites_org_status_created`.
- `037` refreshes `accept_organization_invite()` and
  `create_organization_invite()` after the status column exists.
- Updated invite status policy so persisted `accepted` / `expired` statuses are
  respected before timestamp fallback.
- Updated migration plan, schema gate, SaaS doctor coverage, unit tests, and
  rollout docs.

Not performed:

- No Supabase migration was applied.
- No deployment.
- No env/secret edit.
- No domain/DNS change.
- No email/billing/provider enablement.
- No master/live/internal Supabase action.

Next owner action if full real-DB QA is desired:

```text
I authorize applying only migration 037_saas_team_invite_status.sql to the SaaS
Supabase project auyznbwtjvemyamujmgt.
Do not apply migrations 033, 034, or 036.
Do not deploy, change env/secrets, enable email/billing/provider, or touch
master/live/internal Supabase.
After applying, run /settings/team owner QA for invite revoke/resend and update
docs, commit, and push develop-saas.
```

## 2026-06-24 Codex -> Claude / Owner

Completed the Codex backend contract for
`docs/SAAS_TEAM_MANAGEMENT_P1_SPEC.md` §C.

Backend API routes now available:

- `PATCH /api/saas/team/members/[id]`
  - Body: `{ "role": "admin" | "staff" | "viewer" }`
  - Changes an organization member role.
- `POST /api/saas/team/members/[id]/disable`
  - Non-destructively disables a member. This is the P1 safe "remove" path.
- `POST /api/saas/team/invites/[id]/revoke`
  - Revokes a pending invite.
- `POST /api/saas/team/invites/[id]/resend`
  - Reopens pending/expired invite, generates a new token, and extends expiry.

Shared response shape:

```ts
{
  success: true;
  data: {
    member?: TeamSettingsView['members'][number];
    invite?: TeamSettingsView['invites'][number] & { token?: string };
    actions: { ...rowActionFlags };
  };
}
```

Failure shape:

```ts
{
  success: false;
  error: string;
  code:
    | 'invalid_request'
    | 'not_found'
    | 'role_forbidden'
    | 'self_demotion'
    | 'self_disable'
    | 'last_owner'
    | 'seat_limit'
    | 'invalid_state'
    | 'update_failed';
}
```

Security and data rules implemented:

- Mutating routes reject explicit cross-site browser requests.
- Mutations require
  `getOrgContext({ requirements: { roles: ['owner','admin'], writable: true } })`.
- All member/invite reads and writes are scoped by both `org_id` and row id.
- Owner can manage admin/staff/viewer rows.
- Admin can manage staff/viewer rows only.
- Staff/viewer cannot manage team rows.
- A user cannot disable or demote their own membership.
- The final active owner cannot be demoted or disabled.
- Revoked invites are stored as `status='revoked'`, and invite token lookup now
  reads status so revoked invites are not acceptable.
- Audit log actions are `member.role_changed`, `member.disabled`,
  `invite.revoked`, and `invite.resent`.

DTO handoff:

- `TeamSettingsView.members[]` now includes `userId` and row actions:
  `canChangeRole`, `canDisable`, `disabledReason`.
- `TeamSettingsView.invites[]` now includes row actions:
  `canRevoke`, `canResend`, `disabledReason`.
- Claude UI should render controls from these backend flags and should not
  duplicate role/last-owner/self-management logic in client code.

Not performed:

- No UI page/component change.
- No migration.
- No deploy.
- No env/secret edit.
- No email provider, billing/provider, or public signup enablement.
- No master/live/internal Supabase action.
- No production DB mutation.

## 2026-06-13 Codex -> Owner / Codex for Windows

Recorded the owner's decision to defer custom domain work.

Decision:

- Owner confirmed `smart-return.tw` has not been purchased.
- Owner chose to continue Closed Manual Beta on:
  `https://smart-return-system-saas.vercel.app`.
- Custom domain work is no longer an active blocker for the current Beta.
- Future agents should not keep retrying `app.smart-return.tw` verification
  until the owner buys/registers a domain and explicitly reauthorizes
  DNS/Vercel verification.

Still pending:

- Public signup posture.
- Resend/email provider credentials and delivery authorization.
- Stage 2 Billing/ECPay plus `ENABLE_BILLING`.
- Separately authorized migrations `033`, `034`, and `036`.

Not performed:

- No deploy.
- No migration.
- No env/secret edit.
- No DNS/domain mutation.
- No email provider enablement.
- No billing/provider enablement.
- No master/live/internal Supabase action.
- No production DB mutation.

## 2026-06-13 Codex -> Owner / Codex for Windows

Followed up after the owner opened the Vercel Dashboard for project
`smart-return-system-saas`.

Observed in Vercel Dashboard:

- `app.smart-return.tw` exists under Settings -> Domains.
- Status is `Invalid Configuration`.
- No TXT ownership challenge is visible in the domain detail panel.
- Required DNS record shown by Vercel:
  - Type: `CNAME`
  - Name/Host: `app`
  - Value/Target: `64ed959ebaa2a805.vercel-dns-016.com.`
  - TTL: Auto or 300
- If the DNS provider rejects the trailing dot, use
  `64ed959ebaa2a805.vercel-dns-016.com`.
- Vercel notes old records such as `cname.vercel-dns.com` continue to work, but
  the current dashboard recommends the project-specific value above.

Additional checks:

- `Resolve-DnsName smart-return.tw`: no records.
- `Resolve-DnsName app.smart-return.tw`: no records.
- TWNIC RDAP for `smart-return.tw` returned 404 while `twnic.tw` returns active,
  so the owner must confirm the root domain is registered and delegated at the
  authoritative DNS provider before the app subdomain can resolve.

Outcome:

- Codex did not buy/register a domain, edit DNS, alias the deployment, deploy,
  run migrations, edit env/secrets, enable email/provider/billing, touch
  master/live/internal Supabase, or mutate production DB.
- Next owner action is outside the repo/Vercel project UI: confirm
  `smart-return.tw` ownership/registration and add the dashboard CNAME at the
  authoritative DNS provider.

## 2026-06-13 Codex -> Owner / Codex for Windows / Claude

Completed the requested domain ownership / 403 review and email provider
planning pass.

Preflight:

- Checkout: `D:\AI專案\AI退貨系統商業版_2026.5.16`
- Branch: `develop-saas`
- HEAD at start: `f46dd54 docs(saas): refresh rollout blocker status`
- Working tree was clean.
- `npm run safety:agent-boundary`: passed.

Domain/Vercel checks:

- Local `.vercel/project.json` points to project `smart-return-system-saas`
  (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
- `npx vercel project ls`: no projects found under the current CLI scope.
- `npx vercel domains ls`: 0 domains.
- `npx vercel domains inspect smart-return.tw`: 403.
- `npx vercel domains inspect app.smart-return.tw`: 403.
- `Resolve-DnsName smart-return.tw`: NXDOMAIN.
- `Resolve-DnsName app.smart-return.tw`: NXDOMAIN.
- Because DNS is NXDOMAIN and Vercel domain inspect is 403, no alias or
  verification command was attempted.

Owner domain action:

- In Vercel Dashboard project `smart-return-system-saas`, add
  `app.smart-return.tw` under Settings -> Domains.
- If Vercel shows a TXT ownership challenge, owner must add that exact TXT
  record. Codex cannot infer it because the CLI did not return one.
- At DNS provider, set `CNAME app -> cname.vercel-dns.com` with TTL Auto or
  300.
- After DNS resolves, retry DNS, Vercel domain inspect, and HTTPS smoke.

Email provider planning:

- Recommended first provider: Resend.
- Owner must prepare Resend account, verified `smart-return.tw` sender domain,
  `RESEND_API_KEY`, sender address such as `no-reply@smart-return.tw` or
  `support@smart-return.tw`, and decide whether initial scope is invite-only or
  invite + trial/quota/billing notifications.
- Current code supports notification/email queue creation and
  `CRON_SECRET`-gated dry-run inspection only.
- `dryRun=false` is intentionally rejected with `delivery_not_enabled`.
- Future Codex implementation needs a Resend adapter, env contract, provider
  send path, sent/failed queue updates, retry/audit behavior, and tests before
  enabling delivery.

No deploy, migration, env/secret edit, DNS mutation, email provider enablement,
billing/provider enablement, master/live/internal Supabase action, or production
DB change was performed.

## 2026-06-13 Codex -> Owner / Codex for Windows / Claude

Completed the requested read-only SaaS rollout status check.

Preflight:

- Checkout: `D:\AI專案\AI退貨系統商業版_2026.5.16`
- Branch: `develop-saas`
- HEAD at start: `b73bdd6 test(saas): add platform admin dashboard e2e flow`
- Working tree was clean.
- `npm run safety:agent-boundary`: passed.

Production:

- `npx vercel inspect https://smart-return-system-saas.vercel.app` reports
  deployment `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot` as Production / Ready.
- Current deployment URL:
  `https://smart-return-system-saas-pji1crs57-kaweis-projects.vercel.app`.
- Aliases include `https://smart-return-system-saas.vercel.app` and
  `https://app.smart-return.tw`.

Smoke:

- Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, and `/login` returned `200`.
- Tenant protected routes `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, and `/settings/usage` returned `307`.
- Platform protected routes `/internal` and `/internal/orgs` returned `307`.

Custom domain:

- `Resolve-DnsName app.smart-return.tw`: NXDOMAIN /
  `DNS name does not exist`.
- `Resolve-DnsName smart-return.tw`: NXDOMAIN.
- `https://app.smart-return.tw` and `/login` fail because the host cannot be
  resolved.
- `npx vercel domains inspect app.smart-return.tw`: Vercel 403 for the current
  scope.
- `npx vercel domains ls`: 0 domains.
- No TXT ownership record was returned by the CLI.

Owner-blocked items:

- Sentry env names are present in Vercel Production.
- Email provider credentials are not visible in Vercel Production env names;
  email delivery remains owner/provider-blocked.
- ECPay/Billing provider credential names are not visible in Vercel Production
  env names; Billing/ECPay remains Stage 2 owner-blocked.
- Draft migrations `033`, `034`, and `036` remain separate owner-authorization
  items.

Verification:

- `npm run saas:doctor`: 155 pass, 1 expected local
  `ENABLE_MULTI_TENANT_ADMIN=true` warning, 0 fail.
- `npm run lint`: passed.

No deploy, migration, env/secret edit, DNS/domain mutation, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-13 Codex -> Owner / Codex for Windows / Claude

Completed the owner-authorized production deployment of `develop-saas` HEAD
`f634bc0 fix(saas): keep SEO metadata routes public`.

Preflight and gates:

- Checkout: `D:\AI專案\AI退貨系統商業版_2026.5.16`
- Branch: `develop-saas`
- Vercel project: `smart-return-system-saas`
- `npm run safety:agent-boundary`: passed
- `npm run saas:predeploy`: passed

Production:

- Runtime source commit: `f634bc0`
- Deployment ID: `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot`
- Deployment URL:
  `https://smart-return-system-saas-pji1crs57-kaweis-projects.vercel.app`
- Production alias: `https://smart-return-system-saas.vercel.app`
- Status: Ready

Smoke test:

- Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, `/login`, `/robots.txt`, and
  `/sitemap.xml` returned `200`.
- Tenant protected routes `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login`.
- Platform protected routes `/internal` and `/internal/orgs` returned
  `307 -> /admin/login?next=...`.

Domain note:

- Vercel CLI auto-listed `https://app.smart-return.tw` as an alias and started
  asynchronous SSL creation during the production deployment.
- Codex did not run a separate domain/DNS setup command in this deployment.
- Local DNS still does not resolve `app.smart-return.tw`, so the custom domain
  remains not ready for customer use.

No migration, env/secret edit, separate domain/DNS command, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or unrelated production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Codex for Windows / Claude

Completed the requested post-rollout read-only status check.

Checks:

- Checkout was clean and synced on `develop-saas`.
- HEAD before this docs-only update:
  `37ab5b1 docs(saas): record production deploy of 796a02a`.
- `npm run safety:agent-boundary`: passed.
- Vercel deployment `dpl_28RhEVo2Nespq7xjTEQvmELag34r`: Ready.

Production smoke for `https://smart-return-system-saas.vercel.app`:

- Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, and `/login` returned `200`.
- Tenant protected routes `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login`.
- Platform protected routes `/internal` and `/internal/orgs` returned
  `307 -> /admin/login?next=...`.

Custom domain check:

- Vercel inspect lists `https://app.smart-return.tw` as an alias for
  deployment `dpl_28RhEVo2Nespq7xjTEQvmELag34r`.
- `Resolve-DnsName app.smart-return.tw`: NXDOMAIN /
  `DNS name does not exist`.
- `Resolve-DnsName smart-return.tw`: NXDOMAIN.
- Direct HTTPS checks for `https://app.smart-return.tw` fail because the host
  cannot be resolved.
- `npx vercel domains inspect app.smart-return.tw`: Vercel 403 for the current
  scope.
- `npx vercel domains ls`: 0 domains.
- No TXT ownership verification record was returned by the CLI.

Conclusion:

- Production remains usable at
  `https://smart-return-system-saas.vercel.app`.
- `app.smart-return.tw` remains owner/DNS-blocked until DNS resolves and Vercel
  ownership/SSL verification passes.

No deployment, migration, env/secret edit, DNS mutation, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Codex for Windows / Claude

Completed the owner-authorized production deployment of `develop-saas` HEAD
`796a02a docs(saas): record sequential completion blockers`.

Preflight and gates:

- Checkout: `D:\AI專案\AI退貨系統商業版_2026.5.16`
- Branch: `develop-saas`
- Vercel project: `smart-return-system-saas`
- `npm run safety:agent-boundary`: passed
- `npm run saas:predeploy`: passed

Production:

- Runtime source commit: `796a02a`
- Deployment ID: `dpl_28RhEVo2Nespq7xjTEQvmELag34r`
- Deployment URL:
  `https://smart-return-system-saas-a0vn28pwk-kaweis-projects.vercel.app`
- Production alias: `https://smart-return-system-saas.vercel.app`
- Status: Ready

Smoke test:

- Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, and `/login` returned `200`.
- Tenant protected routes `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login`.
- Platform protected routes `/internal` and `/internal/orgs` returned
  `307 -> /admin/login?next=...`.

Domain note:

- Vercel CLI auto-listed `https://app.smart-return.tw` as an alias and started
  asynchronous SSL creation during the production deployment.
- Codex did not run a separate domain/DNS setup command in this deployment.
- Local DNS still does not resolve `app.smart-return.tw`, so the custom domain
  remains not ready for customer use.

No migration, env/secret edit, separate domain/DNS command, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or unrelated production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Codex for Windows / Claude

Ran the sequential completion readiness check after the owner asked to continue
the remaining queue in order.

Checks:

- Preflight passed on SaaS checkout `develop-saas`.
- `npm run safety:agent-boundary`: passed.
- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail.
  - Warning: local `ENABLE_MULTI_TENANT_ADMIN=true`, expected for local platform
    admin preview.
- `npm run saas:rollout-check`: 22 pass, 3 warn, 0 fail.
  - Local admin password rollout warning.
  - Local Sentry/logging DSN rollout warning. Production Sentry env was
    previously configured; do not commit DSN values.
  - Billing disabled warning, expected for Manual Beta.
- `Resolve-DnsName app.smart-return.tw`: still NXDOMAIN /
  `DNS name does not exist`.

Conclusion:

- No unblocked local implementation task remains in the split queue.
- Domain setup remains blocked until owner/DNS action creates/verifies
  `app.smart-return.tw`.
- Email provider, Billing/ECPay, public signup, production deploy, and
  migrations `033` / `034` / `036` still require explicit owner action or
  authorization.

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Codex for Windows / Claude

Refreshed the split queue after the latest source HEAD `b2fc132`.

Current source / production split:

- Latest pushed source HEAD: `b2fc132 fix(saas/ui): refine platform dashboard
  alerts`.
- Production still runs the last owner-authorized deployment:
  `0c9c983 docs(saas): avoid stale latest head wording` /
  `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`.
- The latest source UI refinements have not been deployed.

Current work split:

- Claude UI: no unblocked UI task is recorded in `agent-shared/TASK_BOARD.md`.
- Codex backend/API/docs: no unblocked backend/API/migration task is recorded.
- External owner-blocked queue remains:
  - DNS/ownership verification for `app.smart-return.tw`.
  - Public signup posture decision.
  - Email provider credentials if owner reopens email delivery.
  - Stage 2 Billing/ECPay credentials plus explicit billing enablement.
  - Separately authorized migrations `033`, `034`, and `036`.

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Claude

Completed the `/internal` dashboard alert-copy refinement from the shared
working tree.

Completed:

- KPI cards on `/internal` are more compact for daily operator scanning.
- The MRR helper copy now uses Chinese operator wording.
- At-risk alert messages use `PLATFORM_ALERT_TYPE_MESSAGE` instead of exposing
  raw backend message strings.
- At-risk alert rows now show `建議動作` through
  `PLATFORM_ALERT_TYPE_ACTION`.

No backend DTO, deployment, migration, env/secret edit, domain/DNS change,
email provider enablement, billing/provider enablement, master/live/internal
Supabase action, or production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Claude

Completed the merchant settings follow-up after removing low-frequency entries
from the main sidebar.

Completed:

- `/settings` now builds its cards from the tenant org context.
- `/settings` shows `設定指引` only when onboarding is still incomplete.
- `/settings` shows `資料與備份` only for owner/admin users.
- `/settings/backup` now has a server-side owner/admin plus exportable gate
  before rendering `BackupSettingsClient`.
- Staff/viewer users keep a simpler settings hub and receive a standard gated
  state if they navigate directly to `/settings/backup`.

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-12 Codex -> Owner / Claude

Finalized the first platform operations UI simplification pass from the shared
working tree.

Completed:

- `/internal/orgs` now renders trial deadline / remaining days from the new
  Codex DTO fields.
- `/internal/orgs` now shows suggested actions for platform risk reasons.
- `/internal/orgs` removes the disabled tenant pause button and keeps the live
  manual beta org form plus one Stage 2 write-operation note.
- `/internal/orgs/[id]` localizes detail labels, member role/status labels,
  risk copy, audit table headers, and suggested actions.
- `/internal/orgs/[id]` collapses disabled plan/status write buttons into one
  Stage 2 note while preserving tenant preview.
- `/internal/billing/events` removes the static Webhook Guard Checklist from
  the operator UI.
- `/internal/billing/events` localizes status summary and table labels.
- `/internal/billing/events` replaces the disabled retry button with one
  read-only Stage 2 note.
- The merchant sidebar removes the low-frequency `/onboarding` and
  `/settings/backup` entries from primary navigation.

Notes:

- This does not enable tenant suspension, plan changes, billing replay, email,
  provider retries, or any Stage 2 write operation.
- Those write-operation closures still belong with the Stage 2 billing backend
  and audit-log work.

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-12 Codex -> Claude

Completed the backend DTO handoff for the platform operations refinement item
`/internal/orgs` Trial 到期日 / 剩餘天數.

Completed:

- `PlatformOrganizationListItem` now includes:
  - `trialEnd: string | null`
  - `daysUntilTrialEnd: number | null`
- `loadPlatformOrganizationsView()` now fetches organization subscription
  snapshots together with usage snapshots and passes them into
  `buildPlatformOrganizationListView()`.
- `loadPlatformOrganizationDetailView()` now fetches the selected
  organization's subscription snapshot and passes it into
  `buildPlatformOrganizationDetailView()`.
- `agent-shared/UI_BACKEND_CONTRACTS.md` documents the new fields.
- Regression coverage was added for the DTO and live data loader.

Claude UI follow-up:

- `/internal/orgs` can render a Trial 到期日 / 剩餘天數 column directly from
  `organization.trialEnd` and `organization.daysUntilTrialEnd`.
- `/internal/orgs/[id]` can reuse the same fields for the detail health or
  billing/trial summary.
- No UI-side Supabase query or API route is needed for these fields.

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-06 Codex -> Owner / Codex for Windows

Retried custom domain verification for `app.smart-return.tw` after the owner
asked to continue verification and alias.

Checks:

- Preflight passed in
  `D:\AI專案\AI退貨系統商業版_2026.5.16` on branch `develop-saas`.
- `npm run safety:agent-boundary`: passed.
- `git pull --ff-only origin develop-saas`: already up to date.
- `Resolve-DnsName app.smart-return.tw`: still returns NXDOMAIN /
  `DNS name does not exist`.
- `npx vercel domains inspect app.smart-return.tw`: still returns 403,
  `You don't have access to the domain app.smart-return.tw under
  kaweis-projects.`
- `npx vercel domains ls`: still reports 0 domains under the current Vercel
  scope.

Result:

- No alias was set because DNS does not resolve and Vercel domain access is
  still blocked.
- No TXT ownership verification record was returned by the Vercel CLI, so there
  is no safe TXT value to report from this checkout yet.
- Production remains available at
  `https://smart-return-system-saas.vercel.app`.

Needed owner/DNS action:

- Add/verify the `app.smart-return.tw` DNS record or provide DNS provider
  access.
- Start with `CNAME app -> cname.vercel-dns.com` unless the Vercel dashboard
  shows a specific TXT ownership challenge.
- If Vercel dashboard shows a TXT ownership record, add that exact TXT record
  first and then ask Codex to retry verification/alias.

No deployment, migration, env/secret edit, email provider enablement,
billing/provider enablement, master/live/internal Supabase action, or unrelated
domain/DNS change was performed.

## 2026-06-06 Codex -> Owner / Codex for Windows

Attempted owner-authorized custom domain setup for `app.smart-return.tw` on the
SaaS Vercel project.

Completed in this handoff:

- Ran preflight and `npm run safety:agent-boundary`; both confirmed
  `develop-saas` / SaaS checkout safety.
- Confirmed Vercel project `smart-return-system-saas`
  (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
- Confirmed `app.smart-return.tw` was not already visible before setup.
- Ran `npx vercel domains add app.smart-return.tw`.
- Vercel printed a project-add success message, then failed to fetch the domain
  with a 403 domain access error.
- Retried domain inspect and alias:
  - `npx vercel domains inspect app.smart-return.tw`
  - `npx vercel alias set smart-return-system-saas-lb3o8btq0-kaweis-projects.vercel.app app.smart-return.tw`
- Both failed with Vercel 403 domain access errors.
- Confirmed `npx vercel domains ls` reports 0 domains under the current Vercel
  scope.
- Confirmed local DNS lookup does not resolve `app.smart-return.tw`.

Current blocker:

- Owner must set/verify DNS ownership before Codex can retry Vercel alias
  verification.
- Recommended DNS start point for the subdomain:
  - Type: `CNAME`
  - Name/Host: `app`
  - Value/Target: `cname.vercel-dns.com`
- If Vercel dashboard displays a TXT ownership challenge, add that exact TXT
  record first.

Files:

- `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/TASK_BOARD.md`

Not performed:

- No migration.
- No env/secret edit.
- No email provider enablement.
- No billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-06-06 Codex -> Owner / Claude / Codex

Completed the owner-authorized production deployment of current
`origin/develop-saas` HEAD to the SaaS Vercel project.

Authorization scope:

- Deploy current `origin/develop-saas` HEAD to Vercel Production project
  `smart-return-system-saas`.
- Required included commit:
  `27c5ecb fix(saas): gate backup and maintenance cron isolation`.
- Do not configure domain/DNS.
- Do not run migrations.
- Do not edit env/secrets.
- Do not enable email provider.
- Do not enable billing/provider.
- Do not touch master/live/internal Supabase.

Predeploy:

- Preflight passed in
  `D:\AI專案\AI退貨系統商業版_2026.5.16` on branch `develop-saas`.
- `git pull --ff-only origin develop-saas`: already up to date.
- Actual deployed HEAD: `0c9c983 docs(saas): avoid stale latest head wording`.
- Confirmed `0c9c983` contains the required `27c5ecb`.
- `.vercel/project.json` confirmed project `smart-return-system-saas`
  (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
- `npm run safety:agent-boundary`: passed.
- `npm run saas:predeploy`: passed.

Production deployment:

- Deployment URL:
  `https://smart-return-system-saas-lb3o8btq0-kaweis-projects.vercel.app`.
- Production alias:
  `https://smart-return-system-saas.vercel.app`.
- Vercel deployment ID: `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`.
- Vercel status: Ready.

Smoke test:

- `200`: `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, `/login`.
- `307 -> /login`: `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, `/settings/usage`.
- `307 -> /admin/login?next=...`: `/internal`, `/internal/orgs`.

Notes:

- No migration was run.
- No env/secret was edited.
- No domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-06-06 Codex -> Owner / Codex for Windows

Clarified the deployment handoff wording after the docs-only handoff commit made
"latest pushed commit is `27c5ecb`" imprecise.

Completed in this handoff:

- Replaced exact "latest pushed commit" wording with "current
  `origin/develop-saas` HEAD is ahead of production".
- Kept `27c5ecb fix(saas): gate backup and maintenance cron isolation` as the
  pending runtime/security change that production must include.
- Preserved the stop rule: no deployment, domain, env, migration, email, or
  billing work without separate explicit owner authorization.

Files:

- `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/TASK_BOARD.md`

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS configuration.
- No email provider enablement.
- No billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-06-06 Codex -> Owner / Codex for Windows

Recorded the post-`27c5ecb` rollout order after the owner asked to continue in
sequence.

Completed in this handoff:

- Clarified that `27c5ecb fix(saas): gate backup and maintenance cron
  isolation` is pushed to `origin/develop-saas`.
- Clarified that production still runs `360c56f` /
  `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`.
- Added a deployment authorization template for deploying only the latest
  pushed SaaS HEAD to Vercel project `smart-return-system-saas`.
- Updated the external setup status and active-work notes so agents do not
  mistake the latest pushed commit for the latest deployed runtime.

Files:

- `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Not performed:

- No deployment.
- No migration.
- No env/secret edit.
- No domain/DNS configuration.
- No email provider enablement.
- No billing/provider enablement.
- No master/live/internal Supabase action.

## 2026-06-06 Codex -> Owner / Codex for Windows

Continued public multi-tenant P2 tenant isolation hardening for backup and
backup cron paths.

Completed in this handoff:

- Rewrote `lib/actions/backup.actions.ts` as an org-scoped backup action.
- Tenant backup history/download/delete now requires owner/admin org context.
- Tenant backup create/restore now requires owner/admin plus writable/exportable
  org context.
- Backup table reads now filter by `org_id`.
- Auto backup records now include `org_id`.
- Backup storage paths now use `backups/{orgId}/...`.
- Download/delete rejects backup file paths outside the active org prefix.
- Restore rejects backups from another org and forces restored rows back to the
  active org id.
- Updated `/api/cron/backup` so it no longer performs a platform-wide backup by
  default.
- Backup cron now skips safely unless `SAAS_BACKUP_ORG_ID` is configured; if
  configured, it runs one explicit-org backup through the hardened backup action.
- Added `lib/maintenance/cron-policy.ts`.
- Non-backup platform maintenance cron routes now skip safely unless
  `ENABLE_PLATFORM_MAINTENANCE_CRON=true` is configured:
  - `/api/cron/reconcile-ai-reports`
  - `/api/cron/scan-retention`
  - `/api/cron/shopee-scan-daily-report`
  - `/api/cron/shopee-scan-smoke`
- Added regression coverage in
  `tests/unit/saas-runtime-org-isolation.test.ts`.

Remaining public rollout queue:

1. Decide whether platform maintenance cron should stay disabled or be enabled
   with `ENABLE_PLATFORM_MAINTENANCE_CRON=true`.
2. Decide policy for maintenance scripts that use service-role clients; they
   should remain local/CI-only or require explicit SaaS project safety gates.
3. If customer portal UX is revised later, pass a verified org-scoped upload
   session before direct uploads so the legacy anonymous staging fallback can be
   removed.

No deployment, migration, env/secret edit, domain/DNS change,
`SAAS_BACKUP_ORG_ID` or `ENABLE_PLATFORM_MAINTENANCE_CRON` Vercel env setting,
email provider enablement, billing/provider enablement, master/live/internal
Supabase action, or production setting mutation was performed.

## 2026-06-06 Codex -> Owner / Claude / Codex

Continued public multi-tenant P1 tenant isolation hardening after the Shopee
actions pass.

Completed in this handoff:

- Hardened `lib/actions/pickup.actions.ts`.
- Pickup read actions now require SaaS org context and filter by `org_id`.
- Pickup write/import/update/delete/scan actions now require writable SaaS org
  context, include `org_id` on inserts, and filter updates/deletes by `org_id`.
- Pickup scan audit metadata now records the active org id.
- Hardened `lib/actions/customer-return.actions.ts`.
- Public customer-return submission now derives tenant scope from an existing
  matched order number + customer phone pair, rejects missing or ambiguous org
  matches, and writes `customers`, `return_requests`, `return_items`,
  `return_images`, and `activity_logs` with the derived `org_id`.
- Customer-return lookups now filter by derived org and reject ambiguous
  cross-org matches.
- Final return image storage paths now use `returns/{orgId}/{returnRequestId}`.
- Hardened `lib/actions/upload.ts`.
- Authenticated upload helpers now require read/writable org context, write
  `return_images.org_id`, filter image reads/deletes by `org_id`, and store
  direct image uploads under `returns/{orgId}/...`.
- Updated upload session/signed-url support so session payloads can carry
  `orgId` and signed upload staging paths can use
  `staging/{orgId}/{draftId}`.
- Kept legacy anonymous staging fallback for current customer portal
  compatibility; final persisted rows and final storage paths are org-scoped.
- Added/updated regression coverage:
  - `tests/unit/saas-runtime-org-isolation.test.ts`
  - `tests/unit/upload-signed-url.route.test.ts`
  - `tests/unit/pickup.actions.test.ts`
  - `tests/backend/pickup-scan.backend.test.ts`

Remaining tenant-isolation queue before broad public multi-tenant:

1. Backup actions must be made platform-only, org-scoped, or disabled.
2. Cron/maintenance service-role jobs must be platform-only or iterate orgs
   explicitly.
3. If customer portal UX is revised later, pass a verified org-scoped upload
   session before direct uploads so the legacy anonymous staging fallback can be
   removed.

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-06 Codex -> Owner / Codex for Windows

Started public multi-tenant hardening after the owner selected
`app.smart-return.tw`, skipped email provider for now, and confirmed the SaaS
will open to many customers.

Completed in this handoff:

- Hardened `lib/actions/shopee-returns.actions.ts` as the first P1 isolation
  target.
- Read paths now require SaaS org context and filter tenant rows by `org_id`.
- Write paths now require writable SaaS org context and include/filter
  `org_id` for imports, status updates, batch updates, delete, scan, create,
  detail update, scan dashboard, unmatched scan list, candidate search, and
  manual bind.
- Scan events and unmatched scan writes now include `org_id`.
- Added regression coverage in `tests/unit/saas-runtime-org-isolation.test.ts`.
- Updated `tests/e2e/shopee-scan-flow.e2e.test.ts` to mock org context and
  chained `org_id` filters.

Owner decisions recorded:

- Custom app domain selected: `app.smart-return.tw`.
- Domain/DNS has not been configured because external domain changes still need
  explicit authorization and DNS authority or DNS records.
- Email provider is skipped for now.
- Billing/ECPay remains Stage 2 only.

Remaining public multi-tenant isolation queue:

1. `lib/actions/pickup.actions.ts`
2. `lib/actions/customer-return.actions.ts`
3. `lib/actions/upload.ts`
4. `app/api/v1/upload/signed-url/route.ts`
5. backup actions
6. cron/maintenance service-role paths

No deployment, migration, env/secret edit, domain/DNS change, email provider
enablement, billing/provider enablement, master/live/internal Supabase action,
or production setting mutation was performed.

## 2026-06-06 Codex -> Owner / Claude / Codex

Applied the owner-authorized onboarding completion migration to the SaaS
Supabase project only.

Scope:

- Owner explicitly authorized applying only
  `035_saas_onboarding_completion_rpc.sql`.
- Target SaaS Supabase project: `auyznbwtjvemyamujmgt`.
- No migration `033`, `034`, or `036` authorization was included.

Preflight and target checks:

- Branch: `develop-saas`.
- Working tree was clean before apply.
- `npm run safety:agent-boundary`: passed.
- `npm run saas:migration-plan:strict`: passed.
- SaaS project checks confirmed:
  - `SAAS_SUPABASE_PROJECT_ID=auyznbwtjvemyamujmgt`
  - `SUPABASE_PROJECT_ID_EXPECTED=auyznbwtjvemyamujmgt`
  - Supabase URL matched the SaaS ref.
  - Forbidden internal/live refs were not targeted.
- Remote migration list before apply showed `033`, `034`, `035`, and `036`
  pending.

Migration result:

- Applied only `supabase/migrations/035_saas_onboarding_completion_rpc.sql`
  via the linked SaaS database query path.
- Repaired remote migration history for version `035` to `applied`.
- Remote migration list after apply shows:
  - `035` applied.
  - `033`, `034`, and `036` still unapplied.
- Verified `public.complete_organization_onboarding(uuid, uuid, timestamptz,
  jsonb)` exists.
- Verified `service_role` can execute the RPC.

Verification:

- `npm run saas:schema-gate:strict`: passed (`22 table(s), 81 column(s)
  checked`).
- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is the existing
  local `ENABLE_MULTI_TENANT_ADMIN=true` flag warning.

Notes:

- No deployment was performed.
- No env/secret was edited.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.
- No migrations `033`, `034`, or `036` were applied.

## 2026-06-06 Codex -> Owner / Codex for Windows

Recorded the post-Sentry next action queue because the owner asked to complete
remaining work in order and hand off anything blocked.

Current state:

- Branch is `develop-saas`.
- Production remains Ready at `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`.
- Production URL remains `https://smart-return-system-saas.vercel.app`.
- Sentry DSN activation is complete in Vercel Production env.
- No unblocked local code task is currently open.

Next action order:

1. Custom/beta domain after the owner provides the target domain and DNS access
   or DNS records.
2. Migration `035_saas_onboarding_completion_rpc.sql` only after explicit
   owner authorization for SaaS Supabase project `auyznbwtjvemyamujmgt`.
3. Email provider only after the owner chooses a provider and supplies real
   credentials out of band.
4. Billing/ECPay only for Stage 2 paid Beta after credentials and
   `ENABLE_BILLING=true` approval exist.
5. Migrations `033`, `034`, and `036` only as separately authorized actions.
6. Public multi-tenant rollout only after the P1/P2 tenant-isolation gaps in
   `docs/SAAS_TENANT_ISOLATION_AUDIT.md` are scheduled and hardened or gated.

Stop condition:

- If the owner asks to "finish everything" without the required values above,
  stop and request the missing value or explicit authorization. Do not set
  placeholder env values, run bundled migrations, enable providers, change DNS,
  or deploy again.

This handoff updated docs/coordination files only. No deployment, migration,
env/secret edit, domain/DNS change, email provider enablement, billing/provider
enablement, master/live/internal Supabase action, or production setting mutation
was performed.

## 2026-06-06 Codex -> Owner / Claude / Codex

Completed SaaS Sentry setup and redeployed production so the Sentry env values
are active.

Summary:

- Created Sentry organization `smart-return-saas` with Google account
  `kawei88888@gmail.com`.
- Sentry showed a 14-day Business trial and stated the account will move to the
  free plan after the trial with no charge.
- Selected the Next.js project setup and copied the Sentry DSN.
- Set Vercel Production env vars on `smart-return-system-saas`:
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
- DSN values were not printed in docs or committed to git.
- Cleared the clipboard after setting env.
- Ran `npm run saas:predeploy`; it passed.
- Redeployed production to `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`.
- Production URL remains `https://smart-return-system-saas.vercel.app`.

Smoke test:

- `200`: `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, `/login`.
- `307 -> /login`: `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, `/settings/usage`.
- `307 -> /admin/login?next=...`: `/internal`, `/internal/orgs`.

Still blocked by external values or separate authorization:

- Custom/beta domain and DNS.
- Email provider selection, sender/domain authentication, and provider keys.
- Billing/ECPay credentials plus explicit provider enablement.
- Applying draft migrations `033`-`036`.
- Any further production deploy or platform setting change.

Notes:

- No migration was run.
- No source code was changed.
- No DSN value was committed.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-06-06 Codex -> Owner / Claude / Codex

Completed the owner-blocked SaaS launch readiness audit with read-only platform
checks and local gates only.

Summary:

- Preflight passed on `develop-saas` at
  `e8fbd95 docs(saas): add external owner action runbook`.
- Confirmed Vercel project `smart-return-system-saas`
  (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
- Confirmed production deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` is Ready.
- Production URL remains `https://smart-return-system-saas.vercel.app`.
- Vercel env names do not list `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
- No custom/beta domain is visible from the Vercel deployment aliases.
- Vercel env names do not list email provider keys for Resend, Postmark,
  SendGrid, SMTP, or equivalent provider credentials.
- Vercel env names do not list `BILLING_PROVIDER`, `ECPAY_MERCHANT_ID`,
  `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, or `ECPAY_MODE`.
- Manual Beta remains billing-disabled; no provider was enabled.
- Draft migrations `033`-`036` remain unapplied. `035` remains the first
  migration candidate only if the owner separately authorizes it.

Verification:

- `npm run safety:agent-boundary`: passed.
- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run saas:rollout-check`: 23 pass, 2 warn, 0 fail. Warnings are missing
  Sentry DSN and `ENABLE_BILLING=false`, both expected for Manual Beta.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:all`: passed.

Files:

- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/prod/internal Supabase action was performed.

## 2026-06-05 Codex -> Owner / Claude / Codex

Added the external owner action runbook and refreshed the remaining blocker
handoff without touching runtime services.

Summary:

- Added `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`.
- Recorded the current production smoke snapshot for
  `https://smart-return-system-saas.vercel.app`.
- Documented owner-provided values required for Sentry DSN, beta/custom domain,
  email provider, Billing/ECPay, and draft migrations `033`-`036`.
- Added copy/paste handoff templates for each external action.
- Ranked migrations `033`-`036` by recommended timing:
  - `035` is the best first candidate if onboarding completion persistence is
    desired.
  - `034` is queue storage for future email delivery.
  - `036` needs a DB-backed platform admin role rollout and seed plan.
  - `033` should wait for Stage 2 billing operations.

Production smoke snapshot:

- Vercel deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` is Ready.
- `200`: `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, `/login`.
- `307 -> /login`: `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, `/settings/usage`.
- `307 -> /admin/login?next=...`: `/internal`, `/internal/orgs`.

Files:

- `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run safety:agent-boundary`: passed.
- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run lint`: passed with 0 warnings.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-06-05 Codex -> Claude / Codex

Completed a read-only post-deploy external blocker audit.

Summary:

- Preflight passed on `develop-saas` at
  `05bf8d2 docs(saas): record latest production deployment`.
- `npx vercel inspect https://smart-return-system-saas.vercel.app` confirmed
  production is still Ready on `dpl_x5K1udVYJBGo1sMEwenry9csz8UR`.
- Production alias remains `https://smart-return-system-saas.vercel.app`.
- `npx vercel env ls` did not list `SENTRY_DSN` or
  `NEXT_PUBLIC_SENTRY_DSN`.
- Vercel env names did not list ECPay/provider credentials or email provider
  keys.
- No custom/beta domain was visible from the read-only Vercel alias/project
  checks.
- Draft migrations `033`-`036` remain present as repo drafts and recorded as
  unapplied.

Still blocked by external values or separate authorization:

- Sentry DSN activation.
- Custom/beta domain and DNS.
- Email provider selection, sender/domain authentication, and provider keys.
- Billing/ECPay credentials plus explicit provider enablement.
- Applying draft migrations `033`-`036`.
- Any further production deploy or platform setting change.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-06-05 Codex -> Claude / Codex

Deployed the latest `develop-saas` UI HEAD to the SaaS Vercel production project
after explicit owner authorization.

Summary:

- Preflight passed on `develop-saas` at
  `9176589 fix(saas/ui): finish public RWD and role separation polish`.
- Ran `npm run saas:predeploy`; it passed before deployment.
- Deployed to Vercel production project `smart-return-system-saas`.
- New Vercel deployment is `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` and is Ready.
- Deployment URL:
  `https://smart-return-system-saas-qrewyhbga-kaweis-projects.vercel.app`.
- Production alias remains `https://smart-return-system-saas.vercel.app`.

Smoke test:

- `200`: `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, `/login`.
- `307 -> /login`: `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, `/settings/usage`.
- `307 -> /admin/login?next=...`: `/internal`, `/internal/orgs`.

Still blocked by external values or separate authorization:

- Sentry DSN is not configured.
- Custom/beta domain is not configured.
- Email provider delivery remains dry-run.
- Billing/ECPay remains disabled.
- Draft migrations `033`-`036` remain unapplied.

Notes:

- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-06-05 Codex -> Claude / Codex

Completed public marketing/legal RWD QA and customer/platform role-separation
UI status recording.

Scope:

- UI-only public marketing touch-target polish.
- Codex-owned handoff documentation.
- No backend/API/server action/migration/env/billing/provider changes.

Changed UI files:

- `components/marketing/site-shell.tsx`
- `components/marketing/mobile-nav.tsx`
- `app/features/returns/page.tsx`
- `app/features/ai/page.tsx`
- `app/features/security/page.tsx`
- `app/contact/page.tsx`
- `app/signup/page.tsx`
- `app/login/page.tsx`

QA:

- Local server: `http://localhost:3002`.
- Public route HTTP smoke returned `200` for:
  - `/features/returns`
  - `/features/ai`
  - `/features/security`
  - `/contact`
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/refund`
  - `/signup`
- Chrome DevTools mobile viewport `390x844` found no horizontal overflow on
  those routes.
- Public marketing nav links and CTAs now meet 44px touch target sizing.
- `/login` now wraps the search-param-dependent client UI in Suspense, fixing
  the Next 16 production build prerender requirement without changing auth
  actions or redirect behavior.
- DevTools console showed only expected development info/HMR messages during
  the local QA pass.
- `npm run lint` currently reports no warnings.

Role separation status:

- `/login?next=/internal...` already distinguishes platform admin login from
  merchant login through recent UI commits.
- `/internal` gated/forbidden states explain platform-admin account switching.
- Merchant sidebar remains focused on merchant workflows and does not include
  platform-management entries.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider/domain setting was changed.
- No master/live/prod/internal Supabase action was performed.

## 2026-05-29 Codex -> Claude / Codex

Refreshed the SaaS tenant isolation audit with read-only checks only.

Summary:

- Preflight passed on `develop-saas`; working tree was clean before the audit.
- Current local HEAD before this documentation update was
  `097aea8 fix(saas/ui): meet iOS HIG 44px touch targets on marketing shell`.
- `npm run saas:schema-gate:strict` passed read-only with
  `22 table(s), 81 column(s) checked`.
- P0 runtime isolation remains covered for:
  - `lib/actions/return.actions.ts`
  - `app/api/v1/ai/analyze/route.ts`
  - `app/api/v1/admin/returns/export/route.ts`
  - `app/api/v1/admin/shopee-returns/export/route.ts`
  - `app/api/v1/admin/pickup/export/route.ts`
- Public multi-tenant still has P1/P2 gaps because service-role-heavy legacy
  paths still need tenant context or explicit gating:
  - `lib/actions/shopee-returns.actions.ts`
  - `lib/actions/pickup.actions.ts`
  - `lib/actions/customer-return.actions.ts`
  - `lib/actions/upload.ts`
  - `app/api/v1/upload/signed-url/route.ts`
  - `lib/actions/backup.actions.ts`
  - cron/maintenance service-role jobs

Notes:

- `proxy.ts` was not changed; current Next 16.2.6 build behavior recognizes it
  as Proxy / Middleware.
- No migration was run.
- No deployment was performed.
- No env/secret was edited.
- No billing/provider/domain setting was changed.
- No master/live/prod/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Deployed the latest `develop-saas` HEAD to the SaaS Vercel production project
after the owner requested completing the remaining launch work that could be
done from this checkout.

Summary:

- Ran `npm run saas:predeploy` locally before deployment.
- Deployed `c335410 chore(saas): clean up non-ui lint warnings` to
  `smart-return-system-saas`.
- New Vercel deployment is `dpl_4rT9FztGCfh6QxcM9mUHzaBPkSzh` and is Ready.
- Production alias is `https://smart-return-system-saas.vercel.app`.
- Public smoke passed.
- Unauthenticated tenant routes redirect to `/login`.
- Unauthenticated platform routes redirect to `/admin/login?next=...`.

Smoke test:

- `200`: `/`, `/pricing`, `/features/returns`, `/features/ai`,
  `/features/security`, `/contact`, `/signup`, `/login`.
- `307`: `/admin`, `/admin/login`.
- `307 -> /login`: `/analytics`, `/returns`, `/pickup/scan`,
  `/analytics/ai-report`, `/settings/usage`.
- `307 -> /admin/login?next=...`: `/internal`, `/internal/orgs`.

Still blocked by missing external values:

- Sentry DSN is not configured; no real SaaS DSN is available locally or in
  Vercel env.
- Custom/beta domain is not configured; no target domain/DNS access was
  provided.
- Email provider delivery remains dry-run; no provider/API credentials were
  provided.
- Billing/ECPay remains disabled; no ECPay credentials were provided.
- Draft migrations `033`-`036` remain unapplied.

Verification:

- `npm run saas:predeploy`: passed.
- Vercel deployment: Ready.
- Production smoke: passed.

Notes:

- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Completed a Codex-owned non-UI lint warning cleanup without changing runtime
contracts or external settings.

Summary:

- Removed unused local variables from `lib/actions/upload.ts`.
- Replaced rest-destructure discard patterns in `lib/utils/return-ranking.ts`
  and `lib/utils/ai-sku-analysis.ts` with explicit DTO construction.
- Removed unused Supabase query result bindings from `scripts/health-check.ts`.
- Known lint warnings dropped from 44 to 31.
- Remaining lint warnings are in UI/component paths and stay in Claude scope.

Files:

- `lib/actions/upload.ts`
- `lib/utils/return-ranking.ts`
- `lib/utils/ai-sku-analysis.ts`
- `scripts/health-check.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run test:unit -- tests/unit/return-ranking.test.ts tests/unit/ai-sku-analysis.test.ts tests/unit/normalize-ai-sku-output.test.ts tests/unit/ai-analysis-prompt.test.ts tests/unit/ai-analysis-fallback.test.ts`: passed as part of the unit suite, 71 files and 388 tests.
- `npm run lint`: 0 errors and 31 remaining warnings.
- `npm run typecheck`: passed.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Cleaned up stale-prone handoff wording after the post-hardening docs refresh.

Summary:

- Replaced exact "latest pushed HEAD is `b3bf314`" wording with "latest runtime
  hardening commit is `b3bf314`" where appropriate.
- Current docs/status refresh commits after `b3bf314` are now documented as
  non-runtime changes, so future docs-only commits do not immediately make the
  handoff state inconsistent.
- Codex still has no unblocked backend/API/migration task open.
- Production remains on `a3af638` / `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` until
  owner explicitly authorizes another SaaS deploy/promote.

Files:

- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run safety:agent-boundary`: passed.
- `npm run saas:doctor`: passed.
- `npm run lint`: passed.

Notes:

- Documentation-only status cleanup.
- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Refreshed the post-hardening handoff state after the public signup rate-limit
commit.

Summary:

- Current pushed `develop-saas` HEAD is
  `b3bf314 fix(saas): throttle public signup requests`.
- Codex has no unblocked backend/API/migration work open after launch security
  headers, admin-login throttling, mutation same-origin guard, and public signup
  throttling.
- Production remains on `a3af638` / `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` until
  owner explicitly authorizes another SaaS deploy/promote.
- Remaining work is external/owner-blocked: Sentry DSN, beta/custom domain,
  email provider delivery, Billing/ECPay, draft migrations `033`-`036`, and any
  production deploy/platform setting change.

Files:

- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run safety:agent-boundary`: passed.
- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run lint`: 0 errors and existing 44 warnings.

Notes:

- Documentation-only status refresh.
- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Implemented public signup request throttling without enabling public signup or
touching external services.

Summary:

- Added `lib/security/request-rate-limit.ts`.
- Applied best-effort in-memory throttling to `POST /api/saas/signup`.
- The rate-limit key uses scope, forwarded client IP, and user agent.
- Public signup remains closed by `ENABLE_PUBLIC_SIGNUP=false`.
- Added unit coverage and SaaS doctor coverage.

Files:

- `lib/security/request-rate-limit.ts`
- `app/api/saas/signup/route.ts`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/request-rate-limit.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run test:unit -- tests/unit/request-rate-limit.test.ts tests/unit/saas-public-signup-request.test.ts tests/unit/saas-public-signup.test.ts`:
  passed as part of the unit suite, 71 files and 388 tests.
- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run lint`: 0 errors and existing 44 warnings.
- `npm run typecheck`: passed.
- `npm audit --audit-level=high`: passed with no high-severity advisories.
- `npm run saas:predeploy`: passed. Rollout warnings were the expected dirty
  local tree before commit, missing Sentry DSN, and billing disabled for Manual
  Beta.

Notes:

- This is per-runtime memory state and does not replace edge/WAF or persistent
  rate limiting before broad public traffic.
- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Implemented same-origin hardening for browser-driven mutation API routes without
external production changes.

Summary:

- Added `lib/security/same-origin.ts`.
- The shared guard rejects explicit cross-site browser mutation requests using
  `Sec-Fetch-Site`, `Origin`, and `Referer`.
- The guard allows requests without browser origin headers so local tests and
  non-browser clients are not silently blocked.
- Applied the guard to upload session/signed-url, AI analyze, SaaS signup,
  invite accept, onboarding complete, team invite, and internal platform admin
  mutation routes.
- ECPay webhook, cron routes, and schema drift alert remain intentionally
  excluded because they are provider/secret-gated server-to-server endpoints.
- Added unit coverage and SaaS doctor coverage.

Files:

- `lib/security/same-origin.ts`
- `app/api/v1/upload/session/route.ts`
- `app/api/v1/upload/signed-url/route.ts`
- `app/api/v1/ai/analyze/route.ts`
- `app/api/saas/signup/route.ts`
- `app/api/saas/invite/accept/route.ts`
- `app/api/saas/onboarding/complete/route.ts`
- `app/api/saas/team/invites/route.ts`
- `app/api/internal/saas/orgs/route.ts`
- `app/api/internal/saas/orgs/[id]/preview/route.ts`
- `app/api/internal/saas/tenant-preview/route.ts`
- `app/api/internal/saas/platform-admins/route.ts`
- `app/api/internal/saas/billing/operations/route.ts`
- `app/api/internal/saas/billing/events/[id]/retry/route.ts`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/same-origin-request.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run test:unit -- tests/unit/same-origin-request.test.ts tests/unit/upload-session.route.test.ts tests/unit/upload-signed-url.route.test.ts tests/unit/saas-team-invite-route.test.ts tests/unit/saas-onboarding-route.test.ts tests/unit/saas-invite-accept-route.test.ts tests/unit/saas-platform-admin-routes.test.ts tests/unit/security-headers.test.ts`:
  passed as part of the unit suite, 70 files and 384 tests.
- `npm run saas:doctor`: 153 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run lint`: 0 errors and existing 44 warnings.
- `npm run typecheck`: passed.
- `npm audit --audit-level=high`: passed with no high-severity advisories.
- `npm run saas:predeploy`: passed. Rollout warnings were the expected dirty
  local tree before commit, missing Sentry DSN, and billing disabled for Manual
  Beta.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Implemented the next repo-local security item from the launch audit without
external production changes.

Summary:

- Added best-effort platform admin password login throttling.
- Throttle keys combine the attempted admin login id with the forwarded client
  IP.
- Repeated failed platform admin password attempts lock that key for the
  configured lockout window.
- Successful platform admin login clears the failure counter.
- Added unit coverage and SaaS doctor coverage for the throttle contract.
- Reviewed the external audit note about `proxy.ts`; no rename was performed
  because this project is pinned to Next.js `16.2.6` and local builds recognize
  `proxy.ts` as `Proxy (Middleware)`.

Files:

- `lib/auth/admin-login-rate-limit.ts`
- `lib/actions/auth.ts`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/admin-login-rate-limit.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run test:unit -- tests/unit/admin-login-rate-limit.test.ts tests/unit/admin-login.test.ts tests/unit/post-login-redirect.test.ts tests/unit/security-headers.test.ts`:
  passed as part of the unit suite, 69 files and 378 tests.
- `npm run saas:doctor`: 151 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run lint`: 0 errors and existing 44 warnings.
- `npm run typecheck`: passed.
- `npm audit --audit-level=high`: passed with no high-severity advisories.
- `npm run saas:predeploy`: passed. Rollout warnings were the expected dirty
  local tree before commit, missing Sentry DSN, and billing disabled for Manual
  Beta.

Notes:

- This is an in-memory per-runtime throttle, not a persistent WAF/edge rate
  limit. Public rollout should still add provider-level rate limiting.
- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Recorded post-push Vercel Preview status after the launch security hardening
commit.

Summary:

- `82d8b0d fix(saas): harden launch security posture` is pushed to
  `origin/develop-saas`.
- Immediate Vercel read-only checks did not show a fresh Preview deployment for
  `82d8b0d`.
- The branch alias
  `https://smart-return-system-saas-git-develop-saas-kaweis-projects.vercel.app`
  still resolves to old Preview deployment `dpl_5qqTLC2gQ6AZKWoF2oqteygma4nd`.
- Production remains on `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`.

Files:

- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run safety:agent-boundary`: passed.
- `vercel project inspect smart-return-system-saas`: linked to SaaS project
  `prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`.
- `vercel inspect https://smart-return-system-saas-git-develop-saas-kaweis-projects.vercel.app`:
  old Preview `dpl_5qqTLC2gQ6AZKWoF2oqteygma4nd`.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-28 Codex -> Claude / Codex

Prepared launch security hardening without external production changes.

Summary:

- Added shared browser security headers in `lib/security/headers.ts`.
- Wired those headers through `next.config.ts` for all routes.
- Added unit tests for the header policy.
- Added SaaS doctor/readiness coverage for the header wiring.
- Ran non-breaking npm audit remediation and pinned `next` to `16.2.6`.
- Did not apply `npm audit fix --force`; npm reports that the remaining
  moderate advisories require breaking dependency changes.

Files:

- `lib/security/headers.ts`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/security-headers.test.ts`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run test:unit -- tests/unit/security-headers.test.ts`: passed as part of
  the unit suite, 68 files and 374 tests.
- `npm run saas:doctor`: 149 pass, 1 warn, 0 fail.
- `npm run lint`: 0 errors and existing 44 warnings.
- `npm run typecheck`: passed.
- `npm run saas:predeploy`: passed.
- `npm audit --audit-level=high`: no high-severity advisories.
- `npm audit --omit=dev --audit-level=moderate`: still reports 4 moderate
  nested `next -> postcss` and `exceljs -> uuid` advisories.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Recorded current Git/Vercel linkage and production gap after the latest
customer/platform role-separation work.

Summary:

- Current `develop-saas` HEAD is
  `bf371b8 fix(saas): redirect merchant admin entry to workspace`.
- Local `.vercel/project.json` links this checkout to Vercel project
  `smart-return-system-saas`.
- `develop-saas` pushes create Vercel Preview deployments and update the branch
  alias `https://smart-return-system-saas-git-develop-saas-kaweis-projects.vercel.app`.
- Latest observed Preview deployment is
  `dpl_5qqTLC2gQ6AZKWoF2oqteygma4nd`.
- Production remains on
  `a3af638 fix(saas): keep onboarding guide available on legacy policy recursion`
  / `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` until owner explicitly authorizes
  another production deploy or promote.

Files:

- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Verification:

- `npm run safety:agent-boundary`: passed.
- `npm run lint`: passed, 0 errors and existing 44 warnings.
- `vercel inspect https://smart-return-system-saas.vercel.app`: production
  deployment `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`, status Ready.
- `vercel ls smart-return-system-saas --yes`: latest `develop-saas` activity is
  Preview, not Production.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Closed the authenticated merchant `/admin` entry mismatch.

Summary:

- Added `resolveAuthenticatedAdminEntryRedirect()` to the proxy redirect policy.
- Authenticated merchant users who visit `/admin` now return to `/analytics`.
- Platform admins still pass through `/admin` to the existing `/internal`
  operator console redirect.
- Direct `/internal/*` access for authenticated non-admin users remains gated
  instead of being silently redirected, so Claude can render the explicit
  forbidden/switch-account state.

Files:

- `lib/auth/proxy-login-redirect.ts`
- `proxy.ts`
- `tests/unit/proxy-login-redirect.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Verification:

- `npx vitest run tests/unit/proxy-login-redirect.test.ts tests/unit/platform-admin-identity.test.ts tests/unit/post-login-redirect.test.ts`: passed.
- `npm run saas:doctor`: 147 pass, 1 warn, 0 fail.
- `npm run lint`: 0 errors, existing 44 warnings.
- `npm run typecheck`: passed.
- `npm run saas:predeploy`: passed.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Closed the proxy-level login redirect gap for authenticated platform admins.

Summary:

- Added `lib/auth/proxy-login-redirect.ts` for the pure login redirect policy
  used by `proxy.ts` after a viewer is already authenticated.
- `proxy.ts` now uses `isExplicitPlatformAdminPrincipal()` for Supabase
  platform admins, matching the server action and route guard identity rules.
- Authenticated platform admins who visit `/login` go to `/internal`.
- Authenticated platform admins who visit `/login?next=/internal/orgs` go to
  that safe internal path.
- Authenticated merchants still go to `/analytics`, even if they try to pass an
  `/internal/*` next path.

Files:

- `lib/auth/proxy-login-redirect.ts`
- `proxy.ts`
- `tests/unit/proxy-login-redirect.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Verification:

- `npx vitest run tests/unit/proxy-login-redirect.test.ts tests/unit/platform-admin-identity.test.ts tests/unit/post-login-redirect.test.ts`: passed.
- `npm run saas:doctor`: 147 pass, 1 warn, 0 fail.
- `npm run lint`: 0 errors, existing 44 warnings.
- `npm run typecheck`: passed.
- `npm run saas:predeploy`: passed.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Hardened customer/platform identity separation for platform admin access.

Summary:

- Added `lib/auth/platform-admin-identity.ts` as the single backend check for
  explicit platform admin principals.
- Platform admin access now accepts:
  - the signed internal admin session (`admin` login path),
  - explicit `ADMIN_EMAIL`,
  - email-style `ADMIN_USERNAME`,
  - valid `PLATFORM_ADMIN_ROLES` mappings by email or user id.
- Legacy tenant/profile roles such as `users.role='admin'` no longer grant
  `/internal/*` access or post-login redirects to `/internal`.
- Merchant users with tenant admin permissions stay in the merchant workspace.
- `npm run saas:doctor` now verifies the explicit identity split through the
  auth redirect/readiness contract.

Files:

- `lib/auth/platform-admin-identity.ts`
- `lib/auth/route-auth.ts`
- `lib/actions/auth.ts`
- `lib/auth/post-login-redirect.ts`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/platform-admin-identity.test.ts`
- `tests/unit/post-login-redirect.test.ts`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Verification:

- `npx vitest run tests/unit/platform-admin-identity.test.ts tests/unit/post-login-redirect.test.ts tests/unit/admin-login.test.ts`: passed.
- `npm run saas:doctor`: 147 pass, 1 warn, 0 fail.
- `npm run lint`: 0 errors, existing 44 warnings.
- `npm run typecheck`: passed.
- `npm run saas:predeploy`: passed.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Recorded latest Git readiness after the customer/platform role-separation
follow-up.

Summary:

- Latest application/UI HEAD before this docs record is now:
  - `a63cfe2 fix(saas/ui): align /not-found copy and palette with SaaS branding`
- Recent relevant commits:
  - `1426e7c fix(saas): route platform admin entry through proxy`
  - `ca773c8 fix(saas/ui): align login page with SaaS branding`
  - `31e2362 feat(saas/ui): add loading skeleton for /internal pages`
  - `a63cfe2 fix(saas/ui): align /not-found copy and palette with SaaS branding`
- Local `npm run saas:predeploy` passes for the latest HEAD.
- Production remains on:
  - `a3af638 fix(saas): keep onboarding guide available on legacy policy recursion`
  - Vercel deployment `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`
- Latest Git HEAD is not yet deployed to production.

Verification:

- `npm run safety:agent-boundary`: passed.
- `npm run saas:doctor`: 147 pass, 1 warn, 0 fail.
- `npm run saas:predeploy`: passed.
- `lint`: 0 errors and existing 44 warnings.
- `test:all`: passed.
- `saas:build`: passed.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No custom domain/DNS was configured.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Added canonical platform admin entry routes for clearer customer/admin
separation.

Summary:

- Customer/merchant workspace remains on the normal tenant routes, with
  `/login` landing merchants on `/analytics`.
- Platform admin workspace remains on `/internal/*`.
- New operator-facing aliases:
  - `/admin` redirects to `/internal`.
  - `/admin/login` redirects to `/login?next=/internal...`.
- Unauthenticated `/internal/*` access now redirects through `/admin/login`
  instead of the generic `/login` entry.
- `/admin/login` is explicitly public so operators can reach the shared login
  form before authentication.
- The proxy redirects unauthenticated `/admin` and `/internal/*` requests to
  `/admin/login?next=<safe internal path>` before page loaders run.
- Authenticated non-admin users still remain forbidden on `/internal/*`; this
  prevents merchant accounts from entering the platform console.

Files:

- `app/admin/page.tsx`
- `app/admin/login/page.tsx`
- `lib/auth/public-routes.ts`
- `lib/auth/internal-login-redirect.ts`
- `proxy.ts`
- `scripts/saas/readiness-check.mjs`
- `tests/unit/internal-login-redirect.test.ts`
- `tests/unit/public-routes.test.ts`

Claude UI follow-up:

- Update login copy so merchants see "商家登入" and operators have a clear
  "平台管理者登入" path.
- Update internal forbidden states to explain "你目前登入的是商家帳號，請登出後使用平台管理者帳號".
- Keep the customer sidebar focused on merchant workflows; do not add platform
  admin navigation to the tenant sidebar.

Notes:

- No deployment was performed.
- No migration was run.
- No env/secret was edited.
- No billing/provider was enabled.
- No master/live/prod change was performed.

## 2026-05-27 Codex -> Claude / Codex

Recorded the onboarding guide hotfix and production deployment.

Summary:

- Customer `/onboarding` failed because the optional return-policy signal reads
  legacy `system_settings`, whose RLS path can recurse through `public.users`.
- The setting guide is still useful for new customers, so it was kept.
- The fix treats only that legacy `users` recursion as an incomplete optional
  signal and continues rendering the rest of onboarding progress.
- Other repository/query failures still surface as errors.

Commit:

```text
a3af638 fix(saas): keep onboarding guide available on legacy policy recursion
```

Files:

- `lib/saas/onboarding-live-data.ts`
- `tests/unit/saas-onboarding-live-data.test.ts`

Verification:

- `npx vitest run tests/unit/saas-onboarding-live-data.test.ts`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed, 0 errors and existing 44 warnings.
- `npm run saas:predeploy`: passed.

Production deployment:

- Deployment ID: `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`
- Status: Ready
- Production URL: `https://smart-return-system-saas.vercel.app`
- Unauthenticated smoke:
  - `/`: 200
  - `/login`: 200
  - `/onboarding`: 307 -> `/login`
  - `/settings/usage`: 307 -> `/login`

Notes:

- No migration was run.
- No env/secret was edited.
- No Sentry DSN was configured.
- No domain/DNS change was made.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-27 Codex -> Claude / Codex

Recorded the owner-authorized latest HEAD production deployment.

Deployment summary:

- Deployed latest `develop-saas` HEAD:
  - `c699e70 docs(saas): record latest deploy readiness status`
- Vercel project:
  - `smart-return-system-saas`
- New production deployment:
  - `dpl_9KFNXG1Cw6k54uvSJNuruJchDb5H`
- Production URL:
  - `https://smart-return-system-saas.vercel.app`
- Deployment status:
  - Ready

Predeploy gates:

```text
npm run safety:agent-boundary
npm run saas:doctor
npm run saas:rollout-check:strict
npm run lint
npm run typecheck
npm run test:all
npm run build
npm run saas:predeploy
```

Results:

- All gates passed.
- `saas:doctor`: 147 pass, 1 warn, 0 fail. The warning was local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `saas:rollout-check:strict`: 23 pass, 2 warn, 0 fail. Warnings were missing
  Sentry DSN and `ENABLE_BILLING=false`, expected for Manual Beta.
- `lint`: 0 errors, existing 44 warnings.
- `test:all`: passed.
- `saas:predeploy`: passed.

Production smoke:

- Public routes returned 200:
  - `/`
  - `/pricing`
  - `/features/returns`
  - `/features/ai`
  - `/features/security`
  - `/contact`
  - `/signup`
  - `/login`
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/refund`
- Protected unauthenticated routes returned 307 to `/login`:
  - `/returns`
  - `/pickup/scan`
  - `/analytics/ai-report`
  - `/settings/usage`
  - `/internal/orgs`

Sentry status:

- Sentry SDK is wired in code.
- No usable `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` exists locally or in
  Vercel production env, so monitoring is not active.
- No DSN value was written to the repo.

Not performed:

- No migration was run.
- No env/secret was edited.
- No domain/DNS change was made.
- No email provider was enabled.
- No billing/provider was enabled.
- No master/live/internal Supabase action was performed.

## 2026-05-26 Codex -> Claude / Codex

Recorded the latest SaaS deploy readiness state after the UI handoff docs.

Summary:

- Preflight and read-only git checks confirmed `develop-saas` is synchronized
  with `origin/develop-saas` at
  `4a1d7f8 docs(saas): record latest ui handoffs`.
- Latest HEAD includes Claude UI improvements through
  `615ce7c fix(saas/ui): add mobile nav drawer on marketing shell`.
- `vercel inspect https://smart-return-system-saas.vercel.app` confirmed
  deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` is still Ready.
- Production URL remains `https://smart-return-system-saas.vercel.app`.
- Production still points at the earlier Closed Manual Beta deployment recorded
  as `99c4046 feat(saas): add Sentry runtime configuration`; deploying latest
  HEAD still requires explicit owner authorization.
- Recent Vercel deployments observed are Preview deployments only.

Future latest-HEAD deploy gate if owner explicitly authorizes it:

```text
npm run safety:agent-boundary
npm run saas:doctor
npm run saas:rollout-check:strict
npm run lint
npm run typecheck
npm run test:all
npm run build
npm run saas:predeploy
```

Owner decisions still required:

- Add SaaS-only `SENTRY_DSN` and optionally `NEXT_PUBLIC_SENTRY_DSN` in Vercel;
  never write DSN values to repo files.
- Choose and configure beta/custom domain strategy; no domain/DNS setting is
  currently configured.
- Choose and authorize email provider delivery before leaving dry-run mode.
- Provide and authorize Billing/ECPay Stage 2 credentials before enabling
  billing/provider behavior.
- Explicitly authorize any migration apply for drafts `033`-`036`.
- Explicitly authorize production deploy of latest HEAD if the latest UI
  improvements should go live.

Notes:

- No deployment, migration, env/secret edit, domain/DNS change,
  billing/provider enablement, master/live/prod change, or production/internal
  Supabase action was performed by this deploy readiness refresh.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's latest UI handoffs after the external blocker refresh.

Commits:

```text
e8fa91f feat(saas/ui): localize at-risk and health metric labels
0dc1fcb refactor(saas/ui): unify settings sub-pages on PageHeader component
64e6345 feat(saas/ui): show trial countdown and cancellation banners on billing
60e702d feat(saas/ui): add next-step focus card on onboarding guide
615ce7c fix(saas/ui): add mobile nav drawer on marketing shell
```

Files reported by commits:

- `app/internal/page.tsx`
- `app/internal/orgs/page.tsx`
- `app/internal/orgs/[id]/page.tsx`
- `components/internal/platform-labels.ts`
- `app/(admin)/settings/billing/page.tsx`
- `app/(admin)/settings/team/page.tsx`
- `app/(admin)/settings/usage/page.tsx`
- `app/(admin)/onboarding/page.tsx`
- `components/marketing/mobile-nav.tsx`
- `components/marketing/site-shell.tsx`

UI handoff summary:

- Platform at-risk, health, org status, risk reason, and alert severity labels
  are now localized for operators without changing the dashboard DTO contract.
- Settings billing/team/usage headers now share `PageHeader`.
- Billing now surfaces trial countdown and cancel-at-period-end banners from
  existing billing DTO fields.
- `/onboarding` now highlights the current next step above the progress card
  using existing `loadSaaSOnboardingView()` data.
- Marketing pages now have a mobile drawer for public links, legal links, and
  login below `md`, while preserving the existing desktop nav and sticky CTA.

Remaining split:

- Claude still owns final public marketing/legal desktop and mobile RWD QA.
- Codex has no unblocked backend/API/migration task open after these handoffs.
- Onboarding completion writes still require explicit owner approval and
  migration `035` apply before production enablement.

Notes:

- Claude commits report UI-only or UI-refactor-only scope.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.
- No deployment, migration, env/secret edit, domain/DNS change,
  billing/provider enablement, master/live/prod change, or production/internal
  Supabase action was performed by this coordination refresh.

## 2026-05-26 Codex -> Claude / Codex

Refreshed the SaaS external rollout blocker status with read-only checks.

Summary:

- Preflight passed on `develop-saas`; latest observed HEAD was
  `64e6345 feat(saas/ui): show trial countdown and cancellation banners on billing`.
- `vercel inspect https://smart-return-system-saas.vercel.app` confirmed
  deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` is still Ready.
- Production URL remains `https://smart-return-system-saas.vercel.app`.
- `vercel domains ls` reported zero custom domains under the account.
- `vercel env ls` showed SaaS production env values for Supabase, Gemini,
  admin, cron, feature flags, and `NEXT_PUBLIC_APP_URL`, but did not show:
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `ECPAY_MERCHANT_ID`
  - `ECPAY_HASH_KEY`
  - `ECPAY_HASH_IV`
  - `ECPAY_MODE`
- Email provider delivery remains dry-run only.
- Billing remains disabled and ECPay belongs to Stage 2.
- Draft migrations remain unapplied:
  - `033_saas_platform_billing_operations.sql`
  - `034_saas_notification_email_queue.sql`
  - `035_saas_onboarding_completion_rpc.sql`
  - `036_saas_platform_admin_roles.sql`

Owner decisions still required:

- Add SaaS-only Sentry DSN values in Vercel, or explicitly continue log-only
  Closed Manual Beta monitoring.
- Choose a beta/custom domain and complete DNS/Vercel domain verification.
- Choose and authorize an email delivery provider before leaving dry-run.
- Provide ECPay credentials and authorize `ENABLE_BILLING=true` only for Stage 2.
- Explicitly authorize any migration apply, deploy, domain/DNS change, or Vercel
  production setting change.

Notes:

- No deployment, migration, env/secret edit, domain/DNS change, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action was
  performed by this refresh.

## 2026-05-26 Codex -> Claude / Codex

Refreshed the split queue after the tenant preview and onboarding UI handoffs.

Summary:

- Claude owns the next executable UI-only queue: at-risk/health presentation,
  settings UI refinement, onboarding screens, and public/RWD QA.
- Codex has no unblocked backend/API/migration task open after the role
  separation, onboarding, platform dashboard, tenant preview, and audit
  contracts.
- Codex remains responsible for recording Claude handoffs, updating
  readiness/docs/tests, and adding backend contracts only when Claude needs a
  new contract or the owner explicitly authorizes one.
- External work remains owner-blocked: Sentry DSN activation, Billing/ECPay plus
  `ENABLE_BILLING`, beta/custom domain, email provider delivery, applying draft
  migrations `033`-`036`, and any production deploy or platform setting change.

Notes:

- No UI, backend, migration, deployment, env/secret, billing/provider,
  master/live/prod, or production/internal Supabase change was performed by
  this coordination refresh.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's tenant preview start button UI handoff.

Commit:

```text
85f65bd feat(saas/ui): add "以此租戶身分查看" entry on org detail
```

Files reported by commit:

- `app/internal/orgs/[id]/page.tsx`
- `components/internal/start-tenant-preview-button.tsx`

UI handoff summary:

- `/internal/orgs/[id]` now shows an `以此租戶身分查看` action when org
  detail data is ready.
- The client button calls `POST /api/internal/saas/orgs/[id]/preview`, shows
  backend errors through toast, and routes to the returned preview path.
- Page helper copy now explains that tenant preview is read-only and lasts one
  hour.

Notes:

- Claude commit reports UI/route-consumption only.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's tenant preview banner UI handoff.

Commit:

```text
da23eff feat(saas/ui): add tenant preview banner across (admin) pages
```

Files reported by commit:

- `app/(admin)/template.tsx`
- `components/saas/tenant-preview-banner.tsx`
- `components/saas/tenant-preview-exit-button.tsx`

UI handoff summary:

- `(admin)` tenant pages now show an orange read-only tenant preview banner
  when `loadPlatformTenantPreviewMode()` returns `state: 'ready'`.
- The banner makes the preview target visible before tenant content.
- The exit button calls `DELETE /api/internal/saas/tenant-preview`, then returns
  to the backend-provided `exitPath` and refreshes the route.

Remaining split:

- Claude still owns any `/internal/orgs/[id]` start-preview button or visual
  placement.
- Codex owns any backend permission, audit, or tenant-context changes.

Notes:

- Claude commit reports UI/composition only.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's onboarding progress banner UI handoff.

Commit:

```text
1924065 feat(saas/ui): show onboarding progress banner across tenant pages
```

Files reported by commit:

- `app/(admin)/template.tsx`
- `components/saas/onboarding-progress-banner.tsx`

UI handoff summary:

- `(admin)` tenant pages now show a setup-progress banner from
  `loadSaaSOnboardingView()` while onboarding is incomplete.
- The banner links to `/onboarding`, shows percentage complete and remaining
  steps, and stays silent for gated/empty/error states.

Notes:

- Claude commit reports UI/composition only.
- Codex did not edit those UI files in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Recorded Claude's onboarding sidebar entry UI handoff.

Commit:

```text
f46c344 feat(saas/ui): surface onboarding in tenant sidebar
```

Files reported by commit:

- `app/(admin)/layout.tsx`

UI handoff summary:

- The tenant sidebar now links to `/onboarding` as `設定指引`.
- The item uses the Compass icon and sits between AI analysis and settings.
- This gives customers a visible path into the setup guide after first login.

Notes:

- Claude commit reports UI/navigation only.
- Codex did not edit that UI file in this follow-up; this entry records the
  handoff in Codex-owned `agent-shared/**`.

## 2026-05-26 Codex -> Claude / Codex

Added audit trail coverage to the platform tenant preview contract.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-tenant-preview.ts`
- `app/api/internal/saas/orgs/[id]/preview/route.ts`
- `app/api/internal/saas/tenant-preview/route.ts`
- `tests/unit/saas-platform-tenant-preview.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Contract update:

- `POST /api/internal/saas/orgs/[id]/preview` now writes
  `audit_logs.action = platform.tenant_preview_started` before it returns the
  signed preview cookie.
- The start response includes `auditLogId`.
- `DELETE /api/internal/saas/tenant-preview` attempts to write
  `platform.tenant_preview_cleared` with the preview target if the signed cookie
  is still valid.
- Clear uses best-effort audit logging: it still clears the cookie if audit
  insert fails, and logs that failure server-side.

Remaining split:

- Claude owns the internal org-detail preview button and orange preview banner
  UI.
- Codex owns any future full impersonation or `getOrgContext()` wiring if owner
  explicitly approves the risk model.

Notes:

- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Added the platform tenant preview backend contract.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-tenant-preview.ts`
- `app/api/internal/saas/orgs/[id]/preview/route.ts`
- `app/api/internal/saas/tenant-preview/route.ts`
- `tests/unit/saas-platform-tenant-preview.test.ts`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/WORK_SPLIT_PLAN.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Contract:

- `POST /api/internal/saas/orgs/[id]/preview` starts a signed one-hour tenant
  preview cookie after platform admin `view_organizations` access and org
  lookup pass.
- `GET /api/internal/saas/tenant-preview` returns ready/hidden preview state.
- `DELETE /api/internal/saas/tenant-preview` clears the preview cookie.
- `loadPlatformTenantPreviewMode()` gives Claude a server-side banner contract.

Remaining split:

- Claude owns the internal org-detail button and preview-mode banner UI.
- Codex owns any future full impersonation or `getOrgContext()` wiring if
  owner explicitly approves the risk model.

Notes:

- This is not full impersonation. The preview cookie is not consumed by
  tenant data loaders or write actions.
- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

## 2026-05-26 Codex -> Claude / Codex

Added the platform admin role management backend foundation.

Commit:

```text
this commit
```

Files:

- `lib/saas/platform-admin-role-management.ts`
- `app/api/internal/saas/platform-admins/route.ts`
- `tests/unit/saas-platform-admin-role-management.test.ts`
- `supabase/migrations/036_saas_platform_admin_roles.sql`
- `scripts/saas/readiness-check.mjs`
- `agent-shared/UI_BACKEND_CONTRACTS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/HANDOFF_LOG.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/WORK_SPLIT_PLAN.md`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Contract:

- `GET /api/internal/saas/platform-admins` lists role assignments.
- `POST /api/internal/saas/platform-admins` upserts or disables assignments by
  email or user id.
- Both handlers require platform admin access plus
  `manage_platform_roles`.
- `036_saas_platform_admin_roles.sql` drafts the service-role-only table and
  `manage_platform_admin_role()` RPC with audit-log entries.

Remaining split:

- Claude may build `/internal/team` or a role-management panel against this
  contract after Codex confirms migration rollout timing.
- Codex must apply migration `036` and wire the guard to DB-backed role
  resolution only after explicit owner approval.

Notes:

- Existing `users.role='admin'` plus optional `PLATFORM_ADMIN_ROLES` remains
  the live role source.
- No UI page, deployment, migration, env/secret edit, billing/provider
  enablement, master/live/prod change, or production/internal Supabase action
  was performed.

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

## 2026-07-07 Claude -> Codex

Marketing funnel conversion fixes (UI scope only).

Commit:

```text
3f18385 feat(saas): replace mailto funnel with lead capture form and align marketing copy
```

Notes for Codex:

- `/signup` and `/contact` now use `components/marketing/lead-capture-form.tsx`
  (client-side only: LINE deep link + clipboard + mailto fallback).
- The form intentionally does NOT call `POST /api/saas/signup` yet:
  the route returns 403 while `public_signup` flag is closed, and
  migration 026 (`signup_requests`) is still a draft, not applied.
  When Stage 3 opens public signup, swap the form submit to that API.
- New env: `NEXT_PUBLIC_LINE_OA_ID` (optional; LINE button hidden when unset).

## 2026-07-14 Codex -> Owner / Codex

Return image privacy hardening prepared in code.

Notes:

- Upload flows now store `storage://return-images/...` references instead of newly
  generated public Storage URLs.
- Portal and merchant return-detail reads sign `return-images` objects on demand
  before returning data to UI surfaces.
- `scripts/check-storage.ts` now creates/checks a private `return-images` bucket
  posture and smoke-tests `createSignedUrl()`.
- This commit does not change Supabase bucket visibility. Deploy this code first,
  then separately switch the SaaS Supabase `return-images` bucket to private.

## 2026-07-14 Codex -> Owner / Claude / Codex

Public lead capture and Manual Beta operator workflow are implemented and pushed.

Commits:

```text
7838530 feat(saas): define public lead capture contract
e9ff6c3 feat(saas): add gated public lead API
6e4e5a6 feat(saas/ui): connect plan-aware lead capture form
24ac804 feat(saas): add platform lead operations queue
e7695e8 feat(saas/ui): add manual payment control
```

Current behavior:

- Pricing carries `basic`, `growth`, or `enterprise` into the lead form.
- The lead-only API is independently same-origin/rate-limit/flag gated and never provisions an account, organization, subscription, payment, or email.
- Manual LINE, copy, and Email contact paths remain available while the lead flag is closed.
- `/internal/leads` supports audited new/contacted/approved/rejected/converted progress after activation.
- Tenant detail supports recording an already-confirmed manual payment through the existing platform billing operation RPC.

Activation boundary:

- Migration `039_saas_public_lead_capture.sql` is draft and was not applied.
- `ENABLE_PUBLIC_LEAD_CAPTURE` remains false/unset.
- No deployment, env edit, provider enablement, automatic billing, email delivery, or public signup change was made.

## 2026-07-14 Codex -> Owner / Claude / Codex

Owner-authorized public lead capture migration apply completed.

- Applied only `supabase/migrations/039_saas_public_lead_capture.sql` to SaaS
  Supabase project `auyznbwtjvemyamujmgt` through the linked query path.
- Repaired only migration history version `039` to `applied`.
- Verified the five lead columns and six lead constraints on
  `public.signup_requests`.
- `npm run saas:migration-plan:strict` and
  `npm run saas:schema-gate:strict` pass.
- Migrations `034` and `036` remain unapplied.
- No Vercel env or deployment action was included in this migration step.
- Billing, email delivery, provider integrations, and public signup remain
  disabled.

## 2026-07-14 Codex -> Owner / Claude / Codex

Owner-authorized Production lead flag configuration completed.

- Set only `ENABLE_PUBLIC_LEAD_CAPTURE=true` for Vercel Production project
  `smart-return-system-saas`.
- Verified the env name is present for Production and rewrote the value through
  no-newline stdin to avoid hidden whitespace.
- This flag is independent from `ENABLE_PUBLIC_SIGNUP` and never provisions an
  account, organization, subscription, payment, or email job.
- No deployment was included in this env step, so runtime activation still
  requires a new owner-authorized production deployment.
- No billing, email provider, public signup, domain, or additional Supabase
  migration setting was changed.

## 2026-07-14 Codex -> Owner / Claude / Codex

Public lead capture production rollout completed.

- `npm run saas:predeploy` passed checkout/env/rollout/schema gates, lint,
  typecheck, 16 backend tests, 444 unit tests, 4 E2E tests, 5 integration
  tests, and the production build.
- Deployed runtime HEAD `ba70e90` to Vercel Production project
  `smart-return-system-saas`.
- Deployment `dpl_J7UaqC7ag1QQ1dTEcTp8CrxRaeR2` is Ready and the customer URL
  remains `https://smart-return-system-saas.vercel.app`.
- `npm run saas:production-smoke` passed 16/16.
- `/signup?plan=growth` exposes the plan-aware copy and Email actions.
- A same-origin empty request to `POST /api/saas/leads` returned
  `400 invalid_request`, proving the lead flag is active without persisting a
  test lead; `signup_requests` remained empty.
- `/internal/leads` redirects unauthenticated visitors to platform login.
- Deployment error-log scan found no errors.
- Public signup, billing, email delivery, ECPay/other providers, domain/DNS,
  and migrations `034`/`036` were not enabled or changed.

## 2026-07-14 Codex -> Owner / Claude / Codex

Google merchant login and self-service trial foundations are implemented,
verified, and pushed without activating external services.

Commits:

```text
d05f89f feat(saas): add Google login for existing merchants
1eb9a7f feat(saas): add Google self-service trial foundation
5ac9a8d feat(saas): automate scoped trial expiry suspension
ceb42ae fix(saas): align readiness gates with Google trial phases
4782088 fix(saas): gate Google trial rollout dependencies
88cc392 docs(saas): add Google trial activation runbook
cb4b203 test(saas): cover Google trial identity matrix
```

Current behavior:

- Google OAuth is disabled by default and existing email/password login remains
  unchanged.
- Existing active merchant members can return to their tenant workspace after
  Google OAuth; platform administrators remain routed to `/internal`.
- Accounts without a workspace receive the minimal `/signup/complete` landing
  flow instead of tenant data.
- The self-service trial API and migrations `040`/`041` are present but remain
  inactive until the owner completes provider setup, authorizes migrations,
  and explicitly enables all dependent flags.
- The scoped expiry worker only transitions expired `trialing` subscriptions
  to `suspended`; it does not cancel subscriptions or delete data.
- Rollout readiness fails closed if self-service trials are enabled without
  Google authentication or the expiry cron.

Final verification:

- `npm run test:all` passed: 16 backend tests, 489 unit tests, 4 E2E tests,
  and 5 integration tests.
- `npm run build`, `npm run saas:doctor`,
  `npm run safety:agent-boundary`, and `git diff --check` passed.
- `saas:doctor` reported 190 pass / 1 existing local flag warning / 0 fail.

Activation boundary:

- No migration was applied, no OAuth provider was configured, no env or secret
  was changed, and no deployment was performed.
- Owner setup and explicit authorization remain required for Google Cloud,
  Supabase Google provider configuration, migrations `040`/`041`, production
  flags, deployment, and disposable-account production verification.

## 2026-07-14 Codex -> Owner / Claude / Codex

Completed the remaining repository-side Google OAuth and self-service trial
hardening. All changes were committed and pushed separately without activating
external services.

Commits:

```text
9bfec28 fix(saas): pin Google OAuth redirects to app origin
8594905 fix(saas): throttle Google trial provisioning
65e452d chore(saas): enforce Google trial readiness hardening
```

Security behavior:

- Google OAuth start/callback redirects now resolve from the configured
  `NEXT_PUBLIC_APP_URL` when it is valid, rather than trusting an incoming host
  header.
- Self-service trial provisioning applies a best-effort per-user limit of 20
  requests per hour after authentication and before invoking the service-role
  RPC.
- `saas:doctor` now fails if either the trusted-origin OAuth wiring or trial
  provisioning throttle is removed.

Final verification:

- `npm run test:all` passed: 16 backend tests, 492 unit tests, 4 E2E tests,
  and 5 integration tests.
- `npm run build`, `npm run lint`, `npm run typecheck`,
  `npm run test:scripts`, and `npm run safety:agent-boundary` passed.
- `npm run saas:doctor` reported 191 pass / 1 existing local flag warning /
  0 fail.

Remaining boundary:

- No migration was applied, no OAuth provider was configured, no env or secret
  was changed, and no deployment was performed.
- At that historical handoff, Production activation still required Google Cloud OAuth setup,
  SaaS Supabase Google provider configuration, explicit migrations `040` and
  `041` authorization, Production flags/deploy authorization, and disposable
  QA accounts for the identity and lifecycle matrix. Those Google rollout items
  are now complete per the resolution recorded at the end of this log.

## 2026-07-15 Codex -> Owner / Claude / Codex

Google Production activation was attempted under the owner's exact scope and
then returned fail-closed after smoke exposed two blockers.

Completed external actions:

- Created a dedicated Google Web OAuth client without writing credentials to
  chat, repo, or docs.
- Enabled Google Auth only on SaaS Supabase project
  `auyznbwtjvemyamujmgt`; configured the stable Production Site URL and allowed
  Production/local callback URLs.
- Applied only migrations `040` and `041` in order and verified service-role RPC
  access plus remote migration history.
- Ran full `npm run saas:predeploy`, deployed exact HEAD `d6250b3`, and passed
  public/protected-route plus 3-day trial marker smoke.

Blockers found by real smoke:

- Production `NEXT_PUBLIC_APP_URL` uses
  `https://smart-return-system-saas-kaweis-projects.vercel.app`, which differs
  from the Supabase-allowed public callback on
  `https://smart-return-system-saas.vercel.app`. Google authorization therefore
  returns to the public site root with `?code=` instead of `/auth/callback`, so
  no app session is exchanged.
- Migration `041` does not require a self-service claim before suspending an
  expired trial. Enabling the cron could therefore suspend manually provisioned
  Beta organizations.

Fail-closed response:

- Reset `ENABLE_GOOGLE_AUTH`, `ENABLE_GOOGLE_TRIAL_SIGNUP`, and
  `ENABLE_TRIAL_EXPIRY_CRON` to `false`.
- Redeployed exact `d6250b3`; current Ready deployment is
  `dpl_FfcR7djeH4ji1c4tmtf8ctZCHyHz`.
- Verified Google login is hidden and the cron returns
  `trial_expiry_cron_disabled`.
- Added unapplied draft migration
  `042_saas_scope_trial_expiry_to_self_service.sql` plus readiness/migration
  tests. It requires a matching `saas_self_service_trial_claims` row and returns
  `not_self_service_trial` without mutation for manual Beta organizations.

Owner follow-up authorization required before resuming:

1. Set stable Production `NEXT_PUBLIC_APP_URL`.
2. Apply only migration `042` to the same SaaS project.
3. Push/deploy the resulting new HEAD and rerun the disposable Google identity,
   3-day trial, concurrent `0/1` AI, and expiry-to-read-only matrix.

No billing/email provider, domain/DNS, master/live/internal Supabase, automatic
cancel, or data deletion action was performed.

## 2026-07-15 Google Production Rollout Resolution

The current owner handoff supersedes the fail-closed snapshot above:

- Google Production rollout is complete at
  `https://smart-return-system-saas.vercel.app`.
- Migrations `040`, `041`, `042`, and `043` are already applied only to SaaS
  project `auyznbwtjvemyamujmgt`; do not apply them again.
- Production `ENABLE_GOOGLE_AUTH`, `ENABLE_GOOGLE_TRIAL_SIGNUP`, and
  `ENABLE_TRIAL_EXPIRY_CRON` are enabled.
- Existing-merchant Google login, eligible-user automatic 3-day trials,
  single-use trial AI, scoped expiry, and post-expiry read-only behavior are
  complete.
- Billing remains `ENABLE_BILLING=false`; no Email provider is enabled.
- This handoff only updates local tests and documentation. It does not push,
  deploy, apply migrations, or change env/external settings.
