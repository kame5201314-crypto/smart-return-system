# SaaS Go-Live Risk And Service Plan

Last updated: 2026-07-20

This document turns the current launch discussion into an ordered execution
plan for the SaaS commercial version. It is intentionally limited to the
`develop-saas` SaaS checkout and does not authorize deployment, Supabase
migrations, Vercel environment changes, billing/provider enablement, DNS
changes, or live/internal project work by itself.

## 2026-07-20 Prepaid Billing Stage And Schema Rollout

- The current MVP Billing model is one-month prepaid: Basic NT$399 and Growth
  NT$699, with no automatic renewal or card storage.
- Migrations `045`-`048` are applied only to SaaS project
  `auyznbwtjvemyamujmgt` and must not be rerun. The migration and strict Billing
  schema gates passed.
- Preview ECPay Stage completed a Basic NT$399 3D-verified payment, signed
  callback verification, independent payment query, and paid-period creation.
- Production deployment `dpl_E1MZVpRMiZhULVnQEuo165AyHVx4` is Ready with the
  code, but formal Production ECPay credentials are not supplied and the
  Billing/subscription flags remain disabled. Production activation and a real
  charge require a separate owner-approved rollout.

## 2026-07-01 Local Execution Pass

The local, non-external portion of this plan has been executed in the
`develop-saas` checkout.

Completed:

- `npm run safety:agent-boundary`
- `npm run lint`
- `npm run typecheck`
- `npm run saas:migration-plan:strict`
- `npm run saas:schema-gate:strict`
- `npm run test:all`
- `npm run saas:doctor`
- `npm run build`

Result:

- Local gate status: pass.
- `saas:doctor`: 165 pass, 1 expected local warning, 0 fail.
- The warning is `ENABLE_MULTI_TENANT_ADMIN=true` in local env, which is a
  local platform-admin preview posture and not a code failure.

Not executed because they require explicit owner authorization or external
credentials/state:

- Disposable-org browser QA that writes test return/team data.
- Invoice/legal/payment collection actions.
- Any deployment, env change, provider enablement, billing change, DNS change,
  or live/internal Supabase action.

## 2026-07-01 Production Admin Read-Only Verification

The read-only production admin check has been executed.

Verified:

- Vercel Production env names include `ENABLE_MULTI_TENANT_ADMIN`,
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`.
- Vercel Production env names do not list `PLATFORM_ADMIN_ROLES`.
- Production deployment `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76` is Ready.
- `/admin` and `/internal` redirect to the platform-admin login path when
  unauthenticated.
- `/admin/login?next=%2Finternal` redirects to the shared login page with the
  internal next path preserved.
- `npm run saas:production-smoke` passes with 16 pass, 0 warn, 0 fail.

Not verified:

- Authenticated platform-admin login, because this check did not use platform
  admin credentials.

Not changed:

- No env values, secrets, deployments, migrations, providers, billing, DNS, or
  live/internal Supabase state were modified.

## 2026-07-01 Manual Payment And Support SOP

Added [`SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`](./SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md)
to cover the non-external operating work that can be prepared before automated
billing/email is enabled.

This completes the repo-side draft for:

- Manual payment tracking fields.
- Manual payment workflow.
- Manual refund review workflow.
- Low-touch support SLA for Basic/Growth.
- Beta onboarding checklist.
- Escalation triggers for overage, high support demand, legal/privacy, and
  enterprise needs.

This SOP does not collect money, issue invoices, apply migrations, enable
billing, or change provider state. Owner/legal/accounting still must confirm
invoice/receipt capability before collecting payment.

## 2026-07-01 Closed Beta Onboarding Runbook

Added
[`SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md`](./SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md)
as the operator-facing walkthrough for the first closed Beta merchants.

This completes the repo-side draft for:

- Merchant account handoff rules without storing passwords in docs/chat/Git.
- First-session walkthrough from `/login` to `/analytics`,
  `/shopee-returns`, `/returns`, `/analytics/ai-report`, and `/settings/usage`.
- Manual explanation of Shopee automated import versus official website/momo
  manual entry.
- Platform operator follow-up in `/internal`.
- Daily Beta follow-up fields and escalation rules.

This runbook does not provision accounts, apply migrations, change production
env, collect money, enable email/billing, or alter provider state.

## 2026-07-01 Privacy, DPA, And Data Deletion SOP

Added [`SAAS_PRIVACY_DPA_DELETION_SOP.md`](./SAAS_PRIVACY_DPA_DELETION_SOP.md)
to cover the repo-side privacy operating plan required before paid/public
rollout.

This completes the repo-side draft for:

- Data categories and draft retention defaults.
- Subprocessor register draft.
- Merchant data deletion request workflow.
- DPA checklist for merchant customers.
- Security incident workflow.
- Cookie/analytics tracking checklist.

This SOP does not finalize legal terms, change public legal pages, delete data,
apply migrations, enable providers, or change production settings. Owner/legal
must still review and approve the public legal wording before paid customers are
accepted.

## 2026-07-01 Production Deployment Completed

Owner authorized deploying latest `develop-saas` HEAD
`3fadd75 docs(saas): record production deployment gap` to Vercel Production
project `smart-return-system-saas`.

Deployment result:

- Vercel deployment: `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76`
- Production alias: `https://smart-return-system-saas.vercel.app`
- Deployment status: Ready
- Deployment URL:
  `https://smart-return-system-saas-jq1nrrc1k-kaweis-projects.vercel.app`

