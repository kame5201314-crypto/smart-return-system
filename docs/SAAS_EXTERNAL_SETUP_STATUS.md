# SaaS External Setup Status

Last updated: 2026-05-28

This file tracks external SaaS setup work that must stay separate from the live internal project.

## Current Status Snapshot

- Dedicated SaaS Supabase project is `auyznbwtjvemyamujmgt` (`auyznbwtjvemyamujmgt.supabase.co`).
- The internal/live Supabase project refs `fdzfnenizyppxglypden` and `sntbrntwztkllwkutooi` are not used.
- Full SaaS migration chain through `032_saas_invite_creation_rpc.sql` has been applied to the SaaS project.
- Draft migration `033_saas_platform_billing_operations.sql` exists for platform billing operations but has not been applied.
- Draft migration `034_saas_notification_email_queue.sql` exists for notification/email queue storage but has not been applied.
- Draft migration `035_saas_onboarding_completion_rpc.sql` exists for onboarding completion audit writes but has not been applied.
- Draft migration `036_saas_platform_admin_roles.sql` exists for DB-backed platform admin role assignments but has not been applied.
- Billing event retry is currently dry-run only; provider replay remains disabled pending ECPay sandbox validation and audit-log retry wiring.
- Notification backend foundation is queue-only; no email provider is wired and no email is sent.
- Email queue worker is dry-run only through `GET /api/cron/saas/email-queue?dryRun=true`; no provider call or queue mutation is enabled.
- Onboarding backend foundation now includes read-only `loadSaaSOnboardingView()` plus guarded `POST /api/saas/onboarding/complete` for future Claude UI wiring; migration `035` is still not applied, so production UI must not enable completion writes yet.
- Platform admin role policy now supports `owner`, `support`, and `billing`; optional `PLATFORM_ADMIN_ROLES` mapping is not configured by default.
- Platform admin identity separation now requires the signed internal admin session, explicit `ADMIN_EMAIL` / email-style `ADMIN_USERNAME`, or valid `PLATFORM_ADMIN_ROLES`. Tenant/profile `users.role='admin'` is no longer a platform admin grant. Proxy-level `/login` redirects now use the same explicit platform admin identity policy for already-authenticated users, and authenticated merchants who visit `/admin` are sent back to `/analytics`.
- Platform admin role management backend foundation now includes owner-gated `GET/POST /api/internal/saas/platform-admins` plus a repository/RPC contract for future UI. DB-backed role assignments still require migration `036` to be explicitly applied before UI exposure.
- Platform tenant preview backend foundation now includes guarded start/get/clear preview routes, a signed one-hour cookie for future UI banners, and audit-log writes for preview start/clear events. It is not wired into tenant org context or write permissions.
- Platform tenant preview UI is now wired for platform admins through the org-detail start button, tenant preview banner, and exit button. This remains read-only visual context only; it is not full impersonation and does not change tenant data scope or write permissions.
- Latest Claude UI handoffs through `a63cfe2` are recorded in `agent-shared/**`: platform risk label localization, settings header consistency, billing trial/cancel banners, onboarding next-step focus card, marketing mobile navigation, login page SaaS branding, `/internal` loading skeleton, and `/not-found` SaaS branding.
- `npm run saas:migration-plan:strict` passes.
- `npm run saas:schema-gate:strict` passes.
- `npm run saas:doctor:strict` passes with default rollout flags; if local platform admin preview is enabled, the check reports a warning that `ENABLE_MULTI_TENANT_ADMIN` is not at its closed default.
- `npm run saas:rollout-check:strict` passes for the local Manual Beta environment and also checks admin login credential readiness.
- Launch security hardening now includes Next.js security headers for CSP, HSTS, clickjacking, MIME sniffing, referrer policy, and browser permissions policy.
- Platform admin password login now has best-effort, per-runtime throttling by login id and client IP. This reduces repeated password guessing against the `/admin/login` / `/login` internal admin path, but it is not a replacement for a persistent edge/WAF rate limit.
- Browser-driven mutation APIs now share a same-origin guard that rejects explicit cross-site `Origin`, `Referer`, or Fetch Metadata requests before route handlers run. ECPay webhook, cron, and schema alert routes are intentionally excluded because they are provider/secret-gated server-to-server endpoints.
- Public signup API now has best-effort, per-runtime request throttling. Public signup is still closed by `ENABLE_PUBLIC_SIGNUP=false`, but the route is safer for a future controlled rollout.
- Production dependency audit no longer reports high-severity advisories after non-breaking updates. Remaining production audit findings are 4 moderate advisories in nested `next -> postcss` and `exceljs -> uuid`; npm only offers `--force` fixes that would make breaking dependency changes, so they are tracked as residual risk instead of being force-applied before launch.
- `GEMINI_API_KEY` is set for the SaaS environment.
- Local Manual Beta owner/invitee login, protected pages, exports, AI analyze, invite acceptance, settings, and platform admin read pages have been smoke tested.
- Local `.env.saas.local` admin credentials are non-placeholder for Manual Beta checks; SaaS Vercel/production admin credentials still need owner review before public rollout.
- `npm run saas:predeploy` passed locally after the latest UI handoffs through `a63cfe2`, the subsequent explicit platform admin identity hardening, `/admin` merchant-entry redirect hardening, launch security headers, dependency audit hardening, post-push Vercel preview status record, platform admin login throttling, mutation same-origin guard, and public signup rate limiting.
- The remaining expected rollout warnings are:
  - Sentry/logging DSN is not configured.
  - Billing is disabled, which is acceptable for manual Beta but not paid self-serve launch.
