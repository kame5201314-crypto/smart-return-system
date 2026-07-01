# SaaS External Owner Actions

Last updated: 2026-07-01

This runbook converts the remaining SaaS rollout blockers into owner decisions
and safe Codex handoffs. It does not authorize deployment, Supabase migrations,
environment changes, billing/provider enablement, or DNS changes by itself.

## Current Verified State

- Branch: `develop-saas`
- Current production runs `f634bc0 fix(saas): keep SEO metadata routes public`,
  which includes the post-`796a02a` Shopee workspace-error localization, SEO
  infrastructure, and public access for `robots.txt`, `sitemap.xml`, and
  `opengraph-image`.
- Production URL: `https://smart-return-system-saas.vercel.app`
- Production deployment: `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot`
- Production status: Ready
- Latest deployed runtime commit:
  `f634bc0 fix(saas): keep SEO metadata routes public`
- Latest pushed source commit after this runbook update may be newer than the
  runtime commit because deployment documentation is committed after smoke
  testing.
- Latest Sentry setup / redeploy: 2026-06-06
- Manual Beta posture:
  - `ENABLE_PUBLIC_SIGNUP=false`
  - `ENABLE_BILLING=false`
  - email delivery remains dry-run
  - owner deferred custom domain purchase/setup and chose to use
    `https://smart-return-system-saas.vercel.app` for Closed Manual Beta.
    Historical `app.smart-return.tw` DNS notes remain below for future use only;
    do not keep retrying domain verification until the owner buys/registers a
    domain and reauthorizes DNS/Vercel work.
  - Sentry DSN is configured in Vercel Production env
  - migration `035_saas_onboarding_completion_rpc.sql` is applied
  - migration `037_saas_team_invite_status.sql` is applied
  - draft migrations `033`, `034`, `036`, and `038` remain unapplied

## 2026-07-01 Go-Live Risk And Service Plan

See [`SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`](./SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md)
for the current ordered launch, subscription, and service risk plan.

Current decision:

- Closed free/manual Beta is acceptable with controlled scope.
- First paid manual customers require invoice/receipt capability, finalized
  legal/refund wording, and a manual payment record SOP before collecting
  money.
- Public self-serve paid launch remains blocked by email delivery, ECPay
  recurring billing, public signup/provisioning posture, lifecycle automation,
  and provider-backed invoice flow.

The next owner-authorized technical actions, in order, are:

1. Apply only `038_saas_org_member_visibility.sql` if multi-member team
   management QA is required.
2. Verify production `/admin` and `/internal` env/identity access read-only.
3. Run the merchant-to-platform QA plan in
   `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md` against a disposable QA org.
4. Before any paid customer, confirm invoice/receipt capability and finalize
   public legal pages for paid use.

## 2026-06-13 Custom Domain Deferred

- Owner confirmed `smart-return.tw` has not been purchased yet.
- Closed Manual Beta will continue on the Vercel production URL:
  `https://smart-return-system-saas.vercel.app`.
- Custom domain work is no longer an active blocker for Beta operation.
- If the owner later purchases a domain, resume with the Vercel dashboard DNS
  target recorded in the historical section below and re-run DNS/HTTPS smoke
  after records are visible.
- Codex did not purchase a domain, edit DNS, alias the deployment, deploy, run
  migrations, edit env/secrets, enable email delivery, enable billing/provider,
  or touch internal/live Supabase.

## 2026-06-13 Domain Ownership and Resend Planning

- Current Vercel/domain result:
  - Local `.vercel/project.json` points to project `smart-return-system-saas`
    (`prj_VdkRrS4UJEvipSG8OMCXXkUmt3i8`).
  - Vercel Dashboard access confirms `app.smart-return.tw` is listed on the
    `smart-return-system-saas` Domains page, but it is still `Invalid
    Configuration`.
  - The dashboard detail panel does not show a TXT ownership challenge at this
    time. It shows the required DNS record:
    - Type: `CNAME`
    - Name/Host: `app`
    - Value/Target: `64ed959ebaa2a805.vercel-dns-016.com.`
    - TTL: Auto or 300
  - If the DNS provider rejects the trailing dot, use
    `64ed959ebaa2a805.vercel-dns-016.com`.
  - A direct TWNIC RDAP check for `smart-return.tw` returned 404 while
    `twnic.tw` returns active; owner should confirm the root domain is
    registered and delegated before expecting the app subdomain to resolve.
  - Current CLI scope reports no projects from `npx vercel project ls`.
  - `npx vercel domains ls` reports 0 domains.
  - `npx vercel domains inspect smart-return.tw` returns 403.
  - `npx vercel domains inspect app.smart-return.tw` returns 403.
  - DNS for `smart-return.tw` and `app.smart-return.tw` is NXDOMAIN.
  - No TXT ownership challenge was returned by the CLI.
