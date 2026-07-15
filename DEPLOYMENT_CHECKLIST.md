# Deployment Checklist

This checkout is the SaaS commercial version. It must not be used to deploy or
modify the live internal return system unless the owner explicitly says the work
is for live production.

## Project Boundary

| Target | Expected value |
| --- | --- |
| Checkout | `D:\AI專案\AI退貨系統商業版_2026.5.16` |
| Branch | `develop-saas` |
| Remote | `origin` -> `https://github.com/kame5201314-crypto/smart-return-system.git` |
| Vercel project | `smart-return-system-saas` |
| Supabase project | `auyznbwtjvemyamujmgt` |

The live/internal project is protected and tracked separately. Do not use the
internal Supabase project refs `fdzfnenizyppxglypden` or `sntbrntwztkllwkutooi`
for this SaaS checkout.

## Required Preflight

Run this before any deployment request:

```powershell
Get-Location
git status -sb
git remote -v
git branch -vv
npm run safety:agent-boundary
```

If the path, branch, or remote does not match this file, stop and report the
mismatch.

## SaaS Readiness Checks

Use the detailed checklist in `docs/SAAS_PRE_LAUNCH_CHECKLIST.md`. The short
command sequence is:

```powershell
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

Do not deploy if any command fails.

## Manual Beta Defaults

For a controlled manual Beta, keep these flags closed:

```env
ENABLE_PUBLIC_SIGNUP=false
ENABLE_BILLING=false
ENABLE_SUBSCRIPTION_PLAN=false
ENABLE_MULTI_TENANT_ADMIN=false
ENABLE_IMAGE_AI=false
```

`ENABLE_AI_USAGE_LIMIT=true` should remain enabled.

Current Production is an explicitly approved exception to the generic admin
default: `ENABLE_MULTI_TENANT_ADMIN=true` for platform operations, with
authenticated-admin and merchant-denial QA completed. Google Auth, Google trial
signup, trial-expiry cron, and public lead capture are also enabled. Do not use
this defaults block to turn an active Production flag off without separate
authorization.

## External Changes Need Approval

The following require explicit owner approval before execution:

- Vercel deployment, promotion, rollback, project linking, or domain changes.
- Supabase migration apply, RLS changes, storage policy changes, or data writes.
- Billing provider setup or webhook activation.
- Secret/env changes in Vercel or Supabase.
- GitHub branch protection or repository setting changes.

## Rollback Rule

If production is broken, restore service first with Vercel rollback, then inspect
logs and fix with a new commit. Do not use `git reset --hard` or force-push as
the first response to an incident.
