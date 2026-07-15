# SaaS External Setup Status

## 2026-07-15 Verified Email/Phone Signup Repository Work

- Repository code now contains a guarded Email/Phone verification signup flow,
  independent disabled-by-default flags, CAPTCHA/provider readiness gates,
  phone password login support, regression tests, and draft migration
  `044_saas_verified_identity_self_service_trial.sql`.
- Repository implementation commits `a71e3a9` and `de3f052` are pushed to
  `origin/develop-saas`; this is not a Production deployment.
- Migration `044` has **not** been applied anywhere. Migrations `040`–`043`
  remain the latest applied self-service chain on SaaS project
  `auyznbwtjvemyamujmgt` and must not be rerun.
- No Custom SMTP, SMS provider, Turnstile secret/site configuration,
  Production env, deployment, DNS, billing, or external setting was changed.
- Both `ENABLE_EMAIL_OTP_SIGNUP` and `ENABLE_PHONE_OTP_SIGNUP` remain off until
  the owner completes the provider prerequisites and separately authorizes the
  migration/deploy/env rollout described in
  [`SAAS_VERIFIED_SIGNUP_ROLLOUT.md`](./SAAS_VERIFIED_SIGNUP_ROLLOUT.md).

## 2026-07-15 Google Production Rollout Completed

- The owner handoff confirms the Google Production rollout is complete at
  `https://smart-return-system-saas.vercel.app`.
- Migrations `040`, `041`, `042`, and `043` are already applied only to SaaS
  project `auyznbwtjvemyamujmgt`. Do not apply them again.
- Production has `ENABLE_GOOGLE_AUTH=true`,
  `ENABLE_GOOGLE_TRIAL_SIGNUP=true`, and
  `ENABLE_TRIAL_EXPIRY_CRON=true`.
- The completed flow includes existing-merchant Google login, automatic 3-day
  trial provisioning for eligible Google users, a single successful real AI
  analysis during the trial, scoped trial-expiry automation, and read-only
  access after expiry.
- Billing remains intentionally disabled with `ENABLE_BILLING=false`, and no
  Email provider is enabled. Those items remain separate from the completed
  Google rollout.
- This current status supersedes the fail-closed activation-attempt record
  below. Production runtime `a29f725` is verified Ready on deployment
  `dpl_7ZznosE1KVLdB4oj1sFFCwDAwJtC`; smoke passed 16/16 and the deployment
  error scan returned zero errors. This documentation update did not change
  any Production setting.

## Historical: 2026-07-15 Google Trial Production Activation Attempt

- Owner-authorized external setup completed only for SaaS project
  `auyznbwtjvemyamujmgt` and Vercel project `smart-return-system-saas`:
  - A dedicated Google Web OAuth client was created and the Supabase Google
    provider was enabled.
  - Supabase Site URL and redirect allow-list include the stable Production URL
    plus the local `http://localhost:3001/auth/callback` path.
  - Migrations `040_saas_google_self_service_trial.sql` and
    `041_saas_scoped_trial_expiry.sql` were applied in order and recorded as
    applied in remote migration history.
  - Exact runtime HEAD `d6250b3` passed `npm run saas:predeploy`, deployed Ready,
    and passed public/protected-route smoke including 3-day trial markers.
- Authenticated Google smoke exposed a Production app-origin mismatch:
  `NEXT_PUBLIC_APP_URL` is the Vercel project alias
  `https://smart-return-system-saas-kaweis-projects.vercel.app`, while Supabase
  allows the public callback on `https://smart-return-system-saas.vercel.app`.
  OAuth therefore returned to the public site root with `?code=` instead of
  `/auth/callback`, so the app could not exchange the code for a session.
  Changing this env was outside the authorized env list and was not performed.
- Expiry smoke also found that migration `041` accepts every expired `trialing`
  subscription. Without an explicit self-service claim check, the cron could
  suspend manually provisioned Beta organizations. Draft migration
  `042_saas_scope_trial_expiry_to_self_service.sql` now adds that fail-closed
  claim check, but it has not been applied.
- At that historical attempt, Production was returned to a safe disabled state:
  `ENABLE_GOOGLE_AUTH=false`, `ENABLE_GOOGLE_TRIAL_SIGNUP=false`, and
  `ENABLE_TRIAL_EXPIRY_CRON=false`. The Ready deployment at that time was
  `dpl_FfcR7djeH4ji1c4tmtf8ctZCHyHz`, still running exact HEAD `d6250b3`.
- Billing, email delivery, domain/DNS, and master/live/internal Supabase were not
  changed. Full self-service smoke remains blocked until the owner separately
  authorizes the stable `NEXT_PUBLIC_APP_URL`, migration `042`, and deployment
  of the resulting new HEAD.

## 2026-07-15 Google Login And Self-Service Trial Foundation

- Repository implementation is complete and pushed on `develop-saas`:
  - `d05f89f` existing-merchant Google OAuth and safe routing.
  - `1eb9a7f` self-service trial API/UI foundation and draft migration `040`.
  - `5ac9a8d` scoped trial-expiry worker/cron, suspended-state UI, and draft
    migration `041`.
  - `ceb42ae` migration/readiness checks aligned through `041`.
  - `4782088` rollout dependencies fail closed when self-service trial is
    enabled without Google Auth or the scoped expiry cron.
  - `c47c752` adds token-owned atomic reservation RPCs to draft migration `040`.
  - `c022f2a` enforces one successful real AI analysis for Google self-service
    trials while releasing failed/fallback runs.
  - `25a0cda` adds `0/1` trial quota UI, a non-billable static demo, confirmation,
    and the used-quota upgrade path.
  - `be1569d` exposes Google self-service source, trial expiry, and token-free AI
    quota status in the commercial operations backend and UI.
- At this historical repository-only milestone, all Google rollout flags remained disabled by default. No Google Cloud OAuth
  client, Supabase Google provider, migration `040`/`041`, Production env,
  or deployment change was made by these repository commits.
- The current self-service contract is a 3-day trial with terms version
  `2026-07-15-v2`; draft migration `040` and all customer-facing trial copy are
  aligned to that duration. This remains repository-only until migration `040`,
  Google provider settings, rollout flags, and deployment are separately
  authorized and verified.
- Activation must follow
  [`SAAS_GOOGLE_AUTH_TRIAL_ROLLOUT.md`](./SAAS_GOOGLE_AUTH_TRIAL_ROLLOUT.md),
  including same-email identity-linking QA and disposable-org lifecycle QA.
- At that milestone, migrations `040` and `041` were draft-only and required
  separate owner authorization for SaaS project `auyznbwtjvemyamujmgt`; the
  current status section above records that `040`–`043` are now applied.
- No migration, Google/Supabase provider, Production env, deployment, billing,
  email provider, or master/live/internal Supabase change was made by the
  single-use trial AI commits.

Last updated: 2026-07-15

This file tracks external SaaS setup work that must stay separate from the live internal project.

See also: [`SAAS_EXTERNAL_OWNER_ACTIONS.md`](./SAAS_EXTERNAL_OWNER_ACTIONS.md)
for owner-provided values, handoff templates, and the recommended order for
Sentry, domain, email provider, Billing/ECPay, and migrations `034` and `036`.
See also:
[`SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md`](./SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md)
for the controlled customer handoff and first-session walkthrough.

## Current Status Snapshot

- Dedicated SaaS Supabase project is `auyznbwtjvemyamujmgt` (`auyznbwtjvemyamujmgt.supabase.co`).
- The internal/live Supabase project refs `fdzfnenizyppxglypden` and `sntbrntwztkllwkutooi` are not used.
- Current Production runtime is `a29f725` on Ready Vercel deployment
  `dpl_7ZznosE1KVLdB4oj1sFFCwDAwJtC`, aliased to
  `https://smart-return-system-saas.vercel.app`. The 2026-07-15 smoke passed
  16/16, OAuth recovery browser QA passed, and the error-log scan found zero
  errors. Repository hardening through `6905ce3` and migration-status correction
  `d397ea2` are pushed but not deployed.
- Full SaaS migration chain through `032_saas_invite_creation_rpc.sql` has been applied to the SaaS project.
- Migration `033_saas_platform_billing_operations.sql` has been applied to SaaS project `auyznbwtjvemyamujmgt` after explicit owner authorization; remote migration history records `033` as applied. It adds `perform_platform_billing_operation()` for manual payment marking, suspend/resume, refund request, and audit logging.
- Draft migration `034_saas_notification_email_queue.sql` exists for notification/email queue storage but has not been applied.
- Migration `035_saas_onboarding_completion_rpc.sql` has been applied to SaaS project `auyznbwtjvemyamujmgt` after explicit owner authorization; remote migration history records `035` as applied.
- Draft migration `036_saas_platform_admin_roles.sql` exists for DB-backed platform admin role assignments but has not been applied.
- Migration `037_saas_team_invite_status.sql` has been applied to SaaS project `auyznbwtjvemyamujmgt` after explicit owner authorization; remote migration history records `037` as applied. It adds `organization_invites.status` and refreshes invite accept/create RPCs for team invite revoke/resend flows.
- Migration `038_saas_org_member_visibility.sql` has been applied to SaaS project `auyznbwtjvemyamujmgt` after explicit owner authorization; remote migration history records `038` as applied. It lets active same-org members read `organization_members` rows through helper-backed non-recursive RLS so owner/admin team-member QA is no longer schema-blocked.
- Migration `039_saas_public_lead_capture.sql` has been applied to SaaS project `auyznbwtjvemyamujmgt` after explicit owner authorization; remote migration history records `039` as applied. It extends `signup_requests` for Basic/Growth/Enterprise leads, LINE/email/phone contact, monthly return bands, and operator follow-up timestamps.
- Migrations `040_saas_google_self_service_trial.sql`, `041_saas_scoped_trial_expiry.sql`, `042_saas_scope_trial_expiry_to_self_service.sql`, and `043_saas_google_trial_claims_service_role_read.sql` have been applied to SaaS project `auyznbwtjvemyamujmgt` after explicit owner authorization. Do not apply them again. Google provider setup and the Production rollout are complete, with all three Google rollout flags enabled.
- Vercel Production project `smart-return-system-saas` has owner-authorized `ENABLE_PUBLIC_LEAD_CAPTURE=true`, active in current Ready deployment `dpl_7ZznosE1KVLdB4oj1sFFCwDAwJtC`.
- Return image runtime code now stores private storage references instead of newly generated public URLs and signs `return-images` objects on read for portal and merchant return-detail surfaces. Owner authorized deploying this runtime and switching the SaaS Supabase `return-images` bucket to private on 2026-07-14; bucket verification now reports `public=false`.
- External owner action runbook is documented in `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md`; it separates owner-provided values from Codex execution steps.
- Billing event retry is currently dry-run only; provider replay remains disabled pending ECPay sandbox validation and audit-log retry wiring.
- Notification backend foundation is queue-oriented; email queue creation and
  dry-run inspection exist, and a disabled-by-default Resend adapter skeleton is
  now present for a future owner-authorized provider rollout.
- Email queue worker is dry-run only through
  `GET /api/cron/saas/email-queue?dryRun=true`; production delivery is still
  disabled and no cron route sends email or mutates provider state.
- Resend delivery remains blocked until the owner provides a Resend account,
  verified sender domain, `RESEND_API_KEY`, `EMAIL_FROM`, delivery scope, and
  explicitly authorizes `ENABLE_EMAIL_DELIVERY=true` plus
  `EMAIL_PROVIDER=resend`.
- Onboarding backend foundation now includes read-only `loadSaaSOnboardingView()` plus guarded `POST /api/saas/onboarding/complete`; migration `035` is applied and the `complete_organization_onboarding()` RPC is available to the service role.
- Platform admin role policy now supports `owner`, `support`, and `billing`; optional `PLATFORM_ADMIN_ROLES` mapping is not configured by default.
- Platform admin identity separation now requires the signed internal admin session, explicit `ADMIN_EMAIL` / email-style `ADMIN_USERNAME`, or valid `PLATFORM_ADMIN_ROLES`. Tenant/profile `users.role='admin'` is no longer a platform admin grant. Proxy-level `/login` redirects now use the same explicit platform admin identity policy for already-authenticated users, and authenticated merchants who visit `/admin` are sent back to `/analytics`.
- Platform admin role management backend foundation now includes owner-gated `GET/POST /api/internal/saas/platform-admins` plus a repository/RPC contract for future UI. DB-backed role assignments still require migration `036` to be explicitly applied before UI exposure.
- Platform tenant preview backend foundation now includes guarded start/get/clear preview routes, a signed one-hour cookie for future UI banners, and audit-log writes for preview start/clear events. It is not wired into tenant org context or write permissions.
- Platform tenant preview UI is now wired for platform admins through the org-detail start button, tenant preview banner, and exit button. This remains read-only visual context only; it is not full impersonation and does not change tenant data scope or write permissions.
- Latest Claude/Codex UI handoffs through 2026-06-12 are recorded in `agent-shared/**`: platform risk label localization, settings header consistency, billing trial/cancel banners, onboarding next-step focus card, marketing mobile navigation, login page SaaS branding, `/internal` loading skeleton, `/not-found` SaaS branding, customer/platform role separation UI, public marketing/legal mobile touch-target QA, platform operations simplification, merchant settings secondary-entry gating, and `/internal` alert-copy refinement.
- `npm run saas:migration-plan:strict` passes and the local migration chain now ends
  at `043_saas_google_trial_claims_service_role_read.sql`.
- `npm run saas:schema-gate:strict` passes after owner-authorized migrations `033`, `037`, `038`, and `039` apply.
- `npm run saas:doctor:strict` passes with default rollout flags; if local platform admin preview is enabled, the check reports a warning that `ENABLE_MULTI_TENANT_ADMIN` is not at its closed default.
- `npm run saas:rollout-check:strict` passes for the local Manual Beta environment and also checks admin login credential readiness.
- Launch security hardening now includes Next.js security headers for CSP, HSTS, clickjacking, MIME sniffing, referrer policy, and browser permissions policy.
- Platform admin password login now has best-effort, per-runtime throttling by login id and client IP. This reduces repeated password guessing against the `/admin/login` / `/login` internal admin path, but it is not a replacement for a persistent edge/WAF rate limit.
- Browser-driven mutation APIs now share a same-origin guard that rejects explicit cross-site `Origin`, `Referer`, or Fetch Metadata requests before route handlers run. ECPay webhook, cron, and schema alert routes are intentionally excluded because they are provider/secret-gated server-to-server endpoints.
- Public signup API now has best-effort, per-runtime request throttling. Public signup is still closed by `ENABLE_PUBLIC_SIGNUP=false`, but the route is safer for a future controlled rollout.
- Non-UI lint cleanup removed unused local variables from Codex-owned `lib/**` and `scripts/**` paths. The 2026-06-05 UI QA pass observed `npm run lint` with no warnings.
- Dependency hardening through `6905ce3` leaves the full audit at 1 low / 5 moderate / 0 high / 0 critical and production dependencies at 1 low / 4 moderate / 0 high / 0 critical. Remaining findings are in Babel/Next/PostCSS and ExcelJS/UUID paths; npm only offers breaking `--force` changes for the unresolved production paths, so they remain tracked instead of being force-applied.
- `GEMINI_API_KEY` is set for the SaaS environment.
- Local Manual Beta owner/invitee login, protected pages, exports, AI analyze, invite acceptance, settings, and platform admin read pages have been smoke tested.
- Local `.env.saas.local` admin credentials are non-placeholder for Manual Beta checks; SaaS Vercel/production admin credentials still need owner review before public rollout.
- `npm run saas:predeploy` passed locally after the latest UI handoffs through `a63cfe2`, the subsequent explicit platform admin identity hardening, `/admin` merchant-entry redirect hardening, launch security headers, dependency audit hardening, post-push Vercel preview status record, platform admin login throttling, mutation same-origin guard, and public signup rate limiting.
- The remaining expected rollout warning is:
  - Billing is disabled, which is acceptable for manual Beta but not paid self-serve launch.