- Owner must complete domain setup in Vercel/DNS:
  1. In Vercel Dashboard, open project `smart-return-system-saas`.
  2. Go to Settings -> Domains.
  3. Add `app.smart-return.tw`.
  4. If Vercel shows a TXT ownership challenge, add the exact TXT name/value
     shown in the dashboard. Do not guess the TXT value.
  5. Add DNS record:
     - Type: `CNAME`
     - Name/Host: `app`
     - Value/Target: `64ed959ebaa2a805.vercel-dns-016.com.`
     - TTL: Auto or 300
  6. After DNS resolves, ask Codex to retry verification and HTTPS smoke. Codex
     should not alias while DNS is NXDOMAIN or Vercel domain inspect is 403.
- Recommended email provider for first production delivery: Resend.
  - Reason: low setup overhead for Next.js, Vercel Marketplace can generate
    `RESEND_API_KEY`, and it covers Beta invite, trial, AI quota, and billing
    notification use cases.
  - Owner must provide:
    - Resend account.
    - Verified sender domain, preferably `smart-return.tw`.
    - `RESEND_API_KEY` out of band.
    - Sender address, for example `no-reply@smart-return.tw` or
      `support@smart-return.tw`.
    - First-scope decision: invite email only, or invite + trial/quota/billing
      notifications.
  - Current backend is not ready to send real email without a small provider
    adapter pass. Queue creation and dry-run inspection exist, but
    `dryRun=false` is intentionally rejected.
  - Minimal Codex implementation after credentials/authorization:
    - Env contract: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`,
      `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `ENABLE_EMAIL_DELIVERY=true`.
    - Keep dry-run fallback.
    - Add Resend adapter and template rendering for current `template_key`
      values.
    - Update queue rows after send success/failure and preserve retry limits.
    - Add tests for dry-run, provider disabled, successful send, failed send,
      retry cutoff, and cron authorization.

## 2026-06-13 Read-Only Owner-Blocked Status Check

- Production alias `https://smart-return-system-saas.vercel.app` currently
  resolves to Vercel deployment `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot`, status
  Ready.
- Public production smoke returned `200` for `/`, `/pricing`,
  `/features/returns`, `/features/ai`, `/features/security`, `/contact`,
  `/signup`, and `/login`.
- Unauthenticated protected tenant/platform routes returned `307` redirects.
- Custom domain remains blocked:
  - `app.smart-return.tw` is still NXDOMAIN.
  - `smart-return.tw` is still NXDOMAIN.
  - HTTPS checks for `app.smart-return.tw` fail because the host cannot be
    resolved.
  - Vercel domain inspect still returns 403 for the current scope.
  - `vercel domains ls` still reports 0 domains.
- Vercel Production env names include `SENTRY_DSN` and
  `NEXT_PUBLIC_SENTRY_DSN`.
- Vercel Production env names do not show email provider credentials or
  ECPay/provider credential names; email delivery and Billing/ECPay remain
  owner-blocked.
- Draft migrations `033`, `034`, `036`, and `038` remain separate owner-authorization
  items. Do not apply them as a bundle.
- No deploy, migration, env/secret edit, DNS/domain mutation, email provider
  enablement, billing/provider enablement, or internal/live Supabase action was
  performed.

## 2026-06-12 Post-Rollout Domain/DNS Recheck

- Deployment `dpl_28RhEVo2Nespq7xjTEQvmELag34r` was rechecked and remains
  Ready.
- `https://smart-return-system-saas.vercel.app` smoke still passes:
  - public routes return `200`
  - unauthenticated merchant routes redirect to `/login`
  - unauthenticated platform routes redirect to `/admin/login?next=...`
