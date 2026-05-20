# SaaS External Setup Status

Last updated: 2026-05-20

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

## Verification Notes

- Local build was intentionally run without SaaS Supabase secrets.
- Because `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were not set, Supabase-dependent predeploy checks ran in non-strict mode and skipped DB validation.
- `npm ci` reported existing dependency audit issues:
  - 2 moderate
  - 6 high
- Do not run `npm audit fix` automatically; review dependency changes before applying because it may modify production dependencies.

## Not Completed Yet

These are intentionally not completed because they require private credentials or a new external project.

- SaaS Supabase Project is not connected yet.
- SaaS Supabase migrations have not been applied.
- SaaS tenant/org RLS has not been applied to any database.
- P0 runtime actions and exports have not yet been rewritten to require `getOrgContext()` and explicit `org_id` filters.
- SaaS Gemini API key has not been added to Vercel.
- SaaS domain has not been configured.
- SaaS logging/Sentry DSN has not been added.
- Billing credentials have not been added.
- SaaS production deployment has not been run.
- GitHub Branch Protection for `master` is not enabled yet.

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

## Supabase Values Still Needed From Owner

- SaaS `NEXT_PUBLIC_SUPABASE_URL`
- SaaS `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- SaaS `SUPABASE_SERVICE_ROLE_KEY`
- SaaS `SAAS_SUPABASE_PROJECT_ID`
- SaaS `SUPABASE_PROJECT_ID_EXPECTED`

Do not use the internal/live Supabase project for any of these values.

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
6. Run `npm run saas:predeploy`.
7. Review and apply migrations to the SaaS Supabase Project only, including `supabase/migrations/023_saas_commercial_foundation.sql`, `supabase/migrations/024_saas_commercial_v2.sql`, and `supabase/migrations/025_attach_org_id_to_business_tables.sql` when tenant and billing foundation tables are approved.
8. Deploy the SaaS Vercel Project.
9. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, and export.

If you need to run the individual checks:

1. Run `node scripts/verify-env.mjs`.
2. Apply migrations to the SaaS Supabase Project only.
3. Run `npm run lint`.
4. Run `npm run typecheck`.
5. Run `npm run test:all`.
6. Run `npm run build`.
7. Deploy the SaaS Vercel Project.
8. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, and export.