- The current Production Google rollout is enabled at `https://smart-return-system-saas.vercel.app` on runtime `a29f725`, deployment `dpl_7ZznosE1KVLdB4oj1sFFCwDAwJtC` (Ready).
- Billing/ECPay credentials plus `ENABLE_BILLING` and email provider delivery remain pending because the required external values/credentials are not available in this checkout.
- Current owner-confirmed Production URL is `https://smart-return-system-saas.vercel.app`. Google Auth, trial signup, and trial expiry are enabled; Billing and Email delivery remain disabled. Historical deployment IDs below are retained only as earlier rollout records.
- Production includes the lead capture contract/API/form/operations queue and manual payment UI, plus all previously deployed 499/699, isolation, operator, signed return-image, expired-workspace, OAuth recovery, billing-copy, and regression changes through runtime `a29f725`.
- The latest 2026-07-15 production smoke passed 16/16. OAuth recovery browser QA passed and the deployment error-log scan returned zero errors. The earlier non-persisting lead smoke confirmed `/signup?plan=growth` form markers, `POST /api/saas/leads` reached enabled validation with `400 invalid_request`, `/internal/leads` redirects unauthenticated users to platform login, and `signup_requests` remained empty.
- Latest external checks confirmed Vercel production env names include `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `ENABLE_MULTI_TENANT_ADMIN`, and `ADMIN_SESSION_SECRET`; `PLATFORM_ADMIN_ROLES` was not listed. A 2026-07-02 flag-lock check confirmed `ENABLE_BILLING=false`, `ENABLE_PUBLIC_SIGNUP=false`, and no Resend/email provider env is configured. No custom/beta domain is visible, migrations `033`, `035`, `037`, `038`, and `039` are applied, and migrations `034` and `036` remain unapplied.
- Owner has chosen to defer custom domain purchase/setup and use the Vercel production URL for Closed Manual Beta. Customer traffic should use `https://smart-return-system-saas.vercel.app` until the owner later buys/registers a domain and reauthorizes DNS/Vercel verification. Historical `app.smart-return.tw` notes remain below for future reference only.
- Owner chose to skip email provider setup for now.
- Owner confirmed broad multi-customer rollout, so public multi-tenant hardening is active. P1 Shopee, pickup, customer portal, and upload/signed-url isolation is complete. P2 backup action and backup cron gating is complete locally; `/api/cron/backup` now skips unless `SAAS_BACKUP_ORG_ID` is configured. Non-backup platform maintenance cron routes now skip unless `ENABLE_PLATFORM_MAINTENANCE_CRON=true` is configured. Neither env var was set in Vercel by this local code/doc change.
- No unblocked local Codex backend implementation task is currently recorded. Remaining work requires owner/external values or explicit per-action authorization: production `PLATFORM_ADMIN_ROLES`, public signup posture, email provider credentials, Stage 2 Billing/ECPay, and draft migrations `034`/`036`. Custom domain work is intentionally deferred while the owner uses the Vercel production URL.

## 2026-07-14 Owner-Authorized Signed Return Image Production Rollout

- Owner authorized completing the signed return-image rollout in order:
  deploy the signed URL runtime, then switch the Supabase `return-images`
  bucket to private, then smoke test and update docs.
- Preflight and `npm run safety:agent-boundary` passed on `develop-saas`.
- `npm run saas:predeploy` passed:
  - checkout/env/rollout/schema gates passed.
  - lint and typecheck passed.
  - scripts/backend, unit, e2e, and integration tests passed.
  - production build passed.
  - Rollout warnings were the expected local admin-password, local Sentry, and
    billing-disabled warnings.
- Vercel Production deployment:
  - Runtime source: `f009621 fix(saas): sign return image storage URLs`
  - Deployment ID: `dpl_qJfFc3z5UFc7Qqb6u5DmNCSoae8v`
  - Status: Ready
  - URL: `https://smart-return-system-saas.vercel.app`
  - Vercel inspect also lists the historical `app.smart-return.tw` alias; do
    not treat that as the active customer URL until domain ownership/DNS is
    explicitly resumed.
- SaaS Supabase storage change:
  - Project: `auyznbwtjvemyamujmgt`
  - Bucket: `return-images`
  - Before: `public=true`
  - After: `public=false`
  - Verification confirmed `return-images public=false`.
  - No existing stored object was found during the signed/public URL smoke, so
    there was no live object URL to fetch.
- `npm run saas:production-smoke` passed with 16 pass, 0 warn, 0 fail.
- No migration, env/secret edit, domain/DNS setting change, email provider
  enablement, billing/provider enablement, public signup enablement, or
  master/live/internal Supabase action was performed.

## 2026-07-09 Owner-Authorized Migration 033 Apply and Tenant Suspend/Resume UI

- Owner explicitly authorized applying only
  `033_saas_platform_billing_operations.sql` to SaaS Supabase project
  `auyznbwtjvemyamujmgt`.
- Preflight, `npm run safety:agent-boundary`, and
  `npm run saas:migration-plan:strict` passed before the apply.
- Remote migration list before apply showed:
  - `035`, `037`, and `038` applied.
  - `033`, `034`, and `036` pending.
- Codex executed only
  `supabase/migrations/033_saas_platform_billing_operations.sql` via
  `supabase db query --linked --file`.
- Codex repaired remote migration history for version `033` to applied.
- Remote migration list after apply shows:
  - `033`, `035`, `037`, and `038` applied.
  - `034` and `036` still unapplied.
- Verification:
  - `public.perform_platform_billing_operation(...)` exists.
  - `service_role` has execute privilege on the RPC.
  - `npm run saas:migration-plan:strict` passes.
  - `npm run saas:schema-gate:strict` passes.
  - `npm run saas:doctor` passes with 167 pass / 1 expected local warning /
    0 fail.
  - `npm run lint` and `npm run typecheck` pass after the UI wiring.
  - Relevant unit tests pass for proxy login redirect, platform billing
    operations, and UI/backend contracts.
- Readiness check:
  - `saas:doctor` auth-redirect coverage now validates the current server-side
    `/admin`, `/internal`, and `/internal/*` non-admin redirect contract.
- UI:
  - `/internal/orgs/[id]` now exposes platform-admin `暫停租戶` /
    `恢復租戶` controls through the existing guarded
    `/api/internal/saas/billing/operations` route.
  - Each operation requires a reason, displays a confirmation dialog, refreshes
    the tenant detail after success, and writes audit metadata through the RPC.
- Not performed:
  - No deployment.
  - No migration `034` or `036` apply.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No Billing/ECPay provider enablement.
  - No public signup enablement.
  - No master/live/internal Supabase action.

## 2026-07-02 Production Closed-Beta Flag Lock Verification

- Ran the required SaaS repo preflight in the SaaS commercial checkout; branch
  was `develop-saas`, the worktree was clean, and
  `npm run safety:agent-boundary` passed.
- Used `npx vercel env ls production` for the env-name inventory, then pulled
  Production env values into a Windows temporary file only long enough to parse
  non-secret rollout flags. The temporary file was deleted immediately after
  parsing, and no secret values were printed, committed, or written into repo.
- Confirmed Production rollout flags:
  - `ENABLE_BILLING=false`
  - `ENABLE_PUBLIC_SIGNUP=false`
  - `RESEND_API_KEY`: missing
  - `EMAIL_FROM`: missing
  - `EMAIL_PROVIDER`: missing
  - `ENABLE_EMAIL_PROVIDER`: missing
  - `EMAIL_DELIVERY_ENABLED`: missing
- Confirmed the email/provider posture remains disabled:
  - The Resend adapter skeleton remains disabled-by-default.
  - The email queue route still rejects `dryRun=false` with
    `delivery_not_enabled`.
  - No Resend provider env or enablement flag is configured in Production.
- Confirmed current route and platform-admin guard posture:
  - `/admin` redirects an unauthenticated request to
    `/admin/login?next=%2Finternal`.
  - `/internal` redirects an unauthenticated request to
    `/admin/login?next=%2Finternal`.
  - `/internal/orgs` redirects an unauthenticated request to
    `/admin/login?next=%2Finternal%2Forgs`.
  - A signed production `admin_session` generated from the pulled temporary
    `ADMIN_SESSION_SECRET` reached `/internal` with HTTP `200`.
  - The same signed admin session reached `/internal/orgs` with HTTP `200`.
  - The temporary env file and local response files used for this verification
    were deleted after the check.
- The latest authenticated merchant denial evidence remains the 2026-07-02 QA
  run recorded below: a logged-in merchant account that opened `/internal` was
  denied by the platform-admin gated state. No merchant password was used or
  reset during this flag-lock verification pass.
- Not performed:
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No public signup enablement.
  - No master/live/internal Supabase action.

## 2026-07-02 Resend, Billing, And Public Signup Readiness

- Ran the required SaaS repo preflight in the SaaS commercial checkout; branch
  was `develop-saas`,
  worktree was clean, and `npm run safety:agent-boundary` passed.
- Vercel Production env-name inspection for project
  `smart-return-system-saas` confirmed the following without printing values:
  - `RESEND_API_KEY`: missing
  - `EMAIL_FROM`: missing
  - `EMAIL_PROVIDER`: missing
  - `ECPAY_MERCHANT_ID`: missing
  - `ECPAY_HASH_KEY`: missing
  - `ECPAY_HASH_IV`: missing
  - `ENABLE_BILLING`: set
- A later 2026-07-02 flag-lock verification confirmed
  `ENABLE_BILLING=false` and `ENABLE_PUBLIC_SIGNUP=false`; this earlier
  readiness pass only listed encrypted env names and did not inspect values.
- Resend readiness:
  - Added `lib/saas/email-delivery-provider.ts` as a disabled-by-default Resend
    adapter skeleton.
  - The adapter reports `delivery_not_enabled` unless
    `ENABLE_EMAIL_DELIVERY=true`.
  - Even after the enablement flag, it requires `EMAIL_PROVIDER=resend`,
    `RESEND_API_KEY`, and `EMAIL_FROM`.
  - No Vercel env was changed, no API key was written, no email was sent, and
    the existing email queue cron route still rejects `dryRun=false` with
    `delivery_not_enabled`.
  - Unit coverage now proves disabled-by-default behavior, missing config
    handling, mocked Resend success, and mocked provider errors.
- Billing/ECPay readiness:
  - `ENABLE_BILLING=false` in Production, and no value was changed.
  - Production env names still do not list `ECPAY_MERCHANT_ID`,
    `ECPAY_HASH_KEY`, or `ECPAY_HASH_IV`.
  - Current billing code remains a gated webhook/event-recording foundation:
    `ENABLE_BILLING=false` returns `billing_disabled`; if billing is later
    enabled, the webhook still requires `BILLING_PROVIDER=ecpay`, complete ECPay
    credentials, and CheckMacValue verification before inserting
    `billing_events`.
  - Full recurring billing is still not implemented: no recurring
    authorization flow, no automatic paid/past_due/suspended transitions, no
    invoice issuing, no refund execution, and no provider retry/replay.
- Public signup readiness:
  - `/signup` remains public marketing/Beta interest UI.
  - `POST /api/saas/signup` remains gated by `ENABLE_PUBLIC_SIGNUP=false` and
    returns `feature_disabled` before validation or persistence while the flag
    is closed.
  - If the owner later enables public signup, the current backend only records
    a Basic-plan `signup_requests` lead/request. It does not create an auth
    user, organization, owner membership, subscription, trial, invoice, or
    billing authorization.
- Owner data still required before activation:
  - Resend: account, verified sender domain, `RESEND_API_KEY`, `EMAIL_FROM`,
    and first delivery scope (`invite`, `trial reminder`, `quota warning`,
    `billing notice`).
  - ECPay: MerchantID, HashKey, HashIV, sandbox/production mode, invoice method,
    company/tax identity, payment-failure grace days, refund SOP, sandbox test
    account, and production cutover criteria.
  - Public signup: abuse/WAF posture, CAPTCHA or equivalent abuse control,
    default plan/trial policy, automatic org/subscription creation plan,
    email-verification flow, and explicit `ENABLE_PUBLIC_SIGNUP=true`
    authorization.
- Not performed:
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No public signup enablement.
  - No master/live/internal Supabase action.

## 2026-07-02 Production Admin And Disposable QA Verification

- Ran the required SaaS repo preflight in
  `D:\AI專案\AI退貨系統商業版_2026.5.16`; branch was `develop-saas`, worktree
  was clean, and `npm run safety:agent-boundary` passed.
- Vercel Production env-name inspection for project
  `smart-return-system-saas` confirmed these names are set without printing
  values:
  - `ENABLE_MULTI_TENANT_ADMIN`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
- `PLATFORM_ADMIN_ROLES` is still missing from the Vercel Production env-name
  list. This remains an owner decision only if per-email platform operator roles
  are needed; Codex did not add or edit env values.
- Authenticated production platform-admin check passed:
  - `/admin` redirects to `/login?next=%2Finternal` for a clean unauthenticated
    session.
  - The configured platform admin login reaches `/internal`.
  - `/internal` renders the commercial operations console.
  - `/internal/orgs` renders the tenant list, including the disposable QA org.
- Disposable QA org verification used only
  `QA Team Management Test 20260624041704`
  (`791748d1-7d3f-4b61-a9e5-3138a98f7262`):
  - QA owner and QA member temporary passwords were reset without printing or
    storing them in Git/docs/chat.
  - QA owner login passed.
  - `/analytics`, `/shopee-returns`, `/analytics/ai-report`, and
    `/settings/team` loaded successfully.
  - QA owner can see the QA member in `/settings/team`.
  - QA owner role-change, member disable, invite create, invite resend, and
    invite revoke calls all returned success and were reflected in the team UI.
  - A logged-in merchant account that opens `/internal` is denied by the
    platform-admin gated state instead of seeing platform operations data.
- No code fix was required.
- Invoice/receipt and legal readiness remains not finalized. Before the first
  paid customer, the owner/legal/accounting side must confirm the fields listed
  in `docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`: legal company/business name,
  tax id, registered address, contact email, invoice/receipt method, data
  retention period, personal-data deletion contact, and subprocessor list.
- Not performed:
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Production Admin Read-Only Verification

- Ran read-only Vercel Production env-name inspection for project
  `smart-return-system-saas`; no secret values were read or printed.
- Present Production env names include:
  - `ENABLE_MULTI_TENANT_ADMIN`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
- `PLATFORM_ADMIN_ROLES` was not listed in Vercel Production env names.
  Production platform access can still rely on the configured admin username /
  password path, but per-email platform role mapping is not configured yet.
- Vercel deployment inspect confirms production alias
  `https://smart-return-system-saas.vercel.app` points to deployment
  `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76`, status `Ready`.
- Route checks:
  - `/admin` -> `307` to `/admin/login?next=%2Finternal`
  - `/internal` -> `307` to `/admin/login?next=%2Finternal`
  - `/admin/login?next=%2Finternal` -> `307` to `/login?next=%2Finternal`
- `npm run saas:production-smoke` passes with 16 pass, 0 warn, 0 fail.
- Not verified:
  - Authenticated `/internal` platform admin session, because this run did not
    use or request platform admin credentials.
- Not performed:
  - No deployment.
  - No env/secret edit.
  - No domain/DNS change.
  - No migration.
  - No email/billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Team Visibility Migration 038 Apply

- Owner explicitly authorized applying only `038_saas_org_member_visibility.sql`
  to SaaS Supabase project `auyznbwtjvemyamujmgt`.
- Preflight, `npm run safety:agent-boundary`, and
  `npm run saas:migration-plan:strict` passed before the apply.
- Remote migration list before apply showed:
  - `035` and `037` applied.
  - `033`, `034`, `036`, and `038` pending.
- Codex executed only
  `supabase/migrations/038_saas_org_member_visibility.sql` via
  `supabase db query --linked --file`.
- Codex repaired remote migration history for version `038` to applied.
- Remote migration list after apply shows:
  - `035`, `037`, and `038` applied.
  - `033`, `034`, and `036` still unapplied.
- Verification:
  - `public.is_organization_member(uuid, text[])` exists.
  - `organization_members` policy `members_select_org_memberships` exists for
    authenticated same-org SELECT.
  - `npm run saas:schema-gate:strict` passes.
  - `npm run saas:migration-plan:strict` passes.
  - `npm run saas:doctor` passes with 165 pass, 1 expected local
    `ENABLE_MULTI_TENANT_ADMIN=true` warning, and 0 fail.
  - `npm run lint` passes.
  - `npm run test:all` passes.
  - `npm run saas:production-smoke` passes with 16 pass, 0 warn, 0 fail.