- Vercel inspect still lists `https://app.smart-return.tw` as an alias for the
  deployment, but the domain is not usable yet:
  - `Resolve-DnsName app.smart-return.tw` returns NXDOMAIN.
  - `Resolve-DnsName smart-return.tw` returns NXDOMAIN.
  - Direct HTTPS checks fail with host-not-resolved.
  - `npx vercel domains inspect app.smart-return.tw` returns Vercel 403 for the
    current scope.
  - `npx vercel domains ls` reports 0 domains in the current scope.
  - No TXT ownership verification record was returned by the CLI.
- Owner action remains required:
  - Confirm DNS exists at the authoritative DNS provider.
  - Add or verify `CNAME app -> cname.vercel-dns.com`, or add the exact TXT
    ownership record shown by the Vercel dashboard if Vercel requires one.
  - Ask Codex to retry verification only after DNS resolves.
- No deploy, migration, env/secret edit, DNS mutation, email provider
  enablement, billing/provider enablement, or internal/live Supabase action was
  performed during this recheck.

## 2026-06-06 Next Executable Queue

Codex has started the public multi-tenant isolation hardening because the owner
confirmed many customers will be opened. External rollout actions still need
owner-provided values or per-action authorization. The next actions must stay
serialized in this order:

Status update on 2026-06-12: local Claude/Codex implementation work recorded in
`agent-shared/**` is complete. The remaining queue is external/owner-blocked
unless the owner explicitly authorizes a new local feature, deployment,
provider setup, or migration.

1. Custom/beta domain:
   - Owner selected `app.smart-return.tw`.
   - Codex attempted to add the domain to Vercel project
     `smart-return-system-saas` on 2026-06-06.
   - The CLI printed a project-add success message, but subsequent
     `vercel domains inspect app.smart-return.tw` and `vercel alias set ...`
     failed with Vercel 403 domain access errors.
   - `vercel domains ls` still reports 0 domains under the current Vercel
     scope, and local DNS lookup does not resolve `app.smart-return.tw`.
   - Owner must set/verify DNS ownership or provide DNS provider access before
     Codex can complete alias verification.
2. Public multi-tenant isolation:
   - Shopee, pickup, customer portal, and upload/signed-url P1 are hardened
     locally.
   - Backup action and backup cron P2 gating is complete locally. Backup cron
     now skips unless `SAAS_BACKUP_ORG_ID` is configured.
   - Non-backup platform maintenance cron routes now skip unless
     `ENABLE_PLATFORM_MAINTENANCE_CRON=true` is configured.
   - Keep both cron env vars unset unless the owner explicitly wants automated
     platform maintenance enabled in production.
3. Email provider:
   - Owner chose to skip this for now.
   - Owner chooses Resend, Postmark, SendGrid, or SMTP and provides credentials
     out of band.
   - Codex wires delivery only after provider credentials and enablement scope
     are confirmed.
4. Billing/ECPay:
   - Keep disabled for Closed Manual Beta.
   - Start only when Stage 2 paid Beta is approved and ECPay credentials exist.
5. Migrations `033`, `034`, and `036`:
   - Do not apply as a bundle.
   - Apply only when the matching runtime feature is ready and separately
     authorized.

If an agent is asked to "finish everything" without the required values above,
the correct action is to stop, report the missing value/authorization, and avoid
placeholder env values, migrations, provider activation, or domain changes.

## 2026-06-06 Completed Owner Action: Sentry

- Sentry organization `smart-return-saas` was created with Google account
  `kawei88888@gmail.com`.
- The Sentry onboarding page reports a 14-day Business trial and states it will
  move to the free plan after the trial with no charge.
- Next.js setup was selected and the DSN was copied from Sentry.
- Vercel Production env now contains:
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
- DSN values were not written to git or docs.
- Production was redeployed so the env values are available at runtime:
  `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`.
- Production smoke passed after redeploy.

## 2026-06-06 Completed Owner Action: Migration 035

- Owner explicitly authorized applying only
  `035_saas_onboarding_completion_rpc.sql` to SaaS Supabase project
  `auyznbwtjvemyamujmgt`.
- Preflight, `npm run safety:agent-boundary`, and
  `npm run saas:migration-plan:strict` passed before the apply.
- Remote migration history before apply showed `033`, `034`, `035`, and `036`
  pending.
- Codex applied only `035` and repaired remote migration history for version
  `035` to `applied`.