Production smoke:

- `/`, `/pricing`, `/signup`, `/login`, `/robots.txt`, and `/sitemap.xml`
  return `200`.
- unauthenticated `/internal` redirects to `/admin/login?next=%2Finternal`.
- tenant protected routes redirect to `/login`.
- `/pricing` shows the 499/699 pricing markers and no longer exposes the old
  `1,490` / `2,990` markers in the checked response.

Result:

- The 499/699 pricing contract and multi-channel honesty copy are now visible
  on production.
- No migration, env/secret edit, provider enablement, DNS change, billing
  enablement, or live/internal Supabase action was performed by this deploy.

## Executive Decision

| Stage | Decision | Reason |
|---|---|---|
| Closed free/manual Beta | Green with controlled scope | Core merchant workspace, platform admin privacy boundary, tenant isolation hardening, Sentry, security headers, and 399/699 plan contract are in place. |
| First paid manual customer | Yellow | Invoice/receipt workflow, legal wording, refund handling, and payment records must be operational before collecting money. |
| Public self-serve paid launch | Yellow | Prepaid code, migrations, and Stage E2E are complete. Formal Production ECPay credentials, owner-approved Billing flags, bounded real-charge/refund/reconciliation smoke, and legal/invoice operations remain before collecting money. |

The product can be tested with a small set of manually provisioned Beta
customers. It should not be marketed as a fully self-serve paid SaaS until the
Stage 2 blockers below are resolved.

## Current Architecture Boundary

| Surface | URL | User | Purpose |
|---|---|---|---|
| Merchant AI return system | `/login` -> `/analytics` | Tenant owner/admin/staff/viewer | Import/manage returns, Shopee returns, pickup records, logistics lookup, AI return analysis, team/settings. |
| Commercial operations backend | `/admin` -> `/internal` | Platform operator | View tenant count, subscriptions/trial posture, usage health, and follow-up alerts without customer return details. |

There should not be a third backend. Public marketing/legal pages are the
website front door; `/portal` routes are buyer-facing return portal pages, not
merchant or platform backends.

## Stage 1: Closed Free/Manual Beta

### Must Complete Before Inviting Multi-User Beta Customers

| ID | Item | Why it matters | Current repo state | Action |
|---|---|---|---|---|
| A1 | Team member visibility schema for team management | 399/699 plans include seats; owner/admin must be able to see same-org members for role changes and disable flows. | Migration `038` is applied to SaaS project `auyznbwtjvemyamujmgt`; same-org `organization_members` SELECT is helper-backed and non-recursive. | Run disposable-org `/settings/team` QA before inviting real multi-member merchants. |
| A2 | Confirm production `/internal` access for platform operators | Platform operations backend must be usable to follow tenant health and usage. | Read-only env/route verification is complete; `PLATFORM_ADMIN_ROLES` is not configured, while admin username/password env names exist. | If per-email operator roles are needed, set `PLATFORM_ADMIN_ROLES`; authenticated login still needs credentials-based QA. |
| A3 | Run merchant-to-platform QA on a disposable org | Confirms merchant usage and AI analysis aggregate into `/internal` without exposing return detail/PII. | QA plan exists in `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md`; automated privacy-boundary tests exist. | Use QA org only; do not use real customers. |
| A4 | Use the closed Beta onboarding runbook for the first merchant session | Keeps customer handoff, scope promises, AI walkthrough, and operator follow-up consistent. | Runbook exists in `docs/SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md`. | Use it for every first-session onboarding; do not store passwords in docs/chat/Git. |