- Not performed:
  - No deployment.
  - No migration `033`, `034`, or `036` apply.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Go-Live Risk And Service Plan

- Added `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md` as the current ordered
  launch, subscription, and service risk plan.
- Ran the local, non-external execution pass:
  - `npm run safety:agent-boundary`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run saas:migration-plan:strict`
  - `npm run saas:schema-gate:strict`
  - `npm run test:all`
  - `npm run saas:doctor`
  - `npm run build`
- Local gate result: pass. `saas:doctor` reports 165 pass, 1 expected local
  warning for `ENABLE_MULTI_TENANT_ADMIN=true`, and 0 fail.
- Current launch decision:
  - Closed free/manual Beta remains acceptable with controlled scope.
  - First paid manual customers are not ready until invoice/receipt capability,
    legal/refund finalization, and manual payment tracking are operational.
  - Public self-serve paid SaaS remains blocked by email delivery, ECPay
    recurring billing/invoice flow, public signup/provisioning posture,
    lifecycle automation, and provider-backed alerts.
- The next owner-authorized technical queue is:
  1. Set `PLATFORM_ADMIN_ROLES` if per-email platform operator roles are needed,
     then redeploy or revalidate the platform admin login path as appropriate.
  2. Run the merchant-to-platform QA plan in
     `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md` against a disposable QA org.
- Not performed:
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Manual Payment And Support SOP

- Added `docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`.
- The SOP covers:
  - Manual payment record fields.
  - Manual payment workflow.
  - Manual refund review workflow.
  - Low-touch Basic/Growth support SLA.
  - Manual Beta onboarding checklist.
  - Escalation triggers for overage, high support demand, legal/privacy, and
    enterprise needs.
- This completes the repo-side draft for the go-live plan's manual payment
  tracking and support/onboarding checklist items.
- Owner/legal/accounting must still confirm invoice/receipt capability before
  collecting money.
- Not performed:
  - No payment was collected.
  - No invoice was issued.
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Closed Beta Onboarding Runbook

- Added `docs/SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md`.
- The runbook covers:
  - Production entry points for prospects, merchants, and platform operators.
  - Beta account handoff rules that avoid storing temporary passwords in
    docs/chat/Git.
  - First-session walkthrough across merchant login, dashboard, Shopee returns,
    manual returns, AI report, and usage settings.
  - Clear Beta scope language: Shopee automated import; official website/momo
    manual entry; email/billing/custom domain/public signup still disabled.
  - Platform operator follow-up in `/internal`.
  - Daily Beta follow-up fields, escalation rules, and first Beta acceptance
    criteria.
- This completes the repo-side customer onboarding script for Closed Manual
  Beta.
- Not performed:
  - No account was provisioned.
  - No password was generated or stored.
  - No customer data was imported.
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Production Smoke Script

- Added `scripts/saas/production-smoke.mjs`.
- Added npm script `saas:production-smoke`.
- The script is read-only and checks:
  - public routes `/`, `/pricing`, `/signup`, `/login`, `/robots.txt`, and
    `/sitemap.xml`;
  - `/pricing` contains 499/699 and does not contain old 1490/2990 markers;
  - unauthenticated merchant protected routes redirect to `/login`;
  - unauthenticated platform routes redirect to the platform-admin login path.
- It defaults to `https://smart-return-system-saas.vercel.app` and can be
  pointed elsewhere with `SAAS_PRODUCTION_URL` or `--url=...`.
- Not performed:
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Privacy, DPA, And Data Deletion SOP

- Added `docs/SAAS_PRIVACY_DPA_DELETION_SOP.md`.
- The SOP covers:
  - SaaS privacy roles and platform-admin privacy boundary.
  - Data categories and draft retention defaults.
  - Subprocessor register draft.
  - Merchant data deletion request workflow.
  - DPA checklist for merchant customers.
  - Security incident workflow.
  - Cookie/analytics tracking checklist.
- This completes the repo-side operating draft for privacy/DPA/deletion
  readiness before paid/public rollout.
- Owner/legal must still review and approve public legal wording before paid
  customers are accepted.
- Not performed:
  - No customer data was exported or deleted.
  - No legal page was finalized.
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-07-01 Owner-Authorized Production Deploy Of 3fadd75

- Owner explicitly authorized deploying latest `develop-saas` HEAD
  `3fadd75 docs(saas): record production deployment gap` to Vercel Production
  project `smart-return-system-saas`.
- Preflight and `npm run safety:agent-boundary` passed.
- `npm run saas:predeploy` passed before deployment, including lint,
  typecheck, unit tests, e2e tests, integration tests, and production build.
- Vercel deployment:
  - ID: `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76`
  - Deployment URL:
    `https://smart-return-system-saas-jq1nrrc1k-kaweis-projects.vercel.app`
  - Production alias: `https://smart-return-system-saas.vercel.app`
  - Status: Ready
- Production smoke after deployment:
  - `/`: `200`
  - `/pricing`: `200`
  - `/signup`: `200`
  - `/login`: `200`
  - `/robots.txt`: `200`
  - `/sitemap.xml`: `200`
  - unauthenticated `/internal`: `307` to `/admin/login?next=%2Finternal`
  - tenant protected routes such as `/analytics`, `/shopee-returns`,
    `/analytics/ai-report`, and `/settings/team`: `307` to `/login`
  - platform entry routes `/admin` and `/admin/login`: redirect to the
    expected platform-admin login path.
- `/pricing` verification:
  - `499` marker present.
  - `699` marker present.
  - `basic` and `growth` plan markers present.
  - `蝦皮`, `官網`, and `momo` multi-channel honesty markers present.
  - checked response no longer exposes the old `1,490` / `2,990` pricing
    markers.
- Vercel still lists the historical `app.smart-return.tw` alias and SSL work
  may remain asynchronous, but the owner has deferred domain purchase/setup and
  no DNS/domain mutation was performed.
- `npx vercel logs` filtered scan was not completed because the current CLI
  rejected the `--level` / `--since` filter combination. Deployment inspect and
  smoke tests passed.
- Not performed:
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-06-30 AI Return Data Flow and Team Member Visibility Draft

- Added `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md` to define the intended
  verification path:
  - merchant/customer workspace: `/login -> /analytics`;
  - platform commercial admin: `/admin -> /internal`;
  - merchant return and AI usage data should aggregate into `/internal`
    summaries by `org_id`, without exposing customer return details in platform
    views.
- Added unit coverage for platform admin usage aggregation from org-scoped
  `return_requests` and non-cached successful `ai_usage_events`.
- Added draft migration `038_saas_org_member_visibility.sql` because
  `/settings/team` still needs owner/admin users to see same-org members through
  normal authenticated RLS clients.
- `038` is repository-only at this point. It was not applied to Supabase and is
  not authorized by this document.
- Superseded on 2026-07-01: owner later authorized applying only `038`; remote
  migration history now records `038` as applied.
- Not performed:
  - No deployment.
  - No migration.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No master/live/internal Supabase action.

## 2026-06-26 Team Invite Status Draft Migration

- Claude QA for `/settings/team` found the real SaaS DB lacks
  `organization_invites.status`, while the P1 team management backend/UI reads
  and writes that column for invite revoke/resend.
- Added draft migration `037_saas_team_invite_status.sql` to:
  - add `organization_invites.status` with `pending/accepted/expired/revoked`;
  - backfill accepted and expired invite states;
  - add an org/status/created index for team settings reads;
  - refresh `accept_organization_invite()` and `create_organization_invite()`
    only after the column exists.
- This initially landed as a repo/schema-contract update only. It was not
  applied to Supabase in commit `e4a3951`.
- Owner later authorized applying only `037`; the apply is recorded in the next
  section.

## 2026-06-26 Owner-Authorized Migration 037 Apply

- Owner explicitly authorized applying only `037_saas_team_invite_status.sql`
  to SaaS Supabase project `auyznbwtjvemyamujmgt`.
- Preflight and `npm run safety:agent-boundary` passed before mutation.
- Remote migration list before apply showed:
  - `035` applied.
  - `033`, `034`, `036`, and `037` pending.
- Codex executed only `supabase/migrations/037_saas_team_invite_status.sql`
  via `supabase db query --linked --file`.
- Codex repaired remote migration history for version `037` to `applied`.
- Remote migration list after apply shows:
  - `035` and `037` applied.
  - `033`, `034`, and `036` still unapplied.
- Verification:
  - `npm run saas:schema-gate:strict` passes.
  - `npm run saas:migration-plan:strict` passes.
  - `npm run saas:doctor` passes with the existing local
    `ENABLE_MULTI_TENANT_ADMIN=true` warning.
  - `npm run lint`, `npm run typecheck`, and `npm run test:all` pass.
- Not performed:
  - No deployment.
  - No env/secret edit.
  - No domain/DNS change.
  - No email provider enablement.
  - No billing/provider enablement.
  - No migrations `033`, `034`, or `036` apply.
  - No master/live/internal Supabase action.

## 2026-06-13 Custom Domain Deferred

- Owner decided to continue Closed Manual Beta on the Vercel production URL:
  `https://smart-return-system-saas.vercel.app`.
- `smart-return.tw` has not been purchased/registered yet, so Codex must not
  keep retrying DNS/Vercel alias verification as an active blocker.
- If the owner later buys/registers a custom domain, resume from the Vercel
  dashboard DNS target recorded below and re-run DNS/HTTPS smoke only after the
  authoritative DNS provider has records.
- No deployment, DNS edit, env/secret edit, migration, email provider
  enablement, billing/provider enablement, or internal/live Supabase action was
  performed for this decision.

## 2026-06-13 Domain Ownership and Email Provider Planning

- Follow-up dashboard check:
  - The owner opened Vercel Dashboard for project `smart-return-system-saas`.
  - The project Domains page shows `app.smart-return.tw` exists, but status is
    `Invalid Configuration`.
  - No TXT ownership record is visible in the dashboard detail panel at this
    time.
  - The dashboard-required DNS record is:
    - Type: `CNAME`
    - Name/Host: `app`
    - Value/Target: `64ed959ebaa2a805.vercel-dns-016.com.`
    - TTL: Auto or 300
  - If the DNS provider rejects the trailing dot, use
    `64ed959ebaa2a805.vercel-dns-016.com`.
  - Vercel notes that old records such as `cname.vercel-dns.com` continue to
    work, but the dashboard recommends the project-specific record above.
  - A direct TWNIC RDAP query for `smart-return.tw` returned 404 while
    `twnic.tw` returns active, and local DNS for both `smart-return.tw` and
    `app.smart-return.tw` still returns no records. This suggests the owner
    still needs to confirm that `smart-return.tw` is registered and delegated
    at the DNS provider before the Vercel CNAME can resolve.
  - Codex did not buy/register a domain, edit DNS, alias the deployment, deploy,
    run migrations, edit env/secrets, or enable any provider.
- Scope:
  - Owner requested a Vercel domain ownership / 403 review plus email provider
    launch planning.
  - No deployment, migration, env/secret edit, DNS/domain mutation, email
    provider enablement, billing/provider enablement, or internal/live Supabase
    action was performed.
  - Preflight confirmed checkout path, `develop-saas`, clean working tree,
    origin remote, and `npm run safety:agent-boundary` passed.
