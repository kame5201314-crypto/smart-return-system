# Manual Beta Launch Decision Checklist

Last updated: 2026-05-26

This checklist is a decision document only. It does not authorize deployment,
migrations, environment changes, billing/provider enablement, or production
operations.

## Code Freeze Status

- Original Manual Beta freeze baseline:
  - `b88384a docs(saas): add manual beta launch decision checklist`
- Current observed `develop-saas` HEAD during this review:
  - `99c4046 feat(saas): add Sentry runtime configuration`
- No rollback was performed by this checklist.
- No new product feature should be added before the owner makes the Manual Beta
  launch decision.
- Codex scope during freeze:
  - Documentation.
  - Backend/deploy checklist maintenance.
  - Deploy preflight only after explicit owner authorization.
- Claude scope during freeze:
  - UI/copy verification only when owner explicitly asks.
  - No backend, env, migration, provider, or deployment changes.

## Current Checkout

- Workspace: SaaS commercial checkout root on the owner's local machine.
- Branch: `develop-saas`
- Latest confirmed commit before this checklist:
  - `99c4046 feat(saas): add Sentry runtime configuration`
- Safety boundary:
  - Do not touch `master`.
  - Do not touch the live/internal checkout.
  - Do not deploy production without explicit owner authorization.
  - Do not run migrations without explicit owner authorization.
  - Do not edit env/secrets from this checklist.
  - Do not enable billing/provider from this checklist.

## Closed Manual Beta Deployment Status

- Production URL:
  - `https://smart-return-system-saas.vercel.app`
- Vercel project:
  - `smart-return-system-saas`
- Deployment ID:
  - `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS`
- Status:
  - Ready
- Production smoke test:
  - Public pages are reachable with HTTP 200:
    - `/`
    - `/pricing`
    - `/features/returns`
    - `/features/ai`
    - `/features/security`
    - `/contact`
    - `/signup`
    - `/login`
  - Unauthenticated protected pages redirect to `/login` with HTTP 307:
    - `/returns`
    - `/pickup/scan`
    - `/analytics/ai-report`
    - `/settings/usage`
- Deployed guardrails:
  - `ENABLE_BILLING=false`
  - `ENABLE_PUBLIC_SIGNUP=false`
  - Email provider remains dry-run only.
  - No migration was run for this deployment.
  - No beta custom domain is configured.
  - Sentry SDK is installed and wired, but Sentry DSN is not configured, so monitoring is not active.
  - Keep rollback readiness for the first 24 hours after launch.

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
  - Cold-traffic marketing page rewrite was committed after the original freeze
    baseline in `8e27c29`.
  - Public marketing/legal RWD should still be treated as a verification item
    before launch, not a reason to add new product functionality.

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

## Closed Manual Beta Launch Conditions

Closed Manual Beta can proceed only when the owner explicitly accepts or
provides each item below:

- Scope:
  - Launch to 1-3 named Beta customers only.
  - No public paid self-serve operation.
  - No public signup.
  - No automated billing.
- Technical gates:
  - `npm run safety:agent-boundary` passes.
  - `npm run saas:doctor` or stricter owner-requested gates pass.
  - `npm run lint` has 0 errors.
  - Known lint warnings are accepted as non-blocking for this decision.
- Access:
  - Beta domain, Vercel Preview access, or local/internal access path is chosen.
  - Owner confirms who can access the Beta environment.
- Monitoring:
  - Owner chooses log-only monitoring for Closed Manual Beta, or provides a
    SaaS-specific Sentry/logging DSN before deploy.
- Operations:
  - Rollback owner/contact is known.
  - First-week success criteria are defined before inviting customers.
  - No deploy occurs unless owner explicitly authorizes `smart-return-system-saas`.

## Explicit No-Go Actions During Freeze

Do not perform any of the following before explicit owner authorization:

- Do not deploy.
- Do not run migrations.
- Do not edit env/secrets.
- Do not enable billing/provider.
- Do not touch `master`.
- Do not touch the live/internal checkout.
- Do not touch production/internal Supabase.
- Do not force push.
- Do not use `git reset --hard` to resolve launch issues.

## Owner Decisions Required Before Public Rollout

These are external/platform decisions and must be explicitly approved by the
owner before Codex or Claude acts on them:

- Sentry/logging:
  - Decide whether Manual Beta can proceed with log-only monitoring.
  - Before public rollout, provide a SaaS-specific `SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN`.
  - Create a SaaS-only Sentry Next.js project named `smart-return-saas`.
  - Add the DSN only in the SaaS Vercel project environment variables.
  - Do not paste the DSN into chat, docs, git, or `.env.saas.example`.
  - Runtime error capture is wired through `@sentry/nextjs`; source map upload
    stays disabled unless owner separately provides `SENTRY_AUTH_TOKEN`.
- Billing/ECPay:
  - Decide when Stage 2 paid Beta begins.
  - Provide SaaS-only ECPay credentials.
  - Explicitly authorize `ENABLE_BILLING=true` and any billing/provider test.
- Custom domain / Vercel Preview SSO:
  - Decide whether Manual Beta uses local testing, Vercel Preview with access/bypass, or a dedicated custom domain.
  - Do not assume external testers can access a protected Preview URL.
- Beta customer list:
  - Confirm 1-3 named Beta customers.
  - Confirm each customer's owner contact and expected onboarding date.
- Onboarding plan:
  - Decide whether onboarding is live call, guided checklist, or async setup.
  - Define the first-week success metric before launch.
  - Suggested success metrics: login completed, first return imported, first AI report reviewed, team invite tested, and one export produced.
- Production deploy:
  - Explicitly authorize the SaaS Vercel project deployment target.
  - Confirm the deploy is for `smart-return-system-saas` only.
  - Confirm it is not the live/internal Vercel project.

## Recommended Launch Strategy

- Launch only as Closed Manual Beta.
- Keep `ENABLE_PUBLIC_SIGNUP=false`.
- Keep `ENABLE_BILLING=false`.
- Keep email delivery dry-run until an approved provider is configured.
- Run the first Beta wave for 7-14 days.
- Use 1-3 customers maximum in the first wave.
- Keep deploy rollback readiness for at least the first 24 hours after deploy.
- Defer paid Beta/ECPay until real customer usage confirms the onboarding and
  core return workflow.

## Sales Page Optimization Backlog

These items are Claude UI/copy scope. Codex should only record them here and
maintain backend/deploy checklists. Codex should not implement these UI changes
unless separately asked and explicitly authorized to enter UI scope.

- Homepage hero:
  - Shift copy toward ecommerce operator pain points.
  - Lead with return workload, Shopee return tracking, AI summary, and fewer
    manual spreadsheet tasks.
- Signup:
  - Present it as a Beta application form, not open self-serve registration.
  - Make clear that the team manually approves Beta access.
- Public page language:
  - Remove engineering terms from public copy, including `RLS`, `org_id`,
    `migration`, `API gate`, and `feature flags`.
  - Keep implementation details in docs, not sales pages.
- Pain-point section:
  - Add a "Are you also dealing with this?" section.
  - Cover missed Shopee return deadlines, repeated customer explanations,
    spreadsheet reconciliation, hard-to-read return reasons, and manual exports.
- Fit guidance:
  - Add "Best fit" and "Not a fit yet" sections.
  - Best fit: Shopee-heavy sellers, small ops teams, recurring return volume,
    and teams that already export/track returns manually.
  - Not a fit yet: companies needing custom ERP integration, automated billing,
    or unsupported marketplaces.
- Beta incentive:
  - Add "First 5 Beta customers get free onboarding" or equivalent owner-approved
    offer.
  - Avoid implying permanent free service unless owner approves pricing language.
- Pricing:
  - Add plan-selection guidance.
  - Add simple ROI examples such as time saved per week, fewer missed return
    cases, and faster return reason review.

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
- If Sentry is enabled, SENTRY_DSN and optionally NEXT_PUBLIC_SENTRY_DSN are set in the SaaS Vercel project only.
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
- Owner still needs to decide Sentry/logging, Beta access/domain strategy,
  1-3 Beta customers, onboarding method, first-week success definition, and
  whether to authorize deployment to `smart-return-system-saas`.
- Current post-deploy next step:
  - Create or confirm the organization, account, invite link, or login
    credentials for the Beta customer `遇見未來`.

Public paid SaaS launch is not approved by this checklist.
