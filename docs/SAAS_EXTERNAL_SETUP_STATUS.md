# SaaS External Setup Status

Last updated: 2026-05-16

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
  - `npm run saas:predeploy`
- Hardened the Supabase project predeploy check so `APP_MODE=saas` uses `SAAS_SUPABASE_PROJECT_ID` before falling back to the internal project id.
- Replaced the root `README.md` with SaaS commercial checkout guidance and explicitly documented that return AI analysis is text-only.
- Added `.github/workflows/saas-safety.yml` to run SaaS branch and checkout safety checks on `develop-saas`.
- Updated `scripts/saas/verify-saas-checkout.mjs` so CI can detect the branch from GitHub/Vercel environment variables.
- Ran local verification in the SaaS checkout:
  - `npm ci`: passed
  - `npm run lint`: passed with existing warnings only
  - `npm run typecheck`: passed
  - `npm run test:all`: passed
  - `npm run build`: passed without live/internal env values

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
- SaaS Gemini API key has not been added to Vercel.
- SaaS domain has not been configured.
- SaaS logging/Sentry DSN has not been added.
- Billing credentials have not been added.
- SaaS production deployment has not been run.

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

- `BILLING_PROVIDER`
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ECPAY_MODE`

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
3. Run `npm run saas:verify-env`.
4. Run `npm run saas:predeploy`.
5. Apply migrations to the SaaS Supabase Project only.
6. Deploy the SaaS Vercel Project.
7. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, and export.

If you need to run the individual checks:

1. Run `node scripts/verify-env.mjs`.
2. Apply migrations to the SaaS Supabase Project only.
3. Run `npm run lint`.
4. Run `npm run typecheck`.
5. Run `npm run test:all`.
6. Run `npm run build`.
7. Deploy the SaaS Vercel Project.
8. Smoke test login, import, returns list, return detail, scan tool, AI report, notes, and export.