- Post-checks confirmed:
  - `035` is applied remotely.
  - `033`, `034`, and `036` remain unapplied.
  - `public.complete_organization_onboarding(uuid, uuid, timestamptz, jsonb)`
    exists.
  - `service_role` can execute the RPC.
  - `npm run saas:schema-gate:strict` passed.
  - `npm run saas:doctor` passed with 155 pass, 1 expected local flag warning,
    and 0 fail.
- No deployment, env/secret edit, domain/DNS change, email provider enablement,
  billing/provider enablement, master/live/internal Supabase action, or
  migrations `033`, `034`, `036` apply was performed.

## 2026-06-13 Completed Owner Action: Production Deploy of f634bc0

- Owner authorized deploying `develop-saas` latest HEAD
  `f634bc0 fix(saas): keep SEO metadata routes public` to Vercel Production
  project `smart-return-system-saas`.
- Exclusions in the authorization were honored:
  - no migration
  - no env/secret edit
  - no separate domain/DNS setup command
  - no email provider enablement
  - no billing/provider enablement
  - no master/live/internal Supabase action
- `npm run safety:agent-boundary` and `npm run saas:predeploy` passed before
  deployment.
- Vercel deployment ID: `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot`.
- Deployment URL:
  `https://smart-return-system-saas-pji1crs57-kaweis-projects.vercel.app`.
- Production alias: `https://smart-return-system-saas.vercel.app`.
- Vercel status: Ready.
- Smoke test passed:
  - public routes `/`, `/pricing`, `/features/returns`, `/features/ai`,
    `/features/security`, `/contact`, `/signup`, `/login`, `/robots.txt`, and
    `/sitemap.xml` returned `200`
  - tenant protected routes redirected to `/login`
  - platform protected routes redirected to `/admin/login?next=...`
- Vercel CLI again listed `https://app.smart-return.tw` as an alias and
  attempted asynchronous SSL creation. DNS still does not resolve
  `app.smart-return.tw`, so the custom domain remains not ready for use.

## 2026-06-06 Owner-Blocked Audit Result

Codex completed every safe check that can be run without additional owner
values or irreversible authorization:

- Vercel project is confirmed as `smart-return-system-saas`; SaaS doctor reports
  it is not linked to the internal/live project.
- Production deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` remains Ready.
- Vercel production env names now list `SENTRY_DSN` and
  `NEXT_PUBLIC_SENTRY_DSN`.
- No custom/beta domain is visible from the read-only Vercel deployment check.
- Vercel production env names do not list email provider credentials.
- Vercel production env names do not list ECPay/provider credentials.
- Billing remains disabled for Manual Beta; no provider was enabled.
- Draft migrations `033`, `034`, and `036` remain unapplied. Migration `035`
  has since been explicitly authorized and applied.

Latest verification:

- `npm run saas:doctor`: 155 pass, 1 warn, 0 fail. The warning is local
  `ENABLE_MULTI_TENANT_ADMIN=true`.
- `npm run saas:rollout-check`: 23 pass, 2 warn, 0 fail in local env before
  Sentry was added to Vercel. The local Sentry warning is expected because
  `.env.saas.local` intentionally does not store DSN values. Vercel Production
  env is now configured.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:all`: passed.

## 2026-06-12 Completed Owner Action: Production Deploy of 796a02a

- Owner authorized deploying `develop-saas` latest HEAD
  `796a02a docs(saas): record sequential completion blockers` to Vercel
  Production project `smart-return-system-saas`.
- Exclusions in the authorization were honored:
  - no migration
  - no env/secret edit
  - no separate domain/DNS setup command
  - no email provider enablement
  - no billing/provider enablement
  - no master/live/internal Supabase action
- `npm run safety:agent-boundary` and `npm run saas:predeploy` passed before
  deployment.
- Vercel deployment ID: `dpl_28RhEVo2Nespq7xjTEQvmELag34r`.
- Production alias: `https://smart-return-system-saas.vercel.app`.
- Vercel status: Ready.
- Vercel CLI reported existing alias `https://app.smart-return.tw` and
  asynchronous SSL creation during deploy. DNS lookup still does not resolve
  `app.smart-return.tw`, so the custom domain remains not ready for use.
- Smoke test passed for public `200`, tenant `307 -> /login`, and platform
  `307 -> /admin/login?next=...` routes.

## 2026-06-06 Completed Owner Action: Current HEAD Production Deploy

