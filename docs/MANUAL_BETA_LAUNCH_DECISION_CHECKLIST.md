# Manual Beta Launch Decision Checklist

Last updated: 2026-05-25

This checklist is a decision document only. It does not authorize deployment,
migrations, environment changes, billing/provider enablement, or production
operations.

## Current Checkout

- Workspace: SaaS commercial checkout root on the owner's local machine.
- Branch: `develop-saas`
- Latest confirmed commit before this checklist:
  - `4e4d0ca docs(saas): refresh manual beta rollout handoff`
- Safety boundary:
  - Do not touch `master`.
  - Do not touch the live/internal checkout.
  - Do not deploy production without explicit owner authorization.
  - Do not run migrations without explicit owner authorization.
  - Do not edit env/secrets from this checklist.
  - Do not enable billing/provider from this checklist.

## Completed For Manual Beta

- Backend/readiness/predeploy:
  - SaaS project safety checks are in place.
  - `npm run saas:doctor:strict` has passed in the prepared local SaaS environment.
  - `npm run saas:rollout-check:strict` has passed for local Manual Beta readiness with expected public-rollout warnings.
  - `npm run saas:predeploy` has passed locally after the AI analytics consistency gate hardening.
  - Manual Beta owner/invitee auth, protected routes, exports, AI analyze, invite acceptance, settings, and platform admin read pages have been smoke tested locally.
- Email queue:
  - `email_queue` worker is dry-run only.
  - Cron route is `CRON_SECRET` gated.
  - The route does not send email, mutate queue rows, call a provider, deploy, or change platform settings.
- AI analytics predeploy consistency gate:
  - The predeploy consistency check now falls back when SaaS `shopee_returns` lacks optional legacy date columns such as `dispute_deadline` or `processed_at`.
  - Non-schema query errors still fail the gate.
  - Unit coverage exists for date normalization, missing-column detection, fallback order, and non-schema error handling.
- Claude UI/RWD QA completed to date:
  - Customer portal SaaS polish was reported complete.
  - Returns dashboard visual polish was reported complete.
  - Mobile responsive QA follow-up passed on the previously checked mobile routes.
  - Remaining UI-only polish, if owner wants it before launch, is the public marketing/legal RWD inspection for:
    - `/features/returns`
    - `/features/ai`
    - `/features/security`
    - `/contact`
    - `/legal/terms`
    - `/legal/privacy`
    - `/legal/refund`
    - `/signup`

## Manual Beta Acceptable State

The following state is acceptable for a closed/manual Beta, but not for public
paid self-serve launch:

- `ENABLE_BILLING=false`
  - Billing stays disabled.
  - ECPay/paid subscription flow is not live.
- Email provider remains dry-run / not wired.
  - No live invite email or billing email delivery is enabled.
- No new migration apply is required for this launch decision.
  - SaaS DB migrations are already applied through the Manual Beta chain used by the current code path.
  - Draft migrations after the applied chain remain future work unless separately approved.
- No production deploy has been performed by this checklist.
  - Production deployment remains an owner decision.
- Public signup remains controlled.
  - `ENABLE_PUBLIC_SIGNUP=false` is acceptable for Manual Beta.
  - Owner/manual provisioning remains the intended Beta path.

## Owner Decisions Required Before Public Rollout

These are external/platform decisions and must be explicitly approved by the
owner before Codex or Claude acts on them:

- Sentry/logging:
  - Decide whether Manual Beta can proceed with log-only monitoring.
  - Before public rollout, provide a SaaS-specific `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
- Billing/ECPay:
  - Decide when Stage 2 paid Beta begins.
  - Provide SaaS-only ECPay credentials.
  - Explicitly authorize `ENABLE_BILLING=true` and any billing/provider test.
- Custom domain / Vercel Preview SSO:
  - Decide whether Manual Beta uses local testing, Vercel Preview with access/bypass, or a dedicated custom domain.
  - Do not assume external testers can access a protected Preview URL.
- Production deploy:
  - Explicitly authorize the SaaS Vercel project deployment target.
  - Confirm the deploy is for `smart-return-system-saas` only.
  - Confirm it is not the live/internal Vercel project.

## Commands To Run Only If Owner Authorizes Deploy

Do not run these commands from this checklist unless the owner explicitly
authorizes the deploy step and confirms the target SaaS Vercel project.

```powershell
Set-Location "<SaaS commercial checkout root>"
git status -sb
git branch --show-current
npm run safety:agent-boundary
git pull --ff-only origin develop-saas
```

Final local gates:

```powershell
npm run saas:verify-checkout
npm run saas:doctor:strict
npm run saas:rollout-check:strict
npm run saas:schema-gate:strict
npm run saas:predeploy
```

Pre-deploy owner confirmations:

```text
- Branch is develop-saas.
- Working tree is clean.
- Vercel project is smart-return-system-saas.
- Supabase project ref is auyznbwtjvemyamujmgt.
- Target is not master/live/internal.
- Billing state is intentionally enabled or disabled for this rollout.
- Sentry/logging decision is recorded.
- Custom domain / Preview SSO decision is recorded.
```

Deploy command placeholder:

```powershell
# Run only after explicit owner authorization.
# Use the SaaS Vercel project link only.
vercel deploy --prod
```

Post-deploy smoke test list:

```text
- /
- /pricing
- /login
- /returns
- /returns/[id]
- /pickup/scan
- /analytics/ai-report
- /settings/usage
- /settings/billing
- /settings/team
- team invite create
- /invite/[token] accept flow
- export APIs
- /internal/orgs
- /internal/orgs/[id]
- /internal/billing/events
```

## Rollback And Incident Notes

- For production incidents, restore service first using Vercel rollback to the
  last known-good SaaS deployment.
- Do not use `git reset --hard` as an incident response shortcut.
- Do not force push any branch.
- Do not push or hotfix `master` for SaaS incidents.
- Do not run destructive database rollback unless the owner explicitly approves
  a reviewed database recovery plan and backup point.
- Prefer feature flags and provider disablement before code rollback when the
  issue is limited to an optional SaaS capability.
- Preserve logs, deployment id, commit hash, affected org/user ids, and timeline
  before making follow-up fixes.

## Current Decision

Manual Beta can remain in a closed/manual testing state with:

- Billing disabled.
- Email delivery dry-run only.
- Public signup closed.
- No new migration apply.
- No production deploy until owner authorization.

Public paid SaaS launch is not approved by this checklist.
