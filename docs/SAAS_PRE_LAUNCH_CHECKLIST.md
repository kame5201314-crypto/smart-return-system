# SaaS Pre-Launch Checklist

Last verified: 2026-07-15

This checklist is for the SaaS commercial checkout on `develop-saas`.
It does not authorize production deployment, Supabase migrations, or Vercel
setting changes by itself. External changes still need explicit owner approval.

## Current Gate Status

The full env-backed predeploy gates passed before runtime `a29f725` was deployed
on 2026-07-15, followed by Production smoke 16/16 and zero deployment errors:

- `npm run safety:agent-boundary`
- `npm run verify-env`
- `npm run saas:doctor:strict`
- `npm run saas:migration-plan:strict`
- `npm run saas:schema-gate:strict`

`npm run saas:rollout-check:strict` has an additional admin credential gate:

- `ADMIN_USERNAME` must be set.
- `ADMIN_PASSWORD` must be non-placeholder and at least 12 characters.

Production Sentry DSNs are configured. The remaining expected Manual Beta
non-blocking warning is that Billing is disabled; this is intentional for the
current free/manual posture but not sufficient for paid self-serve launch.

Repository hardening after `a29f725` passed lint, typecheck, `test:all`, and the
Production build. It is pushed but not deployed. The clean clone has no
`.env.saas.local`, so do not fabricate placeholders to rerun strict env gates.

## Launch Mode Decision

Choose one launch mode before deployment:

| Mode | Required state |
| --- | --- |
| Manual Beta | `ENABLE_PUBLIC_SIGNUP=false`, `ENABLE_BILLING=false`, `ENABLE_SUBSCRIPTION_PLAN=false`; owner manually provisions organizations. |
| Paid self-serve | Billing provider credentials configured, webhook verified, public signup/subscription flags intentionally enabled, and payment smoke tests completed. |

Current recommended mode: **Manual Beta**.

## Local Inspection Mode

For owner-only local review of the commercial management dashboard, the ignored
local file `.env.saas.local` may temporarily set:

```env
ENABLE_MULTI_TENANT_ADMIN=true
```

Restart the local dev server after changing this flag. Shared examples should
remain closed by default. Production is an explicit approved exception:
`ENABLE_MULTI_TENANT_ADMIN=true`, with authenticated admin and merchant-denial
QA already completed; do not change that value without new authorization.

## Must Confirm Before Manual Beta Deploy

- SaaS Vercel project is `smart-return-system-saas`.
- Branch is `develop-saas`.
- Supabase project is `auyznbwtjvemyamujmgt`.
- Internal/live project refs are not present in SaaS env values.
- `NEXT_PUBLIC_APP_URL` points to the final HTTPS URL.
- `ADMIN_SESSION_SECRET`, `CRON_SECRET`, and `SCHEMA_DRIFT_ALERT_TOKEN` are strong non-placeholder secrets.
- `ADMIN_USERNAME` is set and `ADMIN_PASSWORD` is non-placeholder with at least 12 characters.
- `GEMINI_API_KEY` is set for the SaaS project only.
- `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` is set before public rollout, or the owner explicitly accepts manual log-only monitoring for closed Beta.
- `ENABLE_IMAGE_AI=false`.
- `ENABLE_AI_USAGE_LIMIT=true`.
- `ENABLE_MULTI_TENANT_ADMIN=false` unless the platform admin rollout is explicitly approved.
- `ENABLE_PUBLIC_SIGNUP=false` unless public signup is explicitly approved.
- `ENABLE_BILLING=false` unless billing rollout is explicitly approved.

## Recommended Verification Order

Run these locally before requesting deployment approval:

```powershell
npm run safety:agent-boundary
npm run verify-env
npm run saas:doctor:strict
npm run saas:migration-plan:strict
npm run saas:schema-gate:strict
npm run saas:rollout-check:strict
npm run lint
npm run typecheck
npm run test:all
npm run saas:build
```

If any command fails, do not deploy. Fix with a new commit and rerun the failed
command plus any dependent checks.

## Post-Deploy Smoke Tests

After deployment approval and deploy completion, test:

- Public marketing pages: `/`, `/pricing`, `/features/*`, `/contact`, `/legal/*`.
- Login and protected app route access.
- Return list, return detail, notes, inspection fields, and export routes.
- Customer portal apply flow with image upload.
- Shopee scan smoke route or maintenance script.
- AI report generation and AI quota behavior.
- Team settings and invite flow.
- Invite acceptance link states: valid, expired, email mismatch, already member.
- Billing/settings pages remain gated or ready according to the selected launch mode.
- Cron endpoints reject unauthenticated calls when `CRON_SECRET` is required.

## Rollback Rule

For production incidents, restore service first using Vercel rollback. Do not
use `git reset --hard` or force-push as the first response to an incident.