- Owner authorized deploying current `origin/develop-saas` HEAD to Vercel
  Production project `smart-return-system-saas`.
- Required included commit:
  `27c5ecb fix(saas): gate backup and maintenance cron isolation`.
- Actual deployed HEAD:
  `0c9c983 docs(saas): avoid stale latest head wording`.
- `npm run saas:predeploy` passed before deployment.
- Vercel deployment ID: `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`.
- Production alias: `https://smart-return-system-saas.vercel.app`.
- Smoke test passed for public `200`, tenant `307 -> /login`, and platform
  `307 -> /admin/login?next=...` routes.
- No domain/DNS, migration, env/secret, email provider, billing/provider,
  master/live/internal Supabase, or provider setting change was performed.

## Latest Smoke Snapshot

Verified on 2026-06-12 after deployment `dpl_28RhEVo2Nespq7xjTEQvmELag34r`:

- Public routes returned `200`:
  - `/`
  - `/pricing`
  - `/features/returns`
  - `/features/ai`
  - `/features/security`
  - `/contact`
  - `/signup`
  - `/login`
- Unauthenticated tenant routes returned `307 -> /login`:
  - `/analytics`
  - `/returns`
  - `/pickup/scan`
  - `/analytics/ai-report`
  - `/settings/usage`
- Unauthenticated platform routes returned `307 -> /admin/login?next=...`:
  - `/internal`
  - `/internal/orgs`

## Recommended Order

1. Decide and configure a beta/custom domain.
2. Choose an email provider, then wire provider delivery after credentials
   exist.
3. Keep Billing/ECPay disabled until Stage 2 paid Beta.
4. Apply migrations `033`, `034`, and `036` only when their matching runtime
   feature is needed and explicitly authorized.

## Current Head Deployment Handoff

Status: completed on 2026-06-12 for `796a02a` /
`dpl_28RhEVo2Nespq7xjTEQvmELag34r`.

Use this pattern only for a future new remote `develop-saas` HEAD:

```text
I authorize deploying current origin/develop-saas HEAD to Vercel production
project smart-return-system-saas. The deployed HEAD must include the target
commit named in my current authorization.

Scope:
- Run preflight and safety checks first.
- Run npm run saas:predeploy before deploy.
- Deploy only smart-return-system-saas.
- Do not configure domain/DNS.
- Do not run migration.
- Do not edit env/secrets.
- Do not enable email provider.
- Do not enable billing/provider.
- Do not touch master/live/internal Supabase.

After deploy, run production smoke tests, update docs, commit, and push
develop-saas.
```

## Sentry DSN

Status: complete for Vercel Production.

Already configured:

- SaaS-only `SENTRY_DSN`
- Browser-side `NEXT_PUBLIC_SENTRY_DSN`
- Production deployment after env update:
  `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`

Keep these rules for future rotation:

- SaaS-only `SENTRY_DSN`
- Optional browser-side `NEXT_PUBLIC_SENTRY_DSN`
- Confirmation that values should be set on Vercel project
  `smart-return-system-saas`

Handoff after values are available:

```text
I authorize setting SaaS-only Sentry env vars on Vercel project
smart-return-system-saas.

Values:
- SENTRY_DSN=<provided out-of-band>
- NEXT_PUBLIC_SENTRY_DSN=<optional, provided out-of-band>

Scope:
- Set Vercel Production env only unless I explicitly include Preview/Development.
- Do not commit DSN values.
- Do not run migration.
- Do not enable billing/provider.
- Do not touch master/live/internal Supabase.

After setting env, run safety and rollout checks. Do not deploy unless I
separately authorize a redeploy. Update docs and push develop-saas.
```

## Beta Or Custom Domain

Owner selected:

- Target domain: `app.smart-return.tw`

Latest attempt:

- Earlier `npx vercel domains add app.smart-return.tw` printed a success message for
  project `smart-return-system-saas`, but the CLI then failed to fetch the
  domain with Vercel 403 access errors.
- Earlier `npx vercel domains inspect app.smart-return.tw` failed with "You don't have
  access to the domain".
- Earlier `npx vercel alias set <current-production-deployment> app.smart-return.tw`
  failed with the same Vercel 403 domain access error.