- Vercel project/domain state:
  - Local Vercel project link points to project `smart-return-system-saas`
    (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`) under org/team
    `team_mvnv2WpA6quFmDiFhwMRM3Dz`.
  - `npx vercel project ls` under the current CLI scope returned no projects.
    This conflicts with the local project link and indicates the current CLI
    identity/scope cannot manage the domain ownership state.
  - `npx vercel domains ls` returned `0 Domains found under kaweis-projects`.
  - `npx vercel domains inspect smart-return.tw` and
    `npx vercel domains inspect app.smart-return.tw` both returned Vercel 403
    access errors.
  - `Resolve-DnsName smart-return.tw` and
    `Resolve-DnsName app.smart-return.tw` both returned NXDOMAIN /
    `DNS name does not exist`.
  - No TXT ownership challenge was returned by the CLI. Codex did not attempt
    alias or verification while DNS is NXDOMAIN and Vercel domain inspect is
    403.
- Owner domain action required:
  - In Vercel Dashboard, open project `smart-return-system-saas` ->
    Settings -> Domains.
  - Add `app.smart-return.tw`.
  - If Vercel shows an ownership TXT challenge, copy the exact TXT name/value
    from the dashboard and add it at the DNS provider. Codex cannot safely
    infer this value.
  - At the DNS provider, add:
    - Type: `CNAME`
    - Name/Host: `app`
    - Value/Target: `64ed959ebaa2a805.vercel-dns-016.com.`
    - TTL: Auto or 300
  - After DNS propagation, retry DNS, Vercel inspect, and HTTPS smoke for
    `https://app.smart-return.tw` and `/login`.
- Email provider recommendation:
  - Recommended first provider: Resend.
  - Rationale: simple Next.js integration, Vercel Marketplace can generate a
    `RESEND_API_KEY`, and it is suitable for Beta invite email, trial
    reminders, AI quota reminders, and billing notices.
  - Owner must prepare:
    - Resend account.
    - Verified sender domain, recommended `smart-return.tw`.
    - `RESEND_API_KEY` stored only in Vercel/project env, never in git.
    - Sender address such as `no-reply@smart-return.tw` or
      `support@smart-return.tw`.
    - Decision whether first rollout sends only invite email or also trial,
      quota, and billing notifications.
- Current email backend readiness:
  - `lib/saas/notifications.ts` can build in-app notifications and
    `email_queue` rows for billing failure, AI quota, trial ending, and platform
    announcement events.
  - `lib/saas/email-queue-worker.ts` can inspect queued/due records and compute
    send eligibility, but it is dry-run only.
  - `app/api/cron/saas/email-queue/route.ts` is `CRON_SECRET` gated and rejects
    `dryRun=false` with `delivery_not_enabled`.
  - No provider adapter, provider send call, sent/failed status update,
    provider message id storage, retry mutation, or audit-log write is enabled.
- Minimal future implementation plan after owner provides credentials and
  authorizes email delivery:
  - Add env contract: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`,
    `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `ENABLE_EMAIL_DELIVERY=true`.
  - Keep `dryRun=true` as the default safe mode and require an explicit flag for
    provider sends.
  - Add a Resend adapter with template rendering for existing `template_key`
    values.
  - On success, update `email_queue.status='sent'` and store provider metadata
    if the schema supports it.
  - On failure, increment `attempt_count`, mark transient/permanent failures,
    keep retry limits, and write audit/logging for operator review.
  - Add tests for provider selection, dry-run behavior, success status update,
    failure retry, and route authorization.

## 2026-06-13 Read-Only Rollout Status Check

- Scope:
  - Owner requested a read-only SaaS rollout check.
  - No deployment, migration, env/secret edit, DNS/domain mutation, email
    provider enablement, billing/provider enablement, or internal/live Supabase
    action was performed.
  - Preflight confirmed checkout path, `develop-saas`, origin remote, clean
    working tree, and `npm run safety:agent-boundary` passed.
  - HEAD at the start of the check:
    `b73bdd6 test(saas): add platform admin dashboard e2e flow`.
- Production deployment:
  - `npx vercel inspect https://smart-return-system-saas.vercel.app` reports
    deployment `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot` as Production / Ready.
  - Current production deployment URL:
    `https://smart-return-system-saas-pji1crs57-kaweis-projects.vercel.app`.
  - Aliases still include:
    - `https://smart-return-system-saas.vercel.app`
    - `https://app.smart-return.tw`
- Smoke test against `https://smart-return-system-saas.vercel.app`:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
    `/features/security`, `/contact`, `/signup`, and `/login` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`,
    `/analytics/ai-report`, and `/settings/usage` returned `307`.
  - Protected platform routes `/internal` and `/internal/orgs` returned `307`.
- Custom domain result:
  - `Resolve-DnsName app.smart-return.tw` returns NXDOMAIN /
    `DNS name does not exist`.
  - `Resolve-DnsName smart-return.tw` also returns NXDOMAIN.
  - `https://app.smart-return.tw` and `https://app.smart-return.tw/login`
    cannot be opened because the host cannot be resolved.
  - `npx vercel domains inspect app.smart-return.tw` still returns Vercel 403
    for the current scope.
  - `npx vercel domains ls` still reports `0 Domains found under
    kaweis-projects`.
  - No TXT ownership record was returned by the CLI.
- External blockers:
  - Vercel Production env names include `SENTRY_DSN` and
    `NEXT_PUBLIC_SENTRY_DSN`, so Sentry remains configured.
  - No visible email provider credential names were listed in Vercel Production
    env; email delivery remains owner/provider-blocked.
  - No visible ECPay/Billing provider credential names were listed in Vercel
    Production env; Billing/ECPay remains Stage 2 owner-blocked.
  - Draft migrations `033`, `034`, and `036` are present in the repo and still
    require separate owner authorization before any apply.
- Verification:
  - `npm run saas:doctor`: 155 pass, 1 expected local
    `ENABLE_MULTI_TENANT_ADMIN=true` warning, 0 fail.
  - `npm run lint`: passed.

## 2026-06-13 Owner-Authorized Production Deploy of f634bc0

- Scope:
  - Owner explicitly authorized deploying `develop-saas` latest HEAD
    `f634bc0 fix(saas): keep SEO metadata routes public` to Vercel Production
    project `smart-return-system-saas`.
  - Owner explicitly excluded domain/DNS setup, email provider enablement,
    billing/provider enablement, migrations, and master/live/internal Supabase
    actions.
  - Preflight confirmed:
    - Checkout path:
      `D:\AI專案\AI退貨系統商業版_2026.5.16`
    - Branch: `develop-saas`
    - HEAD: `f634bc0 fix(saas): keep SEO metadata routes public`
    - Vercel project: `smart-return-system-saas`
    - Working tree clean and synced with `origin/develop-saas`
    - `npm run safety:agent-boundary`: passed
  - `npm run saas:predeploy` passed before deployment.
- Production deployment:
  - Deployment URL:
    `https://smart-return-system-saas-pji1crs57-kaweis-projects.vercel.app`
  - Production alias:
    `https://smart-return-system-saas.vercel.app`
  - Vercel deployment ID:
    `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot`
  - Vercel status: Ready.
  - Vercel CLI again listed `https://app.smart-return.tw` as an alias and
    attempted asynchronous SSL creation. Codex did not run a separate
    domain/DNS setup command. `Resolve-DnsName app.smart-return.tw` still does
    not resolve, so the custom domain remains not ready for customer use.
- Smoke test against `https://smart-return-system-saas.vercel.app`:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
    `/features/security`, `/contact`, `/signup`, `/login`, `/robots.txt`, and
    `/sitemap.xml` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`,
    `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login`.
  - Protected platform routes `/internal` and `/internal/orgs` returned
    `307 -> /admin/login?next=...`.
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No domain/DNS configuration command was run.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-12 Post-Rollout Domain/DNS Recheck

- Scope:
  - Rechecked the current SaaS production deployment and custom domain state
    without deploying, changing DNS, editing env/secrets, running migrations, or
    enabling providers.
  - Checkout was clean and synced on `develop-saas` at
    `37ab5b1 docs(saas): record production deploy of 796a02a` before this
    docs-only update.
- Production deployment:
  - Deployment ID: `dpl_28RhEVo2Nespq7xjTEQvmELag34r`.
  - Vercel status: Ready.
  - Vercel inspect still lists aliases for:
    - `https://smart-return-system-saas.vercel.app`
    - `https://app.smart-return.tw`
- Smoke test against `https://smart-return-system-saas.vercel.app`:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
    `/features/security`, `/contact`, `/signup`, and `/login` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`,
    `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login`.
  - Protected platform routes `/internal` and `/internal/orgs` returned
    `307 -> /admin/login?next=...`.
- Custom domain result:
  - `Resolve-DnsName app.smart-return.tw` still returns NXDOMAIN /
    `DNS name does not exist`.
  - `Resolve-DnsName smart-return.tw` also returns NXDOMAIN.
  - Direct HTTPS checks for `https://app.smart-return.tw` and
    `https://app.smart-return.tw/login` fail because the host cannot be
    resolved.
  - `npx vercel domains inspect app.smart-return.tw` still returns Vercel 403:
    `You don't have access to the domain app.smart-return.tw under
    kaweis-projects.`
  - `npx vercel domains ls` still reports `0 Domains found under
    kaweis-projects`.
  - The CLI did not return a TXT ownership record, so there is no safe TXT value
    to report from this checkout.
- Current conclusion:
  - Production remains usable at
    `https://smart-return-system-saas.vercel.app`.
  - `https://app.smart-return.tw` is not customer-ready until owner/DNS action
    makes the domain resolve and Vercel ownership/SSL verification passes.
  - No alias, DNS, deployment, migration, env/secret, email provider, billing,
    or internal/live Supabase change was performed.

## 2026-06-12 Owner-Authorized Production Deploy of 796a02a

- Scope:
  - Owner explicitly authorized deploying `develop-saas` latest HEAD
    `796a02a docs(saas): record sequential completion blockers` to Vercel
    Production project `smart-return-system-saas`.
  - Owner explicitly excluded domain/DNS setup, email provider enablement,
    billing/provider enablement, migrations, and master/live/internal Supabase
    actions.
  - Preflight confirmed:
    - Checkout path:
      `D:\AI專案\AI退貨系統商業版_2026.5.16`
    - Branch: `develop-saas`
    - HEAD: `796a02a docs(saas): record sequential completion blockers`
    - Vercel project:
      `smart-return-system-saas` (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`)
    - Working tree clean and synced with `origin/develop-saas`
    - `npm run safety:agent-boundary`: passed
  - `npm run saas:predeploy` passed before deployment.
- Production deployment:
  - Deployment URL:
    `https://smart-return-system-saas-a0vn28pwk-kaweis-projects.vercel.app`
  - Production alias:
    `https://smart-return-system-saas.vercel.app`
  - Vercel deployment ID:
    `dpl_28RhEVo2Nespq7xjTEQvmELag34r`
  - Vercel status: Ready.
  - Vercel CLI also reported `app.smart-return.tw` as an alias and started
    asynchronous SSL creation. This happened as part of the existing Vercel
    production alias behavior; Codex did not run a separate domain/DNS setup
    command in this deployment. Local DNS lookup still does not resolve
    `app.smart-return.tw`, so the custom domain remains not ready for customer
    use.
- Smoke test against `https://smart-return-system-saas.vercel.app`:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
    `/features/security`, `/contact`, `/signup`, and `/login` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`,
    `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login`.
  - Protected platform routes `/internal` and `/internal/orgs` returned
    `307 -> /admin/login?next=...`.
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No domain/DNS configuration command was run.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-12 Source Head and Split Queue Refresh (Pre-Deploy Snapshot)

- Scope:
  - Refreshed the SaaS external status after the latest local UI/backend handoffs were completed and pushed.
  - Current branch: `develop-saas`.
  - Latest pushed source HEAD: `b2fc132 fix(saas/ui): refine platform dashboard alerts`.
  - At that time, production remained on the previous owner-authorized deployment `0c9c983 docs(saas): avoid stale latest head wording` / `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`.
- Completed since the previous external status snapshot:
  - Platform organization trial deadline DTO handoff.
  - Platform operations UI simplification for `/internal/orgs`, `/internal/orgs/[id]`, and `/internal/billing/events`.
  - Merchant sidebar cleanup plus `/settings` secondary-entry gating for onboarding and backups.
  - `/internal` alert message/action copy refinement.
- Current split:
  - Claude UI: no open unblocked UI task is recorded.
  - Codex backend/API/docs: no open unblocked backend/API/migration task is recorded.
  - External operations: blocked until the owner provides DNS/provider/billing values or explicit migration/deploy authorization.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-12 Sequential Completion Check (Pre-Deploy Snapshot)

- Scope:
  - Re-ran the safe local checks after the owner asked to continue completing
    the remaining queue in order.
  - No external mutation was attempted because the remaining queue still needs
    owner-provided DNS/provider/billing values or explicit per-action
    authorization.
- Results:
  - `npm run saas:doctor`: 155 pass, 1 warn, 0 fail.
    - Warning: local `ENABLE_MULTI_TENANT_ADMIN=true`, which is expected for
      local platform-admin preview.
  - `npm run saas:rollout-check`: 22 pass, 3 warn, 0 fail.
    - Warning: local `ADMIN_PASSWORD` is missing/placeholder/short for rollout
      posture. This is local-env readiness, not a committed secret.
    - Warning: local Sentry/logging DSN is missing for rollout-check. Vercel
      Production Sentry env was previously configured; do not write DSN values
      into git.
    - Warning: `ENABLE_BILLING=false`, which remains correct for Manual Beta
      and not ready for paid self-serve.
  - `Resolve-DnsName app.smart-return.tw`: still `DNS name does not exist`
    / NXDOMAIN.
- Current conclusion:
  - Local code/docs work remains complete.
  - At that time, production still had not been redeployed beyond `0c9c983`.
  - Custom domain setup is still blocked until DNS ownership/records exist.
  - Email provider, Billing/ECPay, and migrations `033`/`034`/`036` remain
    blocked until the owner provides values and explicit per-action
    authorization.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-06 Owner-Authorized Production Deploy of Current HEAD

- Scope:
  - Owner authorized deploying current `origin/develop-saas` HEAD to Vercel Production project `smart-return-system-saas`.
  - Required included commit: `27c5ecb fix(saas): gate backup and maintenance cron isolation`.
  - Actual deployed HEAD: `0c9c983 docs(saas): avoid stale latest head wording`, which contains `27c5ecb`.
  - Preflight passed on `develop-saas`, working tree was clean, and `npm run safety:agent-boundary` passed.
  - `git pull --ff-only origin develop-saas` was already up to date before deploy.
  - `.vercel/project.json` confirmed project `smart-return-system-saas` (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
  - `npm run saas:predeploy` passed before deployment.
- Production deployment:
  - Deployment URL: `https://smart-return-system-saas-lb3o8btq0-kaweis-projects.vercel.app`.
  - Production alias: `https://smart-return-system-saas.vercel.app`.
  - Vercel deployment ID: `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`.
  - Vercel status: Ready.
- Smoke test:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/signup`, `/login` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`, `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login` for unauthenticated visitors.
  - Protected platform routes `/internal` and `/internal/orgs` returned `307 -> /admin/login?next=...` for unauthenticated visitors.
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-06 Custom Domain Attempt

- Scope:
  - Owner authorized setting up the selected SaaS app domain
    `app.smart-return.tw`.
  - Preflight passed on `develop-saas`, working tree was clean, and
    `npm run safety:agent-boundary` passed.
  - Target Vercel project was confirmed as `smart-return-system-saas`
    (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
- Attempted actions:
  - `npx vercel domains inspect app.smart-return.tw` before setup returned
    `Domain not found`.
  - `npx vercel domains add app.smart-return.tw` printed
    `Success! Domain app.smart-return.tw added to project
    smart-return-system-saas.`
  - The same command then failed while fetching the domain with a Vercel 403
    domain access error.
  - `npx vercel domains inspect app.smart-return.tw` still failed with:
    `You don't have access to the domain app.smart-return.tw under
    kaweis-projects.`
  - `npx vercel alias set smart-return-system-saas-lb3o8btq0-kaweis-projects.vercel.app app.smart-return.tw`
    failed with the same Vercel 403 domain access error.
  - `npx vercel domains ls` reports 0 domains under the current Vercel scope.
  - Local DNS lookup for `app.smart-return.tw` and `smart-return.tw` returned
    no records.
- Current result:
  - The custom domain is not ready.
  - Production remains available at
    `https://smart-return-system-saas.vercel.app`.
  - Owner/DNS action is required before retrying Vercel verification.
- Retry check after owner request:
  - `Resolve-DnsName app.smart-return.tw` still returns NXDOMAIN /
    `DNS name does not exist`.
  - `npx vercel domains inspect app.smart-return.tw` still returns:
    `You don't have access to the domain app.smart-return.tw under
    kaweis-projects.`
  - `npx vercel domains ls` still reports `0 Domains found under
    kaweis-projects`.
  - No Vercel TXT ownership verification record was returned by the CLI; there
    is no safe TXT value to report from this checkout.
  - Alias was not attempted on this retry because DNS is not resolving and
    Vercel domain access is still blocked.
- Required owner/DNS action:
  - Add a DNS record at the domain provider:
    - Type: `CNAME`
    - Name/Host: `app`
    - Value/Target: `cname.vercel-dns.com`
  - If Vercel dashboard asks for a domain ownership `TXT` verification record,
    add that exact TXT record first.
  - After DNS propagates, retry domain verification/alias and then decide
    whether to update `NEXT_PUBLIC_APP_URL` to `https://app.smart-return.tw`.
- Not performed:
  - No migration was run.
  - No env/secret was changed.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-06 Owner-Authorized Migration 035 Apply

- Scope:
  - Owner explicitly authorized applying only `035_saas_onboarding_completion_rpc.sql` to SaaS Supabase project `auyznbwtjvemyamujmgt`.
  - Preflight passed on `develop-saas` with a clean working tree and `npm run safety:agent-boundary` passed.
  - `npm run saas:migration-plan:strict` passed before the apply and confirmed:
    - `SAAS_SUPABASE_PROJECT_ID=auyznbwtjvemyamujmgt`
    - `SUPABASE_PROJECT_ID_EXPECTED=auyznbwtjvemyamujmgt`
    - Supabase URL matches the SaaS ref
    - forbidden internal/live refs were not targeted
    - `SUPABASE_DB_PASSWORD` is set
  - Remote migration list before apply showed `033`, `034`, `035`, and `036` pending.
  - Applied only `supabase/migrations/035_saas_onboarding_completion_rpc.sql` via the linked SaaS database query path.
  - Repaired remote migration history for version `035` to `applied`.
- Post-checks:
  - Remote migration list now shows `035` applied and `033`, `034`, `036` still unapplied.
  - `public.complete_organization_onboarding(uuid, uuid, timestamptz, jsonb)` exists.
  - `service_role` has execute privilege on the RPC.
  - `npm run saas:schema-gate:strict`: passed (`22 table(s), 81 column(s) checked`).
  - `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning remains local `ENABLE_MULTI_TENANT_ADMIN=true`.
- Not performed:
  - No deployment was performed.
  - No env/secret was changed.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No migrations `033`, `034`, or `036` were applied.
  - No master/live/internal Supabase action was performed.

## 2026-06-06 Sentry Setup and Production Redeploy

- Scope:
  - Created Sentry organization `smart-return-saas` using Google account `kawei88888@gmail.com`.
  - Sentry shows a 14-day Business trial and states the account moves to the free plan after the trial with no charge.
  - Selected Next.js setup and copied the project DSN from Sentry.
  - Set SaaS Vercel Production env vars `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` on project `smart-return-system-saas`.
  - Did not write DSN values to git or docs, and cleared the clipboard after setting env.
  - Redeployed production so the new Sentry env values are available at runtime.
- Production deployment:
  - Deployment URL: `https://smart-return-system-saas-74zuwjn4w-kaweis-projects.vercel.app`.
  - Production alias: `https://smart-return-system-saas.vercel.app`.
  - Vercel deployment ID: `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`.
  - Vercel status: Ready.
- Smoke test:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/signup`, `/login` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`, `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login` for unauthenticated visitors.
  - Protected platform routes `/internal` and `/internal/orgs` returned `307 -> /admin/login?next=...` for unauthenticated visitors.
- Verification:
  - `npm run saas:predeploy`: passed before deployment.
  - Vercel env name check: `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are present for Production.
  - Local `saas:rollout-check` still warns about missing Sentry DSN because `.env.saas.local` intentionally does not store the DSN; Vercel Production env is configured.
- Not performed:
  - No migration was run.
  - No source code was changed.
  - No DSN value was committed.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-06 Owner-Blocked Readiness Audit

- Scope:
  - Completed the remaining safe, read-only SaaS launch checks requested by the owner.
  - No deploy, migration, env/secret edit, Sentry/domain/email/billing/provider enablement, DNS change, master/live/prod/internal Supabase action, or production setting mutation was performed.
- Project and deployment:
  - `npx vercel project inspect smart-return-system-saas` confirmed Vercel project `smart-return-system-saas` (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
  - `npm run saas:doctor` confirmed the Vercel project is not linked to the internal/live project and the SaaS Supabase project ref is `auyznbwtjvemyamujmgt`.
  - `npx vercel inspect https://smart-return-system-saas.vercel.app` confirmed production deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` is Ready.
  - Production URL remains `https://smart-return-system-saas.vercel.app`.
- Sentry/logging:
  - Vercel production env names still do not list `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
  - No placeholder DSN was set. This remains owner-blocked until a real SaaS-only DSN is provided.
- Domain:
  - Vercel inspect shows only Vercel-managed aliases for this SaaS project.
  - No custom/beta domain was configured because no domain value or DNS authority was provided.
- Email provider:
  - Vercel production env names still do not list Resend, Postmark, SendGrid, SMTP, or equivalent provider credentials.
  - Email provider delivery remains dry-run only. No provider was enabled.
- Billing/ECPay:
  - `ENABLE_BILLING` remains present as an encrypted production env key, but no secret value was pulled or printed.
  - No `BILLING_PROVIDER`, `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, or `ECPAY_MODE` production env keys were listed.
  - Manual Beta remains on the correct `ENABLE_BILLING=false` posture; no provider was enabled.
- Draft migrations:
  - `033_saas_platform_billing_operations.sql`, `034_saas_notification_email_queue.sql`, `035_saas_onboarding_completion_rpc.sql`, and `036_saas_platform_admin_roles.sql` remain repo draft files.
  - No migration was applied. `035` remains the only first-candidate migration, and still requires explicit owner authorization before any SaaS Supabase production migration work.
- Verification:
  - `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run saas:rollout-check`: 23 pass, 2 warn, 0 fail. Warnings are missing Sentry DSN and billing disabled, both expected for Manual Beta.
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm run test:all`: passed (`test:scripts-backend`, `test:unit`, `test:e2e`, and `test:integration`).

## 2026-06-05 Production Deploy of 9176589

- Scope:
  - Owner authorized deploying `develop-saas` HEAD `9176589 fix(saas/ui): finish public RWD and role separation polish` to Vercel production project `smart-return-system-saas`.
  - Ran `npm run saas:predeploy` locally before deployment; it passed.
  - Deployment URL: `https://smart-return-system-saas-qrewyhbga-kaweis-projects.vercel.app`.
  - Production alias: `https://smart-return-system-saas.vercel.app`.
  - Vercel deployment ID: `dpl_x5K1udVYJBGo1sMEwenry9csz8UR`.
  - Vercel status: Ready.
- Smoke test:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/signup`, `/login` returned `200`.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`, `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login` for unauthenticated visitors.
  - Protected platform routes `/internal` and `/internal/orgs` returned `307 -> /admin/login?next=...` for unauthenticated visitors.
- Remaining blockers:
  - Sentry DSN is still not configured. Add SaaS-only `SENTRY_DSN` and optionally `NEXT_PUBLIC_SENTRY_DSN` in Vercel after a real DSN is available.
  - Custom/beta domain is still not configured because no target domain/DNS access was provided.
  - Email provider delivery remains dry-run because no provider/API credentials were provided.
  - Billing/ECPay remains disabled because no ECPay credentials were provided.
  - Draft migrations `033`-`036` remain unapplied; this deployment did not run Supabase migrations.
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-06-05 Post-Deploy External Blocker Audit

- Scope:
  - Read-only post-deploy check after documenting deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR`.
  - No deploy, migration, env/secret edit, domain/DNS change, provider enablement, billing enablement, master/live/prod/internal Supabase action, or production setting mutation was performed.
- Production deployment:
  - `npx vercel inspect https://smart-return-system-saas.vercel.app` fetched deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR`.
  - Target is `production`.
  - Status is Ready.
  - Production alias remains `https://smart-return-system-saas.vercel.app`.
- Sentry/logging:
  - `npx vercel env ls` did not list `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
  - Sentry SDK support exists in code, but production monitoring remains inactive until owner adds SaaS-only DSN values in Vercel.
- Domain:
  - Vercel inspect shows only Vercel-managed aliases for the SaaS project.
  - No custom or beta domain is visible from the read-only check.
- Email provider:
  - Vercel production env names do not list provider keys such as Resend, Postmark, SendGrid, SMTP, or a configured email provider selector.
  - Email queue/worker remains dry-run only until owner selects a provider, configures sender/domain authentication, and authorizes real delivery.
- Billing/ECPay:
  - `ENABLE_BILLING` is present as a production env key, but its encrypted value was not pulled or printed.
  - No `BILLING_PROVIDER`, `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, or `ECPAY_MODE` production env keys were listed.
  - Billing remains blocked for paid self-serve until owner provides ECPay credentials and explicitly authorizes provider activation.
- Draft migrations:
  - Draft files remain present in the repo:
    - `033_saas_platform_billing_operations.sql`
    - `034_saas_notification_email_queue.sql`
    - `035_saas_onboarding_completion_rpc.sql`
    - `036_saas_platform_admin_roles.sql`
  - They remain recorded as unapplied and require separate owner authorization before any SaaS DB migration work.

## 2026-06-05 Public Marketing / Legal RWD QA

- Scope:
  - Local UI-only QA for `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/legal/terms`, `/legal/privacy`, `/legal/refund`, and `/signup`.
  - Customer vs platform role separation UI status recording.
- Local smoke:
  - All eight public/legal/signup routes returned `200` from `http://localhost:3002`.
- Mobile RWD:
  - Chrome DevTools viewport `390x844`.
  - No horizontal overflow detected on the eight routes.
  - Public marketing nav links and CTAs meet 44px touch target sizing after this UI-only pass.
- Login build readiness:
  - `/login` now wraps the search-param-dependent client UI in Suspense, satisfying the Next 16 production build prerender requirement without changing auth actions or redirect behavior.
- Role separation UI:
  - `/login?next=/internal...` distinguishes platform admin login from merchant login.
  - `/internal` gated/forbidden states explain platform admin account switching.
  - Merchant sidebar remains focused on merchant workflows and does not include platform-management entries.
- Verification:
  - `npm run lint`: passed with no warnings.
- Not performed:
  - No backend/API/server action change.
  - No migration was run.
  - No deployment was performed.
  - No env/secret was edited.
  - No billing/provider/domain setting was changed.

## 2026-05-28 Production Deploy of c335410

- Scope:
  - Ran `npm run saas:predeploy` locally before deployment.
  - Deployed latest `develop-saas` HEAD `c335410 chore(saas): clean up non-ui lint warnings` to Vercel production project `smart-return-system-saas`.
  - Deployment URL: `https://smart-return-system-saas-52lgyehzp-kaweis-projects.vercel.app`.
  - Production alias: `https://smart-return-system-saas.vercel.app`.
  - Vercel deployment ID: `dpl_4rT9FztGCfh6QxcM9mUHzaBPkSzh`.
- Smoke test:
  - Public routes `/`, `/pricing`, `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/signup`, `/login` returned `200`.
  - `/admin` and `/admin/login` returned `307`, preserving platform admin entry routing.
  - Protected tenant routes `/analytics`, `/returns`, `/pickup/scan`, `/analytics/ai-report`, and `/settings/usage` returned `307 -> /login` for unauthenticated visitors.
  - Protected platform routes `/internal` and `/internal/orgs` returned `307 -> /admin/login?next=...` for unauthenticated visitors.
- Remaining blockers:
  - Sentry DSN is still not configured. Add SaaS-only `SENTRY_DSN` and optionally `NEXT_PUBLIC_SENTRY_DSN` in Vercel after a real DSN is available.
  - Custom/beta domain is still not configured because no target domain/DNS access was provided.
  - Email provider delivery remains dry-run because no provider/API credentials were provided.
  - Billing/ECPay remains disabled because no ECPay credentials were provided.
  - Draft migrations `033`-`036` remain unapplied; this deployment did not run Supabase migrations.
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-05-28 Public Signup Rate Limit

- Scope:
  - Added `lib/security/request-rate-limit.ts` as a shared in-memory request limiter.
  - Applied best-effort throttling to `POST /api/saas/signup`.
  - The limiter keys by scope, forwarded client IP, and user agent.
  - Public signup remains disabled by default; this is a future public-rollout hardening step only.
- Limitations:
  - This is per-runtime memory state. It is enough for Manual Beta hardening but does not replace edge/WAF or persistent rate limiting before broad public traffic.
- Verification:
  - `npm run test:unit -- tests/unit/request-rate-limit.test.ts tests/unit/saas-public-signup-request.test.ts tests/unit/saas-public-signup.test.ts`: passed as part of the unit suite, 71 files and 388 tests.
  - `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run lint`: 0 errors and existing 44 warnings.
  - `npm run typecheck`: passed.
  - `npm audit --audit-level=high`: passed with no high-severity advisories.
  - `npm run saas:predeploy`: passed. Rollout check warnings were the expected dirty local tree before commit, missing Sentry DSN, and billing disabled for Manual Beta.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No domain/DNS, billing/provider, email provider, master/live/prod, or production/internal Supabase change was performed.

## 2026-05-28 Mutation Same-Origin Guard

- Scope:
  - Added `lib/security/same-origin.ts`.
  - Added shared rejection for explicit cross-site mutation requests using `Sec-Fetch-Site`, `Origin`, and `Referer`.
  - The guard allows requests without browser origin headers so local tests and non-browser clients are not silently broken.
  - Applied the guard to browser-driven mutation routes:
    - `/api/v1/upload/session`
    - `/api/v1/upload/signed-url`
    - `/api/v1/ai/analyze`
    - `/api/saas/signup`
    - `/api/saas/invite/accept`
    - `/api/saas/onboarding/complete`
    - `/api/saas/team/invites`
    - `/api/internal/saas/orgs`
    - `/api/internal/saas/orgs/[id]/preview`
    - `/api/internal/saas/tenant-preview` `DELETE`
    - `/api/internal/saas/platform-admins`
    - `/api/internal/saas/billing/operations`
    - `/api/internal/saas/billing/events/[id]/retry`
  - ECPay webhook, cron, and schema drift alert endpoints are intentionally not same-origin guarded because they are provider/secret-gated server-to-server routes.
- Verification:
  - `npm run test:unit -- tests/unit/same-origin-request.test.ts tests/unit/upload-session.route.test.ts tests/unit/upload-signed-url.route.test.ts tests/unit/saas-team-invite-route.test.ts tests/unit/saas-onboarding-route.test.ts tests/unit/saas-invite-accept-route.test.ts tests/unit/saas-platform-admin-routes.test.ts tests/unit/security-headers.test.ts`: passed as part of the unit suite, 70 files and 384 tests.
  - `npm run saas:doctor`: 153 pass, 1 warn, 0 fail. The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run lint`: 0 errors and existing 44 warnings.
  - `npm run typecheck`: passed.
  - `npm audit --audit-level=high`: passed with no high-severity advisories.
  - `npm run saas:predeploy`: passed. Rollout check warnings were the expected dirty local tree before commit, missing Sentry DSN, and billing disabled for Manual Beta.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No domain/DNS, billing/provider, email provider, master/live/prod, or production/internal Supabase change was performed.

## 2026-05-28 Platform Admin Login Throttling

- Scope:
  - Added best-effort throttling for the platform admin password branch in `signIn()`.
  - The throttle key combines the attempted admin login id and the forwarded client IP.
  - Repeated failed admin password attempts lock the key for the configured lockout window.
  - Successful admin login clears the failure counter for that key.
  - Added unit coverage and SaaS doctor coverage for the throttle contract.
- Important audit clarification:
  - The earlier external AI note suggested renaming `proxy.ts` back to `middleware.ts`.
  - This repository is pinned to Next.js `16.2.6`, where `proxy.ts` is the active proxy/middleware entry convention. Local builds already report `Proxy (Middleware)`.
  - No proxy rename was performed.
- Limitations:
  - The throttle is in-memory per server runtime instance. It improves the closed-beta admin password path, but public rollout should still add a provider-level edge/WAF rate limit or persistent store-backed rate limit.
- Verification:
  - `npm run test:unit -- tests/unit/admin-login-rate-limit.test.ts tests/unit/admin-login.test.ts tests/unit/post-login-redirect.test.ts tests/unit/security-headers.test.ts`: passed as part of the unit suite, 69 files and 378 tests.
  - `npm run saas:doctor`: 151 pass, 1 warn, 0 fail. The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run lint`: 0 errors and existing 44 warnings.
  - `npm run typecheck`: passed.
  - `npm audit --audit-level=high`: passed with no high-severity advisories.
  - `npm run saas:predeploy`: passed. Rollout check warnings were the expected dirty local tree before commit, missing Sentry DSN, and billing disabled for Manual Beta.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No domain/DNS, billing/provider, email provider, master/live/prod, or production/internal Supabase change was performed.

## 2026-05-28 Post-Push Vercel Preview Check

- Scope:
  - Read-only check after pushing `82d8b0d fix(saas): harden launch security posture`.
  - No production deploy or promote was run.
- Git state:
  - `develop-saas` is synchronized with `origin/develop-saas`.
  - Latest HEAD is `82d8b0d`.
- Vercel status:
  - `vercel project inspect smart-return-system-saas` still shows the correct SaaS project link.
  - `vercel inspect https://smart-return-system-saas-git-develop-saas-kaweis-projects.vercel.app` still points to Preview deployment `dpl_5qqTLC2gQ6AZKWoF2oqteygma4nd` created on 2026-05-27.
  - `vercel ls smart-return-system-saas --yes` did not show a new Preview deployment for `82d8b0d` immediately after the Git push.
- Launch implication:
  - Do not assume Git push alone updates Vercel Preview or Production.
  - Production launch still requires explicit owner authorization and an explicit Vercel production deploy/promote flow.
  - After any deploy, smoke test the production URL and verify the security headers are present.

## 2026-05-28 Launch Security Hardening

- Scope:
  - Added baseline browser security headers through `next.config.ts`.
  - Updated runtime dependencies with non-breaking `npm audit fix` results, including locking Next.js to `16.2.6`.
  - Added unit coverage for security header policy.
  - Added SaaS doctor coverage so future readiness checks fail if security headers are removed.
- Security headers now configured:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- Audit result:
  - `npm audit --audit-level=high`: no high-severity advisories.
  - `npm audit --omit=dev --audit-level=moderate`: still reports 4 moderate advisories.
  - Remaining moderate advisories require `npm audit fix --force`, which would make breaking changes (`next@9.3.3` or `exceljs@3.4.0` according to npm output), so they were not force-applied.
- Verification:
  - `npm run saas:doctor`: 149 pass, 1 warn, 0 fail. The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run lint`: 0 errors and existing 44 warnings.
  - `npm run typecheck`: passed.
  - `npm run test:unit -- tests/unit/security-headers.test.ts`: passed as part of the unit suite.
  - `npm run saas:predeploy`: passed, including schema gate, lint, typecheck, tests, and build.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No domain/DNS, billing/provider, email provider, master/live/prod, or production/internal Supabase change was performed.

## 2026-05-27 Git / Vercel Linkage Status

- Scope:
  - Recorded the current Git/Vercel linkage after the latest customer/platform role-separation commits.
  - No deploy, migration, env/secret edit, domain/DNS change, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
- Git state:
  - Branch: `develop-saas`
  - Latest HEAD: `bf371b8 fix(saas): redirect merchant admin entry to workspace`
  - `develop-saas` is synchronized with `origin/develop-saas`.
- Vercel linkage:
  - Local `.vercel/project.json` links this checkout to Vercel project `smart-return-system-saas` (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
  - Previous `develop-saas` pushes created Preview deployments and the branch alias `https://smart-return-system-saas-git-develop-saas-kaweis-projects.vercel.app`, but the 2026-05-28 post-push check did not show a new Preview for `82d8b0d`.
  - Latest observed Preview deployment: `dpl_5qqTLC2gQ6AZKWoF2oqteygma4nd`, URL `https://smart-return-system-saas-8uy178u4v-kaweis-projects.vercel.app`, status Ready.
- Production status:
  - Production URL remains `https://smart-return-system-saas.vercel.app`.
  - Current production deployment remains `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`, status Ready.
  - Production still requires explicit owner authorization for any new production deploy/promote.
- Expected remaining blockers:
  - Sentry DSN is still missing.
  - Billing/ECPay remains disabled for Manual Beta.
  - Beta/custom domain and email provider delivery remain owner-blocked.
  - Draft migrations `033`-`036` remain unapplied until explicit approval.

## 2026-05-27 Latest Git Readiness Status

- Scope:
  - Recorded latest Git/readiness state after customer/platform role-separation follow-up.
  - Branch: `develop-saas`
  - Latest observed application/UI HEAD before this docs record: `a63cfe2 fix(saas/ui): align /not-found copy and palette with SaaS branding`
  - Relevant recent commits:
    - `1426e7c fix(saas): route platform admin entry through proxy`
    - `ca773c8 fix(saas/ui): align login page with SaaS branding`
    - `31e2362 feat(saas/ui): add loading skeleton for /internal pages`
    - `a63cfe2 fix(saas/ui): align /not-found copy and palette with SaaS branding`
- Current Git state:
  - `develop-saas` is synchronized with `origin/develop-saas`.
  - Working tree is clean.
- Verification:
  - `npm run safety:agent-boundary`: passed.
  - `npm run saas:doctor`: 147 pass, 1 warn, 0 fail. The warning is local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run saas:predeploy`: passed.
    - `saas:rollout-check`: 23 pass, 2 warn, 0 fail.
    - Expected warnings: missing Sentry/logging DSN and `ENABLE_BILLING=false`.
    - `lint`: 0 errors and existing 44 warnings.
    - `test:all`: 65 unit files, 362 unit tests, 2 e2e tests, and 5 integration tests passed.
    - `saas:build`: passed.
- Production status:
  - Production URL: `https://smart-return-system-saas.vercel.app`
  - Current production deployment remains `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`.
  - Latest application/UI HEAD `a63cfe2` and later role-separation hardening through `bf371b8` are not yet production-deployed.
  - Production `/admin`, `/admin/login`, and `/internal/*` may still show the previous routing behavior until owner authorizes deployment of latest HEAD.
- Not performed:
  - No deployment was run.
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-05-27 Onboarding Guide Hotfix Deployment

- Scope:
  - Fixed the customer `/onboarding` setting guide failure caused by legacy `system_settings` RLS recursing through `public.users`.
  - Kept the onboarding guide available instead of removing it.
  - If only the optional return-policy signal hits the legacy `users` recursion, the page now treats that signal as incomplete and continues rendering the rest of onboarding progress.
- Commit:
  - `a3af638 fix(saas): keep onboarding guide available on legacy policy recursion`
- Changed files:
  - `lib/saas/onboarding-live-data.ts`
  - `tests/unit/saas-onboarding-live-data.test.ts`
- Verification before deploy:
  - `npx vitest run tests/unit/saas-onboarding-live-data.test.ts`: passed, 8 tests.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed, 0 errors and existing 44 warnings.
  - `npm run saas:predeploy`: passed. The rollout check warned about the dirty tree before commit, missing Sentry DSN, and `ENABLE_BILLING=false`; these were expected for a local hotfix/prepaid Manual Beta state.
- Vercel deployment:
  - Deployment ID: `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`
  - Inspect URL: `https://vercel.com/kaweis-projects/smart-return-system-saas/58GGGEpqZTtj6MPGyQvQ5jYhX6zr`
  - Production URL: `https://smart-return-system-saas.vercel.app`
  - Deployment URL: `https://smart-return-system-saas-i3a3bxb3h-kaweis-projects.vercel.app`
  - Status: Ready
- Production smoke after deploy:
  - `/`: 200
  - `/login`: 200
  - `/onboarding`: 307 -> `/login` when unauthenticated.
  - `/settings/usage`: 307 -> `/login` when unauthenticated.
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-05-27 Latest HEAD Production Deployment

- Scope:
  - Owner-authorized deployment of latest `develop-saas` HEAD to SaaS Vercel project `smart-return-system-saas`.
  - Branch: `develop-saas`
  - Deployed commit: `c699e70 docs(saas): record latest deploy readiness status`
- Sentry DSN status:
  - Local ignored env files do not contain a usable `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
  - Vercel production env does not list `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
  - Sentry runtime support remains in code, but monitoring is not active until the owner provides a real SaaS-only DSN and adds it to Vercel env.
  - No DSN value was written to repo files.
- Predeploy gates run before deploy:
  - `npm run safety:agent-boundary`: passed.
  - `npm run saas:doctor`: 147 pass, 1 warn, 0 fail. The warning was local `ENABLE_MULTI_TENANT_ADMIN=true`.
  - `npm run saas:rollout-check:strict`: 23 pass, 2 warn, 0 fail. Warnings were missing Sentry DSN and `ENABLE_BILLING=false`, expected for Manual Beta.
  - `npm run lint`: passed, 0 errors and existing 44 warnings.
  - `npm run typecheck`: passed.
  - `npm run test:all`: passed.
  - `npm run build`: passed.
  - `npm run saas:predeploy`: passed, including SaaS env, schema gate, lint, typecheck, tests, and SaaS build.
- Vercel deployment:
  - Deployment ID: `dpl_9KFNXG1Cw6k54uvSJNuruJchDb5H`
  - Inspect URL: `https://vercel.com/kaweis-projects/smart-return-system-saas/9KFNXG1Cw6k54uvSJNuruJchDb5H`
  - Production URL: `https://smart-return-system-saas.vercel.app`
  - Deployment URL: `https://smart-return-system-saas-1f7j7bxqd-kaweis-projects.vercel.app`
  - Status: Ready
  - Aliases:
    - `https://smart-return-system-saas.vercel.app`
    - `https://smart-return-system-saas-kaweis-projects.vercel.app`
    - `https://smart-return-system-saas-kame5201314-crypto-kaweis-projects.vercel.app`
- Production public route smoke:
  - `/`: 200
  - `/pricing`: 200
  - `/features/returns`: 200
  - `/features/ai`: 200
  - `/features/security`: 200
  - `/contact`: 200
  - `/signup`: 200
  - `/login`: 200
  - `/legal/terms`: 200
  - `/legal/privacy`: 200
  - `/legal/refund`: 200
- Production unauthenticated route protection smoke:
  - `/returns`: 307 -> `/login`
  - `/pickup/scan`: 307 -> `/login`
  - `/analytics/ai-report`: 307 -> `/login`
  - `/settings/usage`: 307 -> `/login`
  - `/internal/orgs`: 307 -> `/login`
- Not performed:
  - No migration was run.
  - No env/secret was edited.
  - No Sentry DSN was configured.
  - No custom domain/DNS was configured.
  - No email provider was enabled.
  - No billing/provider was enabled.
  - No master/live/internal Supabase action was performed.

## 2026-05-26 Latest Deploy Readiness Status

- Scope:
  - Read-only deploy readiness status refresh for SaaS project `smart-return-system-saas`.
  - Branch: `develop-saas`
  - Latest observed HEAD: `4a1d7f8 docs(saas): record latest ui handoffs`
  - `develop-saas` is synchronized with `origin/develop-saas`.
- Latest HEAD contents:
  - Includes the latest Claude UI improvements recorded through `615ce7c fix(saas/ui): add mobile nav drawer on marketing shell`.
  - Also includes recent UI readiness commits for onboarding focus, billing trial/cancellation banners, and settings header consistency.
  - Production deployment of this latest HEAD still requires explicit owner authorization.
- Vercel production status:
  - Production URL remains `https://smart-return-system-saas.vercel.app`.
  - Deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` remains Ready.
  - This is the earlier Closed Manual Beta production deployment recorded as `99c4046 feat(saas): add Sentry runtime configuration`.
  - Recent deployments observed from Vercel are Preview deployments only.
  - No production deployment was triggered in this review.
- Owner-blocked external setup:
  - Sentry DSN is still missing. Add SaaS-only `SENTRY_DSN` and optionally `NEXT_PUBLIC_SENTRY_DSN` in Vercel before broader Beta/public use. Do not commit DSN values to git.
  - Beta/custom domain is still not configured; Vercel currently reports no custom domains for this project/account.
  - Email provider delivery remains dry-run only; no provider adapter is enabled.
  - Billing/ECPay remains disabled and belongs to Stage 2 only.
  - Draft migrations `033`-`036` remain unapplied and must not be touched without explicit owner approval.
- Future deploy gate if owner explicitly authorizes deploying latest HEAD:
  - `npm run safety:agent-boundary`
  - `npm run saas:doctor`
  - `npm run saas:rollout-check:strict`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:all`
  - `npm run build`
  - `npm run saas:predeploy`

## 2026-05-26 External Rollout Blocker Refresh

- Scope:
  - Read-only external rollout blocker check for SaaS project `smart-return-system-saas`.
  - Branch: `develop-saas`
  - Latest observed HEAD: `64e6345 feat(saas/ui): show trial countdown and cancellation banners on billing`
- Vercel deployment:
  - Production URL remains `https://smart-return-system-saas.vercel.app`.
  - Deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` remains Ready.
  - No deployment was triggered.
- Vercel environment variables:
  - `vercel env ls` shows SaaS production values for Supabase, Gemini, admin, cron, feature flags, and `NEXT_PUBLIC_APP_URL`.
  - `SENTRY_DSN` is not present.
  - `NEXT_PUBLIC_SENTRY_DSN` is not present.
  - ECPay credentials are not present:
    - `ECPAY_MERCHANT_ID`
    - `ECPAY_HASH_KEY`
    - `ECPAY_HASH_IV`
    - `ECPAY_MODE`
  - No env values were changed or printed.
- Sentry/logging owner action:
  - Create or use the SaaS-only Sentry project, then add these to the SaaS Vercel project only:
    - `SENTRY_DSN`
    - `NEXT_PUBLIC_SENTRY_DSN` if browser-side events should be sent.
  - Do not commit DSN values to git.
- Beta/custom domain owner action:
  - Vercel currently reports zero custom domains under the account.
  - Choose the Beta domain, for example `beta.<owner-domain>`.
  - In Vercel, add the domain to project `smart-return-system-saas`.
  - At the DNS provider, add the record Vercel requests, usually a CNAME from `beta` to `cname.vercel-dns.com` for a subdomain.
  - After Vercel verifies the domain, update SaaS-only `NEXT_PUBLIC_APP_URL` to the chosen HTTPS URL and rerun rollout/predeploy gates.
  - No DNS or Vercel domain setting was changed in this review.
- Email provider owner action:
  - Current email queue worker remains dry-run only through `GET /api/cron/saas/email-queue?dryRun=true`.
  - No provider adapter is wired and no email is sent.
  - Before enabling real delivery, choose a provider such as Resend, Postmark, SendGrid, or SMTP.
  - Add SaaS-only provider env values, verify sender domain/SPF/DKIM/DMARC, run a sandbox delivery test, then explicitly authorize changing the worker from dry-run to delivery mode.
- Billing/ECPay owner action:
  - `ENABLE_BILLING=false` remains the correct Closed Manual Beta state.
  - Stage 2 requires SaaS-only values:
    - `BILLING_PROVIDER=ecpay`
    - `ECPAY_MERCHANT_ID`
    - `ECPAY_HASH_KEY`
    - `ECPAY_HASH_IV`
    - `ECPAY_MODE`
  - Keep billing disabled until ECPay sandbox validation, webhook verification, reconciliation, and owner approval are complete.
- Draft migrations:
  - `033_saas_platform_billing_operations.sql`: platform billing operation RPC for manual payment, suspend/resume, refund request, and audit logging; not applied.
  - `034_saas_notification_email_queue.sql`: notification delivery metadata and service-role-only `email_queue`; not applied.
  - `035_saas_onboarding_completion_rpc.sql`: onboarding completion RPC and audit log write; not applied.
  - `036_saas_platform_admin_roles.sql`: DB-backed platform admin role assignments and management RPC; not applied.
  - No migration was run in this review.
- Future deploy gate if owner explicitly authorizes another SaaS deploy:
  - `npm run safety:agent-boundary`
  - `npm run saas:verify-checkout`
  - `npm run saas:doctor`
  - `npm run saas:migration-plan:strict`
  - `npm run saas:schema-gate:strict`
  - `npm run saas:rollout-check:strict`
  - `npm run saas:predeploy`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:all`
  - `npm run build`

## 2026-05-26 Closed Manual Beta Production Deployment

- Production URL:
  - `https://smart-return-system-saas.vercel.app`
- Vercel project:
  - `smart-return-system-saas`
- Branch:
  - `develop-saas`
- Commit:
  - `99c4046 feat(saas): add Sentry runtime configuration`
- Deployment ID:
  - `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS`
- Vercel deployment status:
  - Ready
- Deployment aliases:
  - `https://smart-return-system-saas.vercel.app`
  - `https://smart-return-system-saas-kaweis-projects.vercel.app`
  - `https://smart-return-system-saas-kame5201314-crypto-kaweis-projects.vercel.app`
- Production URL smoke test:
  - `/`: 200
  - `/pricing`: 200
  - `/features/returns`: 200
  - `/features/ai`: 200
  - `/features/security`: 200
  - `/contact`: 200
  - `/signup`: 200
  - `/login`: 200
- Unauthenticated route protection smoke test:
  - `/returns`: 307 -> `/login`
  - `/pickup/scan`: 307 -> `/login`
  - `/analytics/ai-report`: 307 -> `/login`
  - `/settings/usage`: 307 -> `/login`
- Deployed state:
  - `NEXT_PUBLIC_APP_URL=https://smart-return-system-saas.vercel.app`
  - `SCHEMA_DRIFT_ALERT_WEBHOOK_URL` uses internal log-only alert handling.
  - `ENABLE_BILLING=false`
  - `ENABLE_PUBLIC_SIGNUP=false`
  - Email provider remains dry-run only.
  - No beta custom domain is configured.
  - Sentry SDK is wired, but Sentry DSN is not configured, so monitoring is not enabled.
  - No migration was run for this deployment.
- Beta customer onboarding item:
  - Owner handoff reports the first Beta customer `遇見未來` was provisioned with org/account/login for `kawei88888@gmail.com`.
- Rollback posture:
  - Keep Vercel rollback readiness for at least 24 hours after launch.
  - Use Vercel rollback first for production incidents; do not use `git reset --hard` or force push as incident response.

## 2026-05-25 SaaS Coordination Snapshot

- Latest known Codex commit before this documentation refresh:
  - `b3f045e fix(saas): harden manual beta consistency gate`
- Completed backend/readiness items:
  - Manual Beta backend/readiness/predeploy consistency gate is complete locally.
  - `email_queue` dry-run worker and `CRON_SECRET`-gated route are complete.
  - AI analytics predeploy consistency fallback is complete for SaaS schemas without optional legacy Shopee date columns such as `dispute_deadline` or `processed_at`.
- Next Claude UI scope:
  - Public marketing/legal RWD inspection for `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/legal/terms`, `/legal/privacy`, `/legal/refund`, and `/signup`.
  - UI-only: no signup persistence, billing behavior, API, server action, migration, env, or backend contract changes.
- External blockers before public paid rollout:
  - Sentry/logging DSN.
  - Billing/ECPay credentials and explicit `ENABLE_BILLING` rollout.
  - Final custom domain or Vercel Preview SSO/bypass decision.
  - Explicit SaaS production deploy authorization.
- Safety boundary for this refresh:
  - No deployment, no migration, no env/secret edit, no billing/provider enablement, no master change, and no production/internal Supabase action.

## Completed

- Created a separate local SaaS checkout:
  - `D:\AI專案\AI退貨系統商業版_2026.5.16`
- Confirmed the SaaS checkout is on:
  - `develop-saas`
- Created and linked a separate SaaS Vercel Project:
  - Project name: `smart-return-system-saas`
  - Project ID: `prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`
  - Owner: `KAWEI's projects`
  - Git repository: `https://github.com/kame5201314-crypto/smart-return-system`
- Confirmed the live/internal checkout was not relinked:
  - Live project name remains `smart-return-system`
  - Live project ID remains `prj_aaRiMeML9D4G7U71QRDZYVonLH8h`
- Added `.vercel/` to `.gitignore` so local project links are not committed.
- Added `.env.saas.example` for SaaS-only environment setup.
- Added non-secret SaaS Vercel environment variables to production, preview, and development:
  - `APP_MODE=saas`
  - `SAAS_ALLOWED_BRANCH=develop-saas`
  - `BRANCH_POLICY_STRICT=true`
  - `GEMINI_TEXT_MODEL=gemini-2.5-flash-lite`
  - `GEMINI_MAX_OUTPUT_TOKENS=1200`
  - `ENABLE_IMAGE_AI=false`
- Added local SaaS safety scripts:
  - `npm run saas:verify-checkout`
  - `npm run saas:verify-env`
  - `npm run saas:build`
  - `npm run saas:doctor`
  - `npm run saas:doctor:strict`
  - `npm run saas:rollout-check`
  - `npm run saas:rollout-check:strict`
  - `npm run saas:predeploy`
- Hardened the Supabase project predeploy check so `APP_MODE=saas` uses `SAAS_SUPABASE_PROJECT_ID` before falling back to the internal project id.
- Replaced the root `README.md` with SaaS commercial checkout guidance and explicitly documented that return AI analysis is text-only.
- Added `.github/workflows/saas-safety.yml` to run SaaS branch and checkout safety checks on `develop-saas`.
- Updated `scripts/saas/verify-saas-checkout.mjs` so CI can detect the branch from GitHub/Vercel environment variables.
- Expanded `.github/workflows/saas-safety.yml` so every `develop-saas` push runs `lint`, `typecheck`, `test:all`, and `build`.
- Ran local verification in the SaaS checkout:
  - `npm ci`: passed
  - `npm run lint`: passed with existing warnings only
  - `npm run typecheck`: passed
  - `npm run test:all`: passed
  - `npm run build`: passed without live/internal env values

## 2026-05-22 SaaS Readiness Update

- SaaS migration readiness is now confirmed:
  - `npm run saas:migration-plan:strict`: passed.
  - Target project: `auyznbwtjvemyamujmgt`.
  - Chain end: `032_saas_invite_creation_rpc.sql`.
- SaaS schema readiness is now confirmed:
  - `npm run saas:schema-gate:strict`: passed.
  - Checked 22 tables and 81 columns.
- SaaS doctor strict is still intentionally blocked by AI credential readiness:
  - `npm run saas:doctor:strict`: 110 pass, 1 warn, 0 fail.
  - The only warning is `GEMINI_API_KEY` missing or placeholder.
- Invite acceptance UI was wired and pushed:
  - Commit: `6ec9499 feat(saas/ui): wire invite acceptance page`
  - `/invite/[token]` now uses `loadInviteAcceptanceView(token)`.
  - `components/saas/invite-accept-panel.tsx` handles accept, login, email mismatch, already-member, expired, revoked, empty/gated/error paths.
  - No invite email sending, billing provider, deployment, env/secret, or production project change was performed.
- SaaS rollout readiness gate was added:
  - `scripts/saas/check-rollout-readiness.mjs`
  - `npm run saas:rollout-check`
  - `npm run saas:rollout-check:strict`
  - `npm run saas:predeploy` now includes the non-strict rollout check.
  - The check validates SaaS project safety, Gemini key readiness, `NEXT_PUBLIC_APP_URL` domain readiness, Sentry/logging status, AI safety flags, and billing credentials when billing is enabled.
  - It is read-only and prints `No external changes were made by this check.`

## 2026-05-23 SaaS Pre-Launch Recheck

- Preflight passed in the SaaS commercial checkout:
  - Path: `D:\AI專案\AI退貨系統商業版_2026.5.16`
  - Branch: `develop-saas`
  - Remote: `origin` -> `https://github.com/kame5201314-crypto/smart-return-system.git`
  - `npm run safety:agent-boundary`: passed.
- Current strict readiness results:
  - `npm run saas:doctor:strict`: 113 pass, 0 warn, 0 fail.
  - `npm run saas:migration-plan:strict`: 12 pass, 0 warn, 0 fail.
  - `npm run saas:schema-gate:strict`: passed, 22 tables and 81 columns checked.
  - `npm run saas:rollout-check:strict`: initially 21 pass, 2 warn, 0 fail before the admin password gate was added.
- Follow-up security gate added:
  - `npm run saas:rollout-check:strict` now requires `ADMIN_USERNAME` and a non-placeholder `ADMIN_PASSWORD` with at least 12 characters.
  - Rotate `ADMIN_PASSWORD` in the SaaS Vercel project and local `.env.saas.local` before public rollout.
- Remaining rollout decisions before public launch:
  - Rotate admin login credentials if the rollout gate reports `env:ADMIN_PASSWORD`.
  - Add Sentry/logging DSN or accept manual log-only monitoring for a closed Beta.
  - Keep `ENABLE_BILLING=false` for manual Beta, or configure a billing provider before paid self-serve launch.
  - Confirm the final public domain and update `NEXT_PUBLIC_APP_URL` before opening public signup or sending invites.
  - Deploy the SaaS Vercel project only after explicit owner approval.

## 2026-05-19 SaaS Audit

- Preflight passed in the SaaS checkout:
  - Path: `D:\AI專案\AI退貨系統商業版_2026.5.16`
  - Branch: `develop-saas`
  - Working tree: clean before changes
  - `npm run safety:agent-boundary`: passed
- GitHub Branch Protection check:
  - `gh api repos/kame5201314-crypto/smart-return-system/branches/master/protection`
  - Result: `Branch not protected`
  - Action taken: no platform change was made. Manual setup is still required.
- SaaS Vercel checkout check:
  - `npm run saas:verify-checkout`: passed
  - Linked project: `smart-return-system-saas`
  - Project ID: `prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`
  - Live/internal Vercel project was not touched.
- SaaS readiness check:
  - `npm run saas:doctor`: 23 pass, 11 warn, 0 fail
  - `.env.saas.local`: missing
  - Supabase CLI: not installed; required only when migration operations are authorized.
- `npm run saas:doctor` now checks the commercial foundation:
  - SaaS plan definitions are present and match the Basic/Growth/Enterprise baseline.
  - AI quota source is `org.plan` configuration, not `APP_MODE`.
  - Required feature flags are present.
  - Billing provider stays disabled until credentials are configured.
  - SaaS commercial foundation migration exists.
- AI cost safety check:
  - SaaS env default uses `GEMINI_TEXT_MODEL=gemini-2.5-flash-lite`.
  - Return AI prompt is text-only and explicitly says no images are provided.
  - `ENABLE_IMAGE_AI=false` is the SaaS default and is checked by `npm run saas:doctor`.
  - AI usage event recording exists in `supabase/migrations/022_ai_usage_events.sql`.
  - AI report cache/fingerprint reuse exists in `lib/utils/ai-analysis-cache.ts`.
- SaaS commercial foundation added locally:
  - Plan definitions: Basic, Growth, Enterprise in `lib/config/saas-plans.ts`.
  - Feature flag definitions: public signup, billing, subscription plan, AI usage limit, advanced analytics, multi-tenant admin, image AI in `lib/config/feature-flags.ts`.
  - Billing env placeholders expanded for ECPay, Stripe, and TapPay in `.env.saas.example`.
  - SaaS-only migration draft added in `supabase/migrations/023_saas_commercial_foundation.sql`.
  - SaaS commercial v2 migration draft added in `supabase/migrations/024_saas_commercial_v2.sql` for member roles, invites, invoices, and audit logs. It has not been applied to any database.
  - SaaS tenant isolation audit added in `docs/SAAS_TENANT_ISOLATION_AUDIT.md`.
  - SaaS tenant org_id/RLS migration draft added in `supabase/migrations/025_attach_org_id_to_business_tables.sql`. It has not been applied to any database.
  - SaaS org context guard added in `lib/saas/org-context.ts` to resolve authenticated user -> org -> plan -> feature flags without using service-role membership lookup.
  - SaaS commercial website pages added for `/`, `/pricing`, `/features/*`, `/signup`, `/contact`, `/invite/[token]`, and `/legal/*`.
  - SaaS in-app settings skeleton added for `/settings`, `/settings/billing`, `/settings/usage`, and `/settings/team`.

## 2026-05-20 SaaS Platform Update

- SaaS Supabase Project was created for the commercial checkout:
  - Project ref: `auyznbwtjvemyamujmgt`
  - URL domain: `auyznbwtjvemyamujmgt.supabase.co`
  - The internal/live Supabase project refs `fdzfnenizyppxglypden` and `sntbrntwztkllwkutooi` were not used.
- Local SaaS env file was created as an ignored local file:
  - `.env.saas.local`
  - Supabase URL, anon key, service role key, SaaS project id, and generated local-only secrets are set locally.
  - `GEMINI_API_KEY` still requires a real value before strict AI readiness checks can pass.
- Supabase CLI is available locally:
  - `2.100.1`
- GitHub Branch Protection for `master` was enabled:
  - Required check: `test-and-predeploy-gates`
  - Branch must be up to date before merge.
  - PR review required with 1 approval.
  - Admin enforcement enabled.
  - Force pushes and deletions disabled.
- P0 runtime org isolation was added for return actions, AI analyze API, and admin export routes.
- SaaS platform admin skeleton pages were added:
  - `/internal/orgs`
  - `/internal/orgs/[id]`
  - `/internal/billing/events`
  - These pages currently use static demo data and do not read or write Supabase.
- SaaS platform admin guard was added:
  - `lib/saas/platform-admin.ts`
  - Requires admin auth and the `multi_tenant_admin` feature flag for live internal operations.
  - The guard does not use service-role access directly; service-role data access must stay inside explicit server routes.
- SaaS platform admin API route foundation was added:
  - `lib/saas/platform-admin-data.ts`
  - `/api/internal/saas/orgs`
  - `/api/internal/saas/orgs/[id]`
  - `/api/internal/saas/billing/events`
  - Routes are gated by `requirePlatformAdminAccess()` and remain closed while `ENABLE_MULTI_TENANT_ADMIN=false`.
- SaaS public route allowlist was added:
  - `lib/auth/public-routes.ts`
  - Keeps `/`, `/pricing`, `/features/*`, `/signup`, `/contact`, `/invite/*`, `/legal/*`, `/portal/*`, and `/login` reachable before login.
  - Keeps app/admin/internal routes protected by middleware.
- SaaS public signup gate was added:
  - `lib/saas/public-signup.ts`
  - `/signup` now renders closed Beta vs public signup copy from `ENABLE_PUBLIC_SIGNUP`.
  - Public signup still does not create an org until SaaS DB migrations and server-side signup flow are approved.
- SaaS public signup API safety foundation was added:
  - `lib/saas/signup-request.ts`
  - `/api/saas/signup`
  - The API is closed by `ENABLE_PUBLIC_SIGNUP=false` by default.
  - When the flag is enabled but persistence is not wired, the API returns `not_configured` instead of creating an org.
  - MVP public signup is Basic-only until subscription creation and billing are wired.
- SaaS public website copy was repaired for readable Traditional Chinese across:
  - `/`, `/pricing`, `/features/*`, `/signup`, `/contact`, `/invite/[token]`, `/legal/*`
  - shared marketing navigation, footer, pricing data, public signup state, and dashboard hero mockup.

## 2026-05-21 SaaS Backend Foundation Update

- Platform admin API DTO wiring was added:
  - `lib/saas/ui-backend-contracts.ts`
  - `/api/internal/saas/orgs`
  - `/api/internal/saas/orgs/[id]`
  - `/api/internal/saas/billing/events`
  - These routes remain gated by `ENABLE_MULTI_TENANT_ADMIN=false` by default.
- AI usage hard limit was added:
  - `lib/saas/ai-quota.ts`
  - `/api/v1/ai/analyze` now checks monthly non-cached successful `return_ai_analysis` usage before Gemini calls.
  - Quota source is `org.plan`, not `APP_MODE`.
  - Cache hits are still allowed and do not consume quota.
- SaaS subscription access policy was hardened:
  - `lib/saas/subscription-access.ts`
  - `getOrgContext({ requirements: { writable: true } })` now uses the centralized subscription access policy.
  - `past_due` is read-only for write, AI, and export guards, matching the product spec; users can still log in, view data, and manage billing.
  - `suspended` and `cancelled` remain read-only for data operations.
- SaaS subscription lifecycle timing policy was added:
  - `lib/saas/subscription-lifecycle.ts`
  - Defines local timing rules for `trial_end` expiration, `cancel_at_period_end`, `past_due` 7-day grace, and `suspended` 30-day retention.
  - This is a pure resolver for future billing cron/webhook code; it does not write to Supabase or expose a route.
- SaaS export access guards were hardened:
  - `/api/v1/admin/returns/export`
  - `/api/v1/admin/shopee-returns/export`
  - `/api/v1/admin/pickup/export`
  - These routes now require `getOrgContext({ requirements: { exportable: true } })`.
  - `past_due`, `suspended`, and `cancelled` organizations cannot export data.
- SaaS team seat limit policy was added:
  - `lib/saas/team-limits.ts`
  - `buildTeamSettingsView()` now reserves seats for active/non-disabled members plus pending invites.
  - When the plan seat limit is full, team DTOs force `actions.canInvite=false`.
  - No live team invite route was exposed and no DB query or migration was added.
- SaaS invite status policy was added:
  - `lib/saas/invite-policy.ts`
  - Centralizes invite status resolution for `pending`, `accepted`, `expired`, and `revoked`.
  - Centralizes acceptable invite roles as `admin`, `staff`, and `viewer`; `owner` invites remain rejected.
  - Settings team and usage repositories now use this policy before live invite routes are exposed.
  - No live invite route was exposed, no invite email was sent, and no migration was applied.
- SaaS invite token data repository foundation was added:
  - `lib/saas/invite-token-data.ts`
  - Builds the future `/invite/[token]` data lookup from `organization_invites` plus organization context.
  - Uses the shared invite policy to mark pending, accepted, and expired invites before the route is wired.
  - No live invite route was exposed, no invite was accepted, no invite email was sent, and no migration was applied.
- SaaS invite acceptance service foundation was added:
  - `lib/saas/invite-acceptance.ts`
  - Validates invite token, signed-in user email, acceptable role, and invite lifecycle status before future membership writes.
  - Adds the local repository wrapper for future `accept_organization_invite` RPC calls.
  - Adds `supabase/migrations/031_saas_invite_acceptance_rpc.sql` as an atomic invite acceptance RPC draft.
  - No live invite route was exposed, no Supabase client was created, no invite was accepted, no invite email was sent, and no migration was applied.
- SaaS invite creation service foundation was added:
  - `lib/saas/invite-creation.ts`
  - Validates invite email, acceptable role, plan seat availability, token, and expiration before future invite writes.
  - Adds the local repository wrapper for future `create_organization_invite` RPC calls.
  - Adds `supabase/migrations/032_saas_invite_creation_rpc.sql` as an atomic invite creation RPC draft.
  - No live invite route was exposed, no Supabase client was created, no invite email was sent, and no migration was applied.
- SaaS team invite API foundation was added:
  - `lib/saas/team-invite-route.ts`
  - `POST /api/saas/team/invites`
  - Requires authenticated SaaS org context, owner/admin role, and writable subscription status.
  - Counts active/non-disabled members plus pending invites before calling the invite creation service.
  - No UI file was changed, no invite email was sent, no migration was applied, and no platform setting was changed.
- SaaS return usage soft-limit policy was added:
  - `lib/saas/return-usage-policy.ts`
  - `buildUsageSettingsView()` now uses the centralized return soft-limit resolver for `returns_80` and `returns_100` warnings.
  - Return volume remains a soft limit: warnings do not block return creation or daily operations.
  - A future month-end job can use the resolver to mark upgrade suggestions after two consecutive over-limit months.
  - No live route, DB query, migration, or billing charge was added.
- Billing foundation was added without enabling real billing:
  - `lib/saas/billing.ts`
  - `/api/billing/ecpay/webhook`
  - ECPay webhook is closed while `ENABLE_BILLING=false`.
  - If billing is enabled, the route still requires `BILLING_PROVIDER=ecpay`, complete ECPay credentials, and CheckMacValue verification before writing `billing_events`.
  - Duplicate provider events are treated idempotently through the `billing_events` unique key.
  - No ECPay credentials were added, no payment API was called, and no migration was applied.
- Public signup request persistence was wired without opening public signup:
  - `lib/saas/signup-request-repository.ts`
  - `/api/saas/signup`
  - `supabase/migrations/026_saas_public_signup_requests.sql`
  - `ENABLE_PUBLIC_SIGNUP=false` still blocks validation and persistence before any DB client is created.
  - If the flag is explicitly enabled after migrations, valid Basic-only signup requests persist to `signup_requests`.
  - Signup request persistence does not create organizations or subscriptions yet.
  - No migration was applied.
- SaaS schema readiness gate was added without applying migrations:
  - `scripts/saas/check-saas-schema-readiness.mjs`
  - `npm run saas:schema-gate`
  - `npm run saas:schema-gate:strict`
  - The gate checks 023-028 foundation tables, commercial v2 columns, and tenant `org_id` columns required by platform admin live data, billing events, signup requests, AI usage, and business records.
  - The checked commercial v2 columns include organization onboarding/billing/upgrade suggestion fields, subscription period/provider fields, invite token fields, invoice fields, and audit metadata.
  - Non-strict mode reports readiness without blocking local development.
  - Strict mode should remain blocked until SaaS migrations are approved and applied.
  - No Supabase data was changed.
- SaaS migration apply plan check was added without applying migrations:
  - `scripts/saas/check-migration-plan.mjs`
  - `npm run saas:migration-plan`
  - `npm run saas:migration-plan:strict`
  - The check validates `APP_MODE=saas`, the expected SaaS Supabase project ref, forbidden internal/live project refs, `SUPABASE_DB_PASSWORD` readiness, and the full local migration chain ending at `036`.
  - Strict mode should remain blocked until `SUPABASE_DB_PASSWORD` is available.
  - No Supabase data was changed.
- Platform admin read model migration draft was added without applying migrations:
  - `supabase/migrations/027_saas_platform_admin_read_model.sql`
  - Adds `organizations.owner_email` and `organizations.member_count`, matching the platform admin API read columns.
  - Adds `organization_members.email` and `organization_members.status`, matching the platform admin detail API read columns.
  - Adds a trigger to refresh `member_count` from `organization_members`.
  - No Supabase data was changed.
- Manual Beta organization provisioning backend foundation was added without applying migrations:
  - `lib/saas/platform-admin-provisioning.ts`
  - `POST /api/internal/saas/orgs`
  - `supabase/migrations/028_saas_manual_beta_org_provisioning.sql`
  - The route remains closed while `ENABLE_MULTI_TENANT_ADMIN=false`.
  - The draft RPC creates the organization, optional owner membership, trialing manual subscription, and audit log in one SQL function.
  - No Supabase data was changed.
- Billing event status schema draft was added without applying migrations:
  - `supabase/migrations/029_saas_billing_event_status.sql`
  - Adds `billing_events.status` with `received`, `processed`, `failed`, and `ignored` values to match the platform admin UI/backend contract.
  - Backend billing event records now default to `status='received'`.
  - No Supabase data was changed and billing remains disabled by `ENABLE_BILLING=false`.
- Historical repository milestone: invoice status schema and DTO alignment was
  initially added as a draft without applying migrations:
  - `supabase/migrations/030_saas_invoice_status_alignment.sql`
  - Aligns `invoices.status` and billing settings DTOs on `draft`, `issued`, `paid`, `failed`, and `void`.
  - At that historical milestone no Supabase data was changed and no billing
    provider was enabled. Current state: `030` was later applied as part of the
    complete migration chain through `032`; do not reapply it.
- SaaS settings billing data repository foundation was added without exposing live routes:
  - `lib/saas/settings-billing-data.ts`
  - Builds the future `/settings/billing` DTO input from `organizations`, `subscriptions`, and latest `invoices` rows.
  - Keeps the live route unwired until SaaS migrations and schema readiness are approved.
  - No UI file was changed, no Supabase query was run, no migration was applied, and no billing provider was enabled.
- SaaS settings usage data repository foundation was added without exposing live routes:
  - `lib/saas/settings-usage-data.ts`
  - Builds the future `/settings/usage` DTO input from `organizations`, `organization_members`, `organization_invites`, `return_requests`, and `ai_usage_events` rows.
  - Uses a UTC month window matching AI quota counting and counts only successful non-cached return AI usage.
  - No UI file was changed, no Supabase query was run, no migration was applied, and no billing provider was enabled.
- SaaS settings team data repository foundation was added without exposing live routes:
  - `lib/saas/settings-team-data.ts`
  - Builds the future `/settings/team` DTO input from `organizations`, `organization_members`, and `organization_invites` rows.
  - Pending invite status is derived locally from invite timestamps so pending invites reserve seats before live invite routes are exposed.
  - No UI file was changed, no Supabase query was run, no migration was applied, and no invite email was sent.
- SaaS settings live data server loaders were added for Claude UI handoff:
  - `lib/saas/settings-live-data.ts`
  - Exposes `loadBillingSettingsView()`, `loadUsageSettingsView()`, and `loadTeamSettingsView()`.
  - Composes `getOrgContext()`, the authenticated server Supabase client/RLS, settings repositories, and UI DTO builders.
  - Returns explicit `ready`, `empty`, `gated`, or `error` states and does not serve mock data.
  - No UI file was changed, no migration was applied, and no platform setting was changed.
- SaaS platform admin page-level live data loaders were added for Claude UI handoff:
  - `lib/saas/platform-admin-live-data.ts`
  - Exposes `loadPlatformOrganizationsView()`, `loadPlatformOrganizationDetailView(orgId)`, and `loadPlatformBillingEventsView()`.
  - Calls `requirePlatformAdminAccess()` before creating the service-role platform admin repository.
  - Returns explicit `ready`, `empty`, `gated`, or `error` states for `/internal/orgs`, `/internal/orgs/[id]`, and `/internal/billing/events`.
  - UI pages should consume these loaders instead of calling API route handlers directly.
  - No UI file was changed, no migration was applied, no env/secret was changed, and no platform setting was changed.
- SaaS invite acceptance live data and API route were added for Claude UI handoff:
  - `lib/saas/invite-acceptance-live-data.ts`
  - `lib/saas/invite-accept-route.ts`
  - `app/api/saas/invite/accept/route.ts`
  - Exposes `loadInviteAcceptanceView(token)` for `/invite/[token]`.
  - Exposes `POST /api/saas/invite/accept` and reuses `acceptSaaSInvite()` plus the already-applied `accept_organization_invite` RPC wrapper.
  - The loader returns `ready`, `empty`, `gated`, or `error` states and includes `viewer.state` values for can-accept, login-required, email-mismatch, and already-member UI paths.
  - No UI file was changed, no email was sent, no migration was applied, no env/secret was changed, and no platform setting was changed.
- ECPay webhook CheckMacValue verification was added locally:
  - Default `/api/billing/ecpay/webhook` processing now verifies the incoming `CheckMacValue` before recording a billing event.
  - Tests include ECPay's published payment-notification checksum example.
  - Billing remains closed by `ENABLE_BILLING=false`.
  - No ECPay credentials were added and no payment API was called.

## Verification Notes

- The post-rollout repository hardening run completed `npm ci`, lint, typecheck,
  `test:all`, and the 68-page Production build. `test:all` now includes backend,
  unit (97 files / 538 tests), UI (5 files / 8 tests), E2E (3 files / 4 tests),
  and integration (2 files / 5 tests).
- The full dependency audit is 1 low / 5 moderate / 0 high / 0 critical;
  production dependencies are 1 low / 4 moderate / 0 high / 0 critical.
- This clean clone does not contain `.env.saas.local`, so env-backed strict
  checks correctly refuse to run. No placeholder or Production secret was
  created. Static migration tests and encoding checks pass.
- Do not run `npm audit fix --force` automatically; the remaining production
  findings require breaking dependency changes and should be handled as a
  separately reviewed upgrade.

## Not Completed Yet

These remain intentionally blocked on owner decisions, private credentials, or
separate external-change authorization:

- Final company/legal/tax/invoice/refund/retention details before collecting
  payment from customers.
- Resend account, verified sender domain/address, `RESEND_API_KEY`, delivery
  scope, migration `034`, and explicit email-provider/delivery authorization.
- ECPay merchant credentials, sandbox/Production decision, lifecycle and
  reconciliation validation, and explicit `ENABLE_BILLING=true` authorization.
- Public-signup posture and provisioning beyond the live Google self-service
  trial path. `ENABLE_PUBLIC_SIGNUP=false` does not disable the separately
  enabled Google trial flow.
- Optional per-email platform operator roles (`PLATFORM_ADMIN_ROLES`) and
  migration `036` if DB-backed assignments are chosen. Current Production
  platform admin access is enabled and merchant-denial QA has passed.
- Custom-domain purchase/DNS only if the owner later chooses to replace the
  working Vercel URL. It is intentionally deferred, not a current blocker.
- Vercel Preview SSO/protection policy if external Preview testers are added.
- A separately authorized deployment if repository hardening after `a29f725`
  should go live. Do not infer deployment permission from this document.

Production Sentry DSNs and Gemini are already configured; do not replace or
rotate them without a separate explicit request. Applied migrations `030`,
`033`, `035`, and `037`–`043` must not be rerun.

## Historical: 2026-07-14 Public Lead Capture Activation

Repository-side implementation is complete through the public plan-aware form,
lead-only API, platform operations queue, and manual payment control.

- Runtime commits: `7838530`, `e9ff6c3`, `6e4e5a6`, `24ac804`, `e7695e8`.
- Migration `039_saas_public_lead_capture.sql` was applied only to SaaS project
  `auyznbwtjvemyamujmgt` on 2026-07-14 after explicit owner authorization.
- Remote history records `039` as applied; the five new columns and six lead
  constraints were verified. Migrations `034` and `036` remain unapplied.
- `ENABLE_PUBLIC_LEAD_CAPTURE=true` is configured only for Vercel Production;
  it remains independently scoped from `ENABLE_PUBLIC_SIGNUP`. It was activated
  in deployment `dpl_J7UaqC7ag1QQ1dTEcTp8CrxRaeR2` and remains active in the
  current Ready deployment `dpl_7ZznosE1KVLdB4oj1sFFCwDAwJtC`.
- The existing LINE/copy/Email Manual Beta paths remain usable without the flag.
- The lead API never creates an account, organization, subscription, payment, or
  email delivery job.
- `/internal/leads` is active for authorized platform operators and continues
  to redirect unauthenticated visitors to the platform login.
- Manual payment recording uses the already-applied platform billing operation
  RPC and does not enable ECPay or automatic billing.

Activation completed on 2026-07-14. No disposable lead row was persisted during
smoke testing; the invalid payload intentionally stopped at validation.

Do not combine these steps with `ENABLE_PUBLIC_SIGNUP`, billing, email delivery,
or provider activation.

## Required Values for Future External Rollouts

Use an ignored `.env.saas.local` only after it is securely supplied with real
SaaS-only values. If it is absent, stop; do not copy placeholders from the
example merely to bypass strict checks.

Required before migration/deployment:

- `SAAS_VERCEL_PROJECT_NAME`
- `SAAS_VERCEL_PROJECT_ID`
- `INTERNAL_VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_ID_EXPECTED`
- `SAAS_SUPABASE_PROJECT_ID`
- `INTERNAL_SUPABASE_PROJECT_ID`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_SESSION_SECRET`
- `CRON_SECRET`
- `SCHEMA_DRIFT_ALERT_TOKEN`

Optional before billing launch:

- `NEXT_PUBLIC_CONTACT_EMAIL`
- `ENABLE_EMAIL_DELIVERY`
- `EMAIL_PROVIDER`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `BILLING_PROVIDER`
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_MODE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `TAPPAY_PARTNER_KEY`
- `TAPPAY_MERCHANT_ID`
- `TAPPAY_APP_ID`
- `TAPPAY_APP_KEY`
- `TAPPAY_MODE`

Current Production feature-flag posture (names/booleans only; no secrets):

- `ENABLE_PUBLIC_SIGNUP=false`
- `ENABLE_BILLING=false`
- `ENABLE_SUBSCRIPTION_PLAN=false`
- `ENABLE_AI_USAGE_LIMIT=true`
- `ENABLE_ADVANCED_ANALYTICS=false`
- `ENABLE_PUBLIC_LEAD_CAPTURE=true`
- `ENABLE_GOOGLE_AUTH=true`
- `ENABLE_GOOGLE_TRIAL_SIGNUP=true`
- `ENABLE_TRIAL_EXPIRY_CRON=true`
- `ENABLE_MULTI_TENANT_ADMIN=true`
- `ENABLE_IMAGE_AI=false`

## SaaS Values Still Needed From Owner

- Company/legal/tax/invoice/refund/retention decisions before paid service.
- Resend credentials, verified sender details, and delivery authorization if
  email delivery is selected.
- Billing/ECPay credentials and rollout decision when Stage 2 starts.
- Public-signup provisioning decision beyond the live Google trial path.
- Optional platform-role mapping and custom-domain details only if selected.

Do not use the internal/live Supabase project for any SaaS values.

## Safety Rules

- Do not run `vercel link` in the live/internal checkout unless explicitly repairing the live project.
- Do not point the SaaS Vercel Project to the live/internal Supabase Project.
- Do not import live/internal company data into the SaaS Supabase Project.
- Do not commit `.env.saas.local`, `.vercel/`, Vercel pulled env files, or any secret values.
- Deploy SaaS only from `develop-saas`.
- Keep `master` reserved for the live/internal product and critical fixes.

## Next Safe Execution Steps

For any future external rollout, first obtain an explicit, narrowly scoped owner
authorization and the real values required for that one action:

1. Confirm a clean, synchronized `develop-saas` checkout and run
   `npm run safety:agent-boundary`.
2. Use an existing ignored `.env.saas.local` only if it is securely supplied;
   never create placeholders or print/commit secrets.
3. Verify remote migration history before planning DB work. Never rerun applied
   migrations `030`, `033`, `035`, or `037`–`043`.
4. Run checkout, env, doctor, migration-plan, schema, and rollout strict gates.
5. Run lint, typecheck, `test:all`, and the Production build.
6. Execute only the specifically authorized deploy/migration/env/provider
   action; do not bundle unrelated external changes.
7. Smoke test the affected customer/platform paths and record the exact runtime,
   deployment, migration, and unchanged safety boundaries.

If you need to run the individual checks:

1. Run `node scripts/verify-env.mjs`.
2. Run `npm run saas:migration-plan:strict`.
3. Run `npm run saas:schema-gate:strict`.
4. Run `npm run saas:rollout-check:strict`.
5. Run `npm run lint`.
6. Run `npm run typecheck`.
7. Run `npm run test:all`.
8. Run `npm run build`.
9. Deploy the SaaS Vercel Project only after explicit approval.
10. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, invite acceptance, team invites, billing/settings pages, and export.

## 2026-07-15 Expired Workspace And OAuth Recovery Production Deployment

- The owner explicitly authorized completing the SaaS Production deployment
  from `develop-saas`. Preflight confirmed a clean worktree with local HEAD and
  `origin/develop-saas` both at `a29f725652e737caf66493d300d08e84054f006c`.
- This runtime includes the expired-workspace action lockout, Google OAuth
  expired-flow recovery copy and retry entry, Traditional Chinese
  billing-disabled guidance, regression coverage, and rollout documentation.
- The five changes contain no migration diff. Migrations `040`–`043` remain
  already applied only to SaaS project `auyznbwtjvemyamujmgt` and were not
  rerun. Unrelated drafts `034` and `036` remain unchanged.
- Existing Production env was pulled only into an ignored temporary
  `.env.saas.local` for verification, without displaying or committing values,
  and the file was deleted after deployment. No Vercel env value or Supabase
  setting was changed because this runtime adds no new configuration contract.
- `npm run saas:predeploy` passed, including env verification, rollout and
  schema gates, lint, typecheck, 16 backend tests, 526 unit tests, 4 E2E tests,
  5 integration tests, and the 68-page Production build.
- Vercel Production deployment
  `dpl_7ZznosE1KVLdB4oj1sFFCwDAwJtC` is Ready. Its deployment URL is
  `https://smart-return-system-saas-pj86v47yw-kaweis-projects.vercel.app`, and
  the stable alias `https://smart-return-system-saas.vercel.app` resolves to it.
- Vercel metadata confirms source commit `a29f725` on `develop-saas`.
- Post-deploy smoke passed 16/16. Browser QA confirmed the visible message
  `登入流程已失效，請重新使用 Google 登入`, a unique retry link to
  `/auth/google?next=%2Fanalytics`, and no browser console errors. A cookie-free
  redirect probe confirmed the app routes through the SaaS Supabase project to
  `accounts.google.com` without completing a user login or creating test data.
- Deployment error-log scan returned zero errors. Google Auth, Google trial
  signup, trial-expiry cron, and AI usage limits remain enabled; Billing remains
  disabled and no Email provider was enabled.