### Acceptable Temporary Limits

- Billing stays disabled: `ENABLE_BILLING=false`.
- Email delivery stays dry-run; invite links may be copied manually.
- Custom domain stays deferred; use `https://smart-return-system-saas.vercel.app`.
- Team management schema is no longer blocked by `038`, but browser QA should
  still use a disposable org before real staff are invited.

## Stage 2: First Paid Manual Customers

### Required Before Collecting Any Payment

| ID | Item | Minimum safe solution | Owner/Codex split |
|---|---|---|---|
| B1 | Invoice/receipt capability | Confirm the business can legally issue an invoice or receipt before collecting the first payment. Manual ECPay invoice console or accountant-issued invoice is acceptable for Stage 2. | Owner/legal/accounting |
| B2 | Legal pages no longer say draft for paying customers | Terms, privacy, and refund pages currently describe Beta/draft posture. Before paid launch, finalize company entity, tax/invoice handling, data retention, subprocessors, and refund rules. | Owner/legal plus UI/docs update |
| B3 | Invoice status alignment if storing invoices in-app | Migration `030_saas_invoice_status_alignment.sql` is already applied as part of the chain through `032`. Before writing invoice rows, verify remote history and the live schema/DTO contract; do not rerun `030`. Any future change requires a new migration. | Codex read-only verification; owner authorization for any new migration |
| B4 | Manual payment tracking SOP | Record who paid, period covered, invoice/receipt number, refund decisions, and any manual account status changes. | Repo-side SOP drafted in `SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`; future platform billing ops use `033` |
| B5 | Support SLA and onboarding checklist | Low-price plans only work if support load is controlled. Define response channel, response window, and self-serve onboarding steps. | Repo-side SOP drafted in `SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`; owner still confirms real support policy |
| B6 | Privacy, DPA, retention, and deletion SOP | Paid customers may ask how buyer data is retained, deleted, processed by subprocessors, and handled during incidents. | Repo-side SOP drafted in `SAAS_PRIVACY_DPA_DELETION_SOP.md`; owner/legal still finalizes public legal wording |

### Do Not Enable Yet

- Do not enable `ENABLE_BILLING=true`.
- Do not advertise automatic recurring billing.
- Do not promise automatic invoices until ECPay invoice integration is built and
  tested end to end.

## Stage 3: Public Self-Serve Paid Launch

| Area | Blocker | Required solution |
|---|---|---|
| Public signup | Google 3-day self-service trial is live；Email/Phone verified signup remains closed. | Migration `044` is already applied. Complete provider/CAPTCHA setup, disposable-account smoke, and per-channel flag rollout while keeping abuse/rate limits. |
| Account recovery | Repository recovery is complete but both channel flags and providers remain off. | Complete six-digit SMTP/SMS templates, CAPTCHA secrets, disposable-account smoke, then enable one channel at a time. |
| Email | Email queue is dry-run only. | Add provider adapter, preferably Resend first, with templates, retry/status updates, and delivery tests. |
| ECPay billing | One-month prepaid checkout, verified settlement, paid-period history, migrations, and Stage E2E are complete. Production credentials and flags remain closed. | Supply formal Production credentials out of band, run the approved real-charge/refund/reconciliation smoke, and keep recurring billing/card storage outside the current MVP. |
| Subscription lifecycle | Google self-service trial expiry and post-expiry read-only are live; failed payment, grace period, and paid cancellation remain incomplete. | Add paid lifecycle jobs and operator alerts, then test past_due/suspended/cancelled cases before Billing. |
| Platform admin roles | DB-backed platform admin role management uses draft `036`. | Apply `036` only when owner wants DB-managed platform admin roles; keep env mapping until then. |
| Operational monitoring | Sentry is configured, but business alerts for trial expiry, quota overage, payment failure, and AI cost are still manual. | Add notification/ops alert pipeline after email/provider decision. |