- During the 2026-06-12 production deployment, Vercel CLI auto-listed
  `https://app.smart-return.tw` as an alias for deployment
  `dpl_28RhEVo2Nespq7xjTEQvmELag34r` and reported asynchronous SSL creation.
- Local DNS lookup still does not resolve `app.smart-return.tw`.
- Because DNS is still unresolved and SSL is asynchronous, treat
  `https://app.smart-return.tw` as not ready until a direct DNS/HTTPS smoke test
  passes.

Owner must still provide or perform:

- DNS provider access or the exact DNS records owner will set manually
- A DNS record for the app subdomain. Start with:
  - Type: `CNAME`
  - Name/Host: `app`
  - Value/Target: `cname.vercel-dns.com`
- If the Vercel dashboard shows a domain ownership `TXT` verification record,
  add that exact TXT record first, then retry verification/alias.
- Confirmation whether `NEXT_PUBLIC_APP_URL` should move to the new domain
  after Vercel confirms the domain is ready

Handoff after DNS is set or DNS access is available:

```text
I authorize retrying custom domain verification for app.smart-return.tw on
Vercel project smart-return-system-saas.

Scope:
- Add/configure only this SaaS domain.
- Update NEXT_PUBLIC_APP_URL only after Vercel confirms the domain is ready.
- Do not configure unrelated domains.
- Do not run migration.
- Do not enable billing/provider.
- Do not touch master/live/internal Supabase.

Report required DNS records if they must be set outside Vercel. After the
domain is ready, run smoke tests, update docs, commit, and push develop-saas.
```

## Email Provider

Owner must provide:

- Provider: Resend, Postmark, SendGrid, or SMTP
- API key or SMTP credentials
- Verified sender domain or sender email
- Desired from name and from address
- Whether invites and notification emails should be enabled immediately

Handoff after credentials are available:

```text
I authorize wiring email provider delivery for the SaaS project.

Provider:
- <provider name>

Sender:
- From name: <name>
- From email: <email>

Scope:
- Keep secrets out of git.
- Set env only on smart-return-system-saas.
- Keep billing disabled.
- Do not run migration unless I separately authorize migration 034.
- Do not touch master/live/internal Supabase.

Add or enable the provider adapter, keep dry-run behavior available, run tests,
then update docs and push develop-saas.
```

## Billing / ECPay

Owner must provide:

- ECPay merchant ID
- Hash key
- Hash IV
- Environment choice: sandbox or production
- Public pricing decision and whether Stage 2 paid Beta is authorized
- Explicit approval for `ENABLE_BILLING=true`

Handoff after Stage 2 is approved:

```text
I authorize Stage 2 billing setup for smart-return-system-saas.

Provider:
- ECPay <sandbox|production>

Credentials:
- ECPAY_MERCHANT_ID=<provided out-of-band>
- ECPAY_HASH_KEY=<provided out-of-band>
- ECPAY_HASH_IV=<provided out-of-band>

Flags:
- ENABLE_BILLING=true
- BILLING_PROVIDER=ecpay

Scope:
- Configure SaaS project only.
- Do not touch master/live/internal Supabase.
- Do not apply migration 033 unless I explicitly include that authorization.
- Run rollout checks and webhook signature tests before deploy.
- Update docs and push develop-saas.
```

## Draft Migrations 033-038

These require explicit per-migration authorization. Do not apply them as a
bundle. Migrations `035` and `037` have already been applied to the SaaS
project after explicit owner authorization; the remaining unapplied drafts are
`033`, `034`, `036`, and `038`.

### `033_saas_platform_billing_operations.sql`

Purpose:

- Adds `perform_platform_billing_operation()` for manual payment marking,
  suspend/resume, refund request, and audit logging.

Recommended timing:

- Stage 2 billing operations.
- After billing operations SOP is accepted.
- After backup and post-migration smoke plans are ready.

Risk:

- Can change organization and subscription status through service-role RPC.
- Should not be enabled casually during Manual Beta.

Recommendation:

- Do not apply now unless manual billing operations are immediately needed.

### `034_saas_notification_email_queue.sql`

Purpose:

- Adds notification delivery metadata and `email_queue`.
- Queue remains service-role only.

Recommended timing:

- Before real notification delivery or email worker persistence is needed.

Risk:

- Low to medium. It adds storage and notification fields but does not send email
  by itself.

Recommendation:

- Can be applied before provider wiring if queue persistence is desired, but it
  is not required while email remains dry-run.

