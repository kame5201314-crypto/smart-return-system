# SaaS External Setup Status

Last updated: 2026-05-21

This file tracks external SaaS setup work that must stay separate from the live internal project.

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
  - The check validates `APP_MODE=saas`, the expected SaaS Supabase project ref, forbidden internal/live project refs, `SUPABASE_DB_PASSWORD` readiness, and the full migration chain ending at `032`.
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

These are intentionally not completed because they require private credentials, DB migration authorization, billing setup, or deployment authorization.

- SaaS Supabase migrations have not been applied.
- SaaS tenant/org RLS has not been applied to any database.
- SaaS Gemini API key has not been added to Vercel.
- SaaS domain has not been configured.
- SaaS logging/Sentry DSN has not been added.
- Billing credentials have not been added.
- Billing webhook CheckMacValue verification exists in code, but live provider credentials have not been added.
- SaaS production deployment has not been run.
- Platform admin pages are not wired to live SaaS DB data yet; the schema readiness gate plus `027`/`028` drafts now define the DB shape and manual Beta provisioning path required before live consumption is enabled.
- Platform admin live operations are still gated closed by `ENABLE_MULTI_TENANT_ADMIN=false`.
- Public signup is still gated closed by `ENABLE_PUBLIC_SIGNUP=false`; `/signup` collects Beta interest only.
- Public signup request persistence code and `026` migration draft exist, but the migration has not been applied.
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

- SaaS `GEMINI_API_KEY`
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

After the SaaS Supabase and secret values exist:

1. Fill `.env.saas.local` in the SaaS checkout.
2. Run `npm run saas:verify-checkout`.
3. Run `npm run saas:doctor`.
4. Run `npm run saas:verify-env`.
5. Run `npm run saas:doctor:strict`.
6. Run `npm run saas:migration-plan:strict`.
7. Run `npm run saas:schema-gate:strict`.
8. Run `npm run saas:predeploy`.
9. Review and apply migrations to the SaaS Supabase Project only, using the full migration chain from `001_*` through `030_*`; do not apply only the SaaS tail migrations to a new empty DB.
10. Deploy the SaaS Vercel Project.
11. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, and export.

If you need to run the individual checks:

1. Run `node scripts/verify-env.mjs`.
2. Apply migrations to the SaaS Supabase Project only.
3. Run `npm run lint`.
4. Run `npm run typecheck`.
5. Run `npm run test:all`.
6. Run `npm run build`.
7. Deploy the SaaS Vercel Project.
8. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, and export.