## Subscription And Service Risks

### Pricing Risk

399/699 is competitive, but support time is the real cost driver.

Mitigation:

- Keep 399 low-touch and self-serve.
- Use 699 as the recommended plan with advanced analytics and higher usage.
- Treat repeated overage as a sales trigger, not a silent free upgrade.
- Keep enterprise quote-only for high-volume, multi-brand, API, warehouse, or
  SLA needs.

### Usage Risk

The plan contract currently defines:

- Basic: NT$399, 3 seats, 300 monthly returns, 10 AI analyses, no advanced
  analytics.
- Growth: NT$699, 5 seats, 800 monthly returns, 25 AI analyses, advanced
  analytics.
- Enterprise: quote-only, contract limits, API access.

Mitigation:

- Monitor AI usage and return volume by org in `/internal`.
- For one-time seasonal spikes, follow up manually.
- For 2-3 consecutive months over plan limits, move the customer to Growth or
  enterprise discussion.

### Legal And Privacy Risk

The product stores customer return data that may include buyer names, phone
numbers, addresses, order details, reasons, and images.

Mitigation before paid/public launch:

- Finalize terms/privacy/refund pages.
- Define data retention and deletion SOP.
- Publish subprocessors such as Supabase, Vercel, Gemini, ECPay, and email
  provider after provider decisions.
- Consider DPA terms for merchant customers because Smart Return processes
  buyer data on behalf of merchants.

### Platform Admin Privacy Risk

The platform admin must not become a customer return-detail viewer.

Current mitigation:

- Platform admin views are designed around tenant health, usage counts,
  subscriptions, and follow-up alerts.
- Regression tests assert platform DTOs do not leak order numbers, buyer names,
  phones, addresses, return reasons, or nested return detail rows.

Keep this boundary. Any future `/internal` feature should show aggregated
signals and account state, not customer PII.

## Ordered Next Actions

### Ready To Execute With Owner Authorization

1. Re-run the read-only production smoke check when you need to confirm the
   public site is still current:
   `npm run saas:production-smoke`.
2. Set `PLATFORM_ADMIN_ROLES` if per-email operator roles are needed; otherwise
   run authenticated platform-admin login QA with the existing admin
   credentials.
3. Run the manual QA path in
   `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md` against a disposable QA org.

### Prepare Before First Paid Customer

4. Confirm invoice/receipt capability.
5. Finalize terms/privacy/refund pages for paying customers.
6. Decide whether invoice rows will be stored in-app; if yes, verify remote
   history and the live schema include already-applied migration `030`. Do not
   rerun it; use a new separately authorized migration for any future change.
7. Use the manual payment/refund/support SOP.
8. Review the privacy/DPA/deletion SOP with legal/accounting support.

### Defer Until Public Paid Launch

9. Resend/email delivery.
10. Production prepaid ECPay credential/flag cutover and bounded
    charge/refund/reconciliation smoke. Recurring billing and provider invoice
    integration remain future scope.
11. Public self-serve signup.
12. DB-backed platform admin role migration `036`.
13. Automated lifecycle and operations alerts.

## Authorization Templates

### Historical: Apply Team Visibility Migration 038

```text
I authorize applying only supabase/migrations/038_saas_org_member_visibility.sql
to SaaS Supabase project auyznbwtjvemyamujmgt.
Do not deploy, do not apply other migrations, do not edit env/secrets, do not
enable email/billing/provider, and do not touch master/live/internal Supabase.
```

Status: completed on 2026-07-01. Remote migration history records `038` as
applied. Do not reapply unless a future repair is explicitly authorized.

### Historical: Invoice Status Migration 030

Status: already applied to SaaS project `auyznbwtjvemyamujmgt` as part of the
migration chain through `032`. The old apply template is retired. Do not
reapply `030`; verify remote history/schema read-only and create a new migration
for any future change.

### Verify Production Platform Admin Env

```text
I authorize a read-only check of Vercel project smart-return-system-saas
Production env names and production route smoke for /admin and /internal.
Do not change env values, do not deploy, do not run migrations, do not enable
email/billing/provider, and do not touch master/live/internal Supabase.
```
