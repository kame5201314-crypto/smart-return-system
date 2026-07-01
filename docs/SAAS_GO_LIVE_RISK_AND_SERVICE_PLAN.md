# SaaS Go-Live Risk And Service Plan

Last updated: 2026-07-01

This document turns the current launch discussion into an ordered execution
plan for the SaaS commercial version. It is intentionally limited to the
`develop-saas` SaaS checkout and does not authorize deployment, Supabase
migrations, Vercel environment changes, billing/provider enablement, DNS
changes, or live/internal project work by itself.

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

- Applying `038_saas_org_member_visibility.sql` to SaaS Supabase.
- Read-only Vercel Production `/admin` and `/internal` env/route verification.
- Disposable-org browser QA that writes test return/team data.
- Invoice/legal/payment collection actions.
- Any deployment, env change, provider enablement, billing change, DNS change,
  or live/internal Supabase action.

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

## Executive Decision

| Stage | Decision | Reason |
|---|---|---|
| Closed free/manual Beta | Green with controlled scope | Core merchant workspace, platform admin privacy boundary, tenant isolation hardening, Sentry, security headers, and 499/699 plan contract are in place. |
| First paid manual customer | Yellow | Invoice/receipt workflow, legal wording, refund handling, and payment records must be operational before collecting money. |
| Public self-serve paid launch | Red | ECPay recurring billing, email delivery, public signup/self-serve provisioning, lifecycle jobs, and provider-backed invoice flow are not enabled. |

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
| A1 | Apply `038_saas_org_member_visibility.sql` if testing team management | 499/699 plans include seats; owner/admin must be able to see same-org members for role changes and disable flows. | Draft migration exists; not applied. | Requires explicit owner authorization before touching SaaS Supabase. |
| A2 | Confirm production `/internal` access for platform operators | Platform operations backend must be usable to follow tenant health and usage. | Code supports `/admin` -> `/internal`; production env must be verified separately. | Owner/Codex must verify Vercel env and platform admin identity source before relying on production `/internal`. |
| A3 | Run merchant-to-platform QA on a disposable org | Confirms merchant usage and AI analysis aggregate into `/internal` without exposing return detail/PII. | QA plan exists in `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md`; automated privacy-boundary tests exist. | Use QA org only; do not use real customers. |

### Acceptable Temporary Limits

- Billing stays disabled: `ENABLE_BILLING=false`.
- Email delivery stays dry-run; invite links may be copied manually.
- Custom domain stays deferred; use `https://smart-return-system-saas.vercel.app`.
- Team management can be postponed only if early Beta tenants use one owner
  account and do not need multi-member testing.

## Stage 2: First Paid Manual Customers

### Required Before Collecting Any Payment

| ID | Item | Minimum safe solution | Owner/Codex split |
|---|---|---|---|
| B1 | Invoice/receipt capability | Confirm the business can legally issue an invoice or receipt before collecting the first payment. Manual ECPay invoice console or accountant-issued invoice is acceptable for Stage 2. | Owner/legal/accounting |
| B2 | Legal pages no longer say draft for paying customers | Terms, privacy, and refund pages currently describe Beta/draft posture. Before paid launch, finalize company entity, tax/invoice handling, data retention, subprocessors, and refund rules. | Owner/legal plus UI/docs update |
| B3 | Invoice status alignment if storing invoices in-app | If invoice rows are written to the SaaS DB, apply `030_saas_invoice_status_alignment.sql` first so DB status values match billing UI/backend DTOs. | Owner authorization + Codex |
| B4 | Manual payment tracking SOP | Record who paid, period covered, invoice/receipt number, refund decisions, and any manual account status changes. | Repo-side SOP drafted in `SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`; future platform billing ops use `033` |
| B5 | Support SLA and onboarding checklist | Low-price plans only work if support load is controlled. Define response channel, response window, and self-serve onboarding steps. | Repo-side SOP drafted in `SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`; owner still confirms real support policy |

### Do Not Enable Yet

- Do not enable `ENABLE_BILLING=true`.
- Do not advertise automatic recurring billing.
- Do not promise automatic invoices until ECPay invoice integration is built and
  tested end to end.

## Stage 3: Public Self-Serve Paid Launch

| Area | Blocker | Required solution |
|---|---|---|
| Public signup | Signup is still controlled/manual; public self-serve org creation is not the active rollout posture. | Decide public signup posture, wire form -> request/provisioning flow, and keep abuse/rate limits. |
| Email | Email queue is dry-run only. | Add provider adapter, preferably Resend first, with templates, retry/status updates, and delivery tests. |
| ECPay billing | Webhook foundation exists but recurring authorization, processor, subscription updates, invoice issuing, and reconciliation are not ready. | Build and sandbox-test recurring payment lifecycle before enabling billing. |
| Subscription lifecycle | Trial expiry, failed payment, grace period, read-only/past_due/suspended transitions must be automatic. | Add scheduled jobs and operator alerts, then test past_due/suspended/cancelled cases. |
| Platform admin roles | DB-backed platform admin role management uses draft `036`. | Apply `036` only when owner wants DB-managed platform admin roles; keep env mapping until then. |
| Operational monitoring | Sentry is configured, but business alerts for trial expiry, quota overage, payment failure, and AI cost are still manual. | Add notification/ops alert pipeline after email/provider decision. |

## Subscription And Service Risks

### Pricing Risk

499/699 is competitive, but support time is the real cost driver.

Mitigation:

- Keep 499 low-touch and self-serve.
- Use 699 as the recommended plan with advanced analytics and higher usage.
- Treat repeated overage as a sales trigger, not a silent free upgrade.
- Keep enterprise quote-only for high-volume, multi-brand, API, warehouse, or
  SLA needs.

### Usage Risk

The plan contract currently defines:

- Basic: NT$499, 3 seats, 300 monthly returns, 10 AI analyses, no advanced
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

1. Apply only `038_saas_org_member_visibility.sql` to SaaS Supabase if
   multi-member team QA is required.
2. Verify production `/internal` has the correct Vercel env and platform admin
   identity.
3. Run the manual QA path in
   `docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md` against a disposable QA org.

### Prepare Before First Paid Customer

4. Confirm invoice/receipt capability.
5. Finalize terms/privacy/refund pages for paying customers.
6. Decide whether invoice rows will be stored in-app; if yes, authorize only
   migration `030`.
7. Create a manual payment and refund SOP.

### Defer Until Public Paid Launch

8. Resend/email delivery.
9. ECPay recurring billing and invoice integration.
10. Public self-serve signup.
11. DB-backed platform admin role migration `036`.
12. Automated lifecycle and operations alerts.

## Authorization Templates

### Apply Team Visibility Migration 038

```text
I authorize applying only supabase/migrations/038_saas_org_member_visibility.sql
to SaaS Supabase project auyznbwtjvemyamujmgt.
Do not deploy, do not apply other migrations, do not edit env/secrets, do not
enable email/billing/provider, and do not touch master/live/internal Supabase.
```

### Apply Invoice Status Migration 030

```text
I authorize applying only supabase/migrations/030_saas_invoice_status_alignment.sql
to SaaS Supabase project auyznbwtjvemyamujmgt.
Do not deploy, do not apply other migrations, do not edit env/secrets, do not
enable email/billing/provider, and do not touch master/live/internal Supabase.
```

### Verify Production Platform Admin Env

```text
I authorize a read-only check of Vercel project smart-return-system-saas
Production env names and production route smoke for /admin and /internal.
Do not change env values, do not deploy, do not run migrations, do not enable
email/billing/provider, and do not touch master/live/internal Supabase.
```