- Latest pushed `develop-saas` HEAD before this public signup rate-limit work is `9fc4d0e fix(saas): reject cross-site mutation requests`; production is still intentionally behind until owner authorizes another deploy.
- Billing/ECPay credentials plus `ENABLE_BILLING`, final custom domain, Sentry DSN, and email provider delivery remain pending explicit approval.
- Latest owner-authorized production deployment: `a3af638 fix(saas): keep onboarding guide available on legacy policy recursion` -> Vercel deployment `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` (Ready). Production does not yet include the later role-separation, UI handoff, launch security, or admin-login throttling commits. Sentry DSN was not configured because no real DSN value is available locally or in Vercel env.

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
  - SaaS plan definitions are present and match Basic/Growth/Pro/Enterprise baseline.
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
  - Plan definitions: Basic, Growth, Pro, Enterprise in `lib/config/saas-plans.ts`.
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
- Invoice status schema and DTO alignment draft was added without applying migrations:
  - `supabase/migrations/030_saas_invoice_status_alignment.sql`
  - Aligns `invoices.status` and billing settings DTOs on `draft`, `issued`, `paid`, `failed`, and `void`.
  - No Supabase data was changed and no billing provider was enabled.
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

- Local build was intentionally run without SaaS Supabase secrets.
- Because `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were not set, Supabase-dependent predeploy checks ran in non-strict mode and skipped DB validation.
- `npm ci` reported existing dependency audit issues:
  - 2 moderate
  - 6 high
- Do not run `npm audit fix` automatically; review dependency changes before applying because it may modify production dependencies.

## Not Completed Yet

These are intentionally not completed because they require private credentials, billing setup, rollout approval, or deployment authorization.

- SaaS Gemini API key is set locally for Manual Beta; confirm/rotate the SaaS Vercel value before public rollout.
- SaaS `NEXT_PUBLIC_APP_URL` currently points to `https://smart-return-system-saas.vercel.app`; replace it with the final custom domain before public rollout if a custom Beta domain is approved.
- SaaS logging/Sentry DSN has not been added.
- Billing credentials have not been added.
- Billing webhook CheckMacValue verification exists in code, but live provider credentials have not been added.
- Billing remains disabled until owner explicitly provides ECPay credentials and authorizes `ENABLE_BILLING=true`.
- Vercel Preview SSO/protection still needs a bypass/access decision for external testers, or a final custom domain before public rollout.
- SaaS production deployment has already been run for Closed Manual Beta; do not redeploy without explicit owner approval.
- Platform admin live views are closed by default with `ENABLE_MULTI_TENANT_ADMIN=false`; they can be opened locally for owner inspection by setting the ignored local SaaS env value to `true`.
- Public signup is still gated closed by `ENABLE_PUBLIC_SIGNUP=false`; `/signup` collects Beta interest only.
- Public signup org creation and subscription creation are not wired yet; `/api/saas/signup` records a request only after the flag and DB are ready.

## Required Values Before Deployment

Create `.env.saas.local` locally from `.env.saas.example`, or set the same values in the SaaS Vercel Project.

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

Feature flags before controlled rollout:

- `ENABLE_PUBLIC_SIGNUP=false`
- `ENABLE_BILLING=false`
- `ENABLE_SUBSCRIPTION_PLAN=false`
- `ENABLE_AI_USAGE_LIMIT=true`
- `ENABLE_ADVANCED_ANALYTICS=false`
- `ENABLE_MULTI_TENANT_ADMIN=false`
- `ENABLE_IMAGE_AI=false`

## SaaS Values Still Needed From Owner

- Billing credentials for the selected provider when Stage 2 starts.
- SaaS domain, logging, and deployment settings when rollout is approved.

Do not use the internal/live Supabase project for any SaaS values.

## Safety Rules

- Do not run `vercel link` in the live/internal checkout unless explicitly repairing the live project.
- Do not point the SaaS Vercel Project to the live/internal Supabase Project.
- Do not import live/internal company data into the SaaS Supabase Project.
- Do not commit `.env.saas.local`, `.vercel/`, Vercel pulled env files, or any secret values.
- Deploy SaaS only from `develop-saas`.
- Keep `master` reserved for the live/internal product and critical fixes.

## Next Safe Execution Steps

After the remaining SaaS secret values and rollout approvals exist:

1. Fill `.env.saas.local` in the SaaS checkout.
2. Run `npm run saas:verify-checkout`.
3. Run `npm run saas:doctor`.
4. Run `npm run saas:verify-env`.
5. Add a real `GEMINI_API_KEY` to the SaaS environment only.
6. Run `npm run saas:doctor:strict`.
7. Run `npm run saas:migration-plan:strict`.
8. Run `npm run saas:schema-gate:strict`.
9. Run `npm run saas:rollout-check:strict`.
10. Run `npm run saas:predeploy`.
11. Deploy the SaaS Vercel Project only after explicit approval.
12. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, invite acceptance, team invites, billing/settings pages, and export.

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