### `035_saas_onboarding_completion_rpc.sql`

Status:

- Applied to SaaS Supabase project `auyznbwtjvemyamujmgt` on 2026-06-06 after
  explicit owner authorization.
- Remote migration history records version `035` as applied.
- Do not reapply unless a future repair/rollback plan is explicitly approved.

Purpose:

- Adds `complete_organization_onboarding()` RPC and audit write.
- Unblocks the `/onboarding` completion write path.

Recommended timing:

- First migration to consider if owner wants the onboarding completion button to
  persist state.

Risk:

- Low. It updates `organizations.onboarding_completed_at` and writes audit logs.

Recommendation:

- Completed. Next migration actions remain `033`, `034`, `036`, and `038`, each only
  after separate owner authorization.

### `036_saas_platform_admin_roles.sql`

Purpose:

- Adds DB-backed `platform_admin_roles`.
- Adds role management RPC for owner/support/billing platform roles.

Recommended timing:

- When platform admin roles need to move from env/profile sources into DB-backed
  management.

Risk:

- Medium. Incorrect rollout can lock out or over-grant platform access if the
  role source switch is not staged carefully.

Recommendation:

- Do not apply until a seed/owner role plan and rollback path are written.

### `037_saas_team_invite_status.sql`

Status:

- Applied to SaaS Supabase project `auyznbwtjvemyamujmgt` on 2026-06-26 after
  explicit owner authorization.
- Remote migration history records version `037` as applied.
- Do not reapply unless a future repair/rollback plan is explicitly approved.

Purpose:

- Adds `organization_invites.status` for `pending`, `accepted`, `expired`, and
  `revoked`.
- Backfills accepted and expired invite rows.
- Refreshes invite accept/create RPCs after the column exists so merchant team
  invite revoke/resend works against the real SaaS DB.

Recommended timing:

- Completed. This now unblocks real SaaS DB QA for merchant team management P1
  invite revoke/resend.

Risk:

- Low to medium. It changes invite lifecycle persistence and RPC behavior, but
  only inside `organization_invites` and invite accept/create flows.

Recommendation:

- Completed. Run `/settings/team` browser QA before any production deploy that
  depends on the P1 team-management UI.

### `038_saas_org_member_visibility.sql`

Purpose:

- Adds `public.is_organization_member(...)` as a helper-backed,
  `SECURITY DEFINER` membership check.
- Adds a non-recursive `organization_members` SELECT policy so authenticated
  active members can read same-org member rows.
- Unblocks owner/admin `/settings/team` QA where the normal authenticated RLS
  client must list staff/viewer/admin rows in the same organization.

Recommended timing:

- Before the next full real-DB `/settings/team` browser QA run.
- Before deploying or broadly validating team-management P1 member role-change
  and disable flows against production data.

Risk:

- Low to medium. It broadens authenticated reads from "own membership row" to
  "same organization membership rows." This is required for owner/admin team
  management, but should be applied only to the SaaS project and verified with
  cross-org negative tests.

Recommendation:

- Apply only after explicit owner authorization for `038`; do not bundle with
  `033`, `034`, or `036`.

## Migration Authorization Template

Use this only after choosing one migration:

```text
I authorize applying migration <033|034|036|038> to the SaaS Supabase project
auyznbwtjvemyamujmgt only.

Scope:
- Run preflight and safety checks first.
- Confirm target project is auyznbwtjvemyamujmgt.
- Do not touch internal/live Supabase.
- Do not deploy unless I separately authorize deployment.
- Do not enable billing/provider unless I separately authorize it.
- Record before/after checks and update docs.
- Commit and push documentation updates to develop-saas.
```

## Do Not Do Without Separate Approval

- Do not set secrets from chat-visible values unless the owner confirms they are
  safe to use that way.
- Do not commit DSN, API keys, ECPay credentials, SMTP credentials, or DNS
  tokens.
- Do not apply migrations `033`-`038` as a bundle. `035` and `037` are already
  applied; the remaining unapplied drafts are `033`, `034`, `036`, and `038`.
- Do not enable `ENABLE_PUBLIC_SIGNUP=true` as part of these actions.
- Do not enable `ENABLE_BILLING=true` during Closed Manual Beta.
- Do not change `master`.
- Do not touch internal/live Supabase projects.
