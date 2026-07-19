# SaaS Manual Payment And Support SOP

Last updated: 2026-07-02

This SOP covers the manual operating path before automated ECPay billing,
provider email delivery, and public self-serve signup are enabled. It is for
the SaaS `develop-saas` commercial version only and does not authorize billing,
email provider delivery, migrations, deployment, DNS changes, or live/internal
project work by itself.

## Operating Mode

| Area | Manual Beta / early paid posture |
|---|---|
| Signup | Controlled/manual. Public signup remains closed unless owner separately authorizes a rollout. |
| Provisioning | Platform operator provisions organizations manually through the existing SaaS provisioning path. |
| Billing | `ENABLE_BILLING=false`; no automatic ECPay subscription charge. |
| Email | Dry-run only; invite links and notices are copied manually. |
| Domain | Use `https://smart-return-system-saas.vercel.app` until owner buys/registers a custom domain. |
| Production data | Never use real customer organizations for destructive QA. Use disposable QA organizations only. |

## Before Collecting The First Payment

Do not collect money until all items are true:

1. Owner confirms the business can legally issue an invoice or receipt.
2. Owner confirms whether payments are monthly, annual, or both.
3. Owner confirms the payment collection channel, such as bank transfer or
   manual ECPay invoice/payment request.
4. Owner confirms who is responsible for issuing and sending invoices/receipts.
5. Public legal pages no longer describe paid terms as unresolved drafts.
6. Payment records can be stored in an internal tracker, spreadsheet, or future
   platform billing operation; secrets and full card data must never be stored.

## Invoice, Receipt, And Legal Finalization Owner Checklist

The repository currently has public legal pages and billing DTO fields, but the
paid-customer legal/accounting content is not final. Do not claim legal review
is complete until the owner, accountant, and legal support confirm these values.

Owner must provide or approve:

| Required field | Status | Notes |
|---|---|---|
| Legal company or business name | Owner-required | Use the exact entity that will sign terms and issue invoices/receipts. |
| Taiwan tax id / business registration number | Owner-required | Required before B2B invoice or receipt wording is finalized. |
| Registered business address | Owner-required | Must match the entity used for billing/legal pages. |
| Customer-facing contact email | Owner-required | Used for billing, refund, privacy, and deletion requests. |
| Invoice/receipt method | Owner-required | Decide manual invoice/receipt, ECPay electronic invoice, or another approved channel. |
| Payment receipt owner | Owner-required | Name the operator/accounting owner who issues and records invoices/receipts. |
| Data retention period | Owner/legal-required | Current SOP contains draft defaults only; legal/accounting must confirm exact retention. |
| Personal data deletion contact | Owner/legal-required | Decide the public contact window for deletion/access requests. |
| Subprocessor list | Owner/legal-required | Confirm which vendors receive personal data before publishing privacy/DPA wording. |
| Refund review rules | Owner/legal-required | Confirm paid refund eligibility before collecting money. |

Current draft sources to review before first paid customer:

- Public terms page: `app/legal/terms/page.tsx`
- Public privacy page: `app/legal/privacy/page.tsx`
- Public refund page: `app/legal/refund/page.tsx`
- Billing settings UI: `app/(admin)/settings/billing/page.tsx`
- Billing DTO/data contract: `lib/saas/settings-billing-data.ts` and
  `agent-shared/UI_BACKEND_CONTRACTS.md`
- Privacy/deletion SOP: `docs/SAAS_PRIVACY_DPA_DELETION_SOP.md`

Do not store identity documents, full bank account data, API keys, service-role
keys, provider secrets, or card data in Git, docs, chat, or manual payment
trackers.

## Plan Matrix For Manual Sales

| Plan | Price | Use case | Limits to communicate |
|---|---:|---|---|
| Basic | NT$399/month | Small sellers that need return workflow and limited AI analysis. | 3 seats, 300 monthly returns, 10 AI analyses, no advanced analytics. |
| Growth | NT$699/month | Recommended plan for weekly return handling and team usage. | 5 seats, 800 monthly returns, 25 AI analyses, advanced analytics. |
| Enterprise | Quote-only | Multi-brand, agency, warehouse, API, custom SLA, or high support demand. | Contract-defined. |

Sales note: 399/699 should stay low-touch. If a prospect needs repeated calls,
custom import, multi-warehouse process design, API, or SLA, route them to
Enterprise instead of absorbing support cost inside a low-price plan.

## Manual Payment Record

Create one row per billing period in the chosen tracker. Required fields:

| Field | Required | Notes |
|---|---|---|
| Organization name | Yes | Must match SaaS org. |
| Organization id | Yes | Use the SaaS UUID, not only display name. |
| Plan | Yes | `basic`, `growth`, or `enterprise`. |
| Billing period start/end | Yes | Use dates, not only month name. |
| Amount TWD | Yes | Include discount if any. |
| Payment channel | Yes | Bank transfer, manual ECPay, cash, etc. |
| Payment status | Yes | `pending`, `paid`, `failed`, `refunded`, `void`. |
| Invoice/receipt status | Yes | `not_required`, `pending`, `issued`, `void`. |
| Invoice/receipt number | If issued | Do not store sensitive full payment credentials. |
| Operator | Yes | Who recorded or updated the row. |
| Notes | Optional | Keep short; do not paste secrets or raw personal data. |

If invoice rows will be stored in the SaaS database later, apply
`030_saas_invoice_status_alignment.sql` first after explicit owner
authorization so DB status values match the billing DTO/UI contract.

## Manual Payment Workflow

1. Confirm the customer wants Basic, Growth, or Enterprise discussion.
2. Confirm billing email and, if needed, tax id/invoice carrier details.
3. Confirm the billing period and amount before sending payment instructions.
4. Send payment instructions manually.
5. After payment is received, record the payment row.
6. Issue invoice/receipt through the owner-approved channel.
7. Record invoice/receipt status and number in the tracker.
8. Verify the SaaS organization plan/status matches the sold plan.
9. Do not enable automated billing flags.

## Refund Workflow

Manual refund review should follow the public refund policy until automated
billing exists.

Minimum review fields:

| Field | Required |
|---|---|
| Request date | Yes |
| Organization id | Yes |
| Original payment period | Yes |
| Payment amount | Yes |
| Refund requested amount | Yes |
| AI usage count | Yes |
| Return count | Yes |
| Export activity | Yes |
| Team invite/member activity | Yes |
| Decision | `approved`, `rejected`, or `needs_more_info` |
| Reason | Yes |
| Operator | Yes |

Operational rules:

- Do not refund from chat messages alone. Record the decision first.
- If invoice/receipt was issued, handle void/allowance rules with the
  accountant or invoice provider before sending money back.
- Do not delete org data as part of a refund unless the customer separately
  requests deletion and the data deletion SOP is followed.

## Support SLA For Low-Touch Plans

Suggested default for Manual Beta:

| Plan | Support channel | Response target | Notes |
|---|---|---|---|
| Basic | Email or LINE | 1-2 business days | No custom workflow consulting. |
| Growth | Email or LINE | 1 business day | Prioritize import, AI usage, and team setup issues. |
| Enterprise | Contract-defined | Contract-defined | May include onboarding call, SLA, and custom process review. |

Support rules:

- Keep support replies tied to product workflows: import, return management,
  Shopee returns, AI analysis, team/settings.
- Move repeated consulting, API, warehouse, or custom process requests to
  Enterprise discussion.
- Record recurring support issues as product backlog only after they affect
  multiple customers.

## Beta Onboarding Checklist

For the detailed first-session script, account handoff message, and operator
follow-up workflow, use
[`SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md`](./SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md).

Run this checklist for each manually provisioned Beta organization:

1. Confirm organization name, owner email, plan, trial/payment status, and
   billing contact.
2. Confirm the merchant enters through `/login` and lands on `/analytics`.
3. Confirm the merchant can reach:
   - `/returns`
   - `/shopee-returns`
   - `/pickup`
   - `/logistics`
   - `/analytics/ai-report`
   - `/settings`
4. Import or create a small test return dataset for that organization only.
5. Run one AI analysis if the customer will use AI during Beta.
6. Confirm `/settings/usage` shows the correct plan limits.
7. If team usage is needed, test `/settings/team` with a disposable non-owner
   member first. Migration `038` is already applied, so the remaining check is
   browser QA rather than schema authorization.
8. Confirm platform operator can view tenant status and usage in `/internal`
   without customer return details or buyer PII.
9. Record the onboarding date, owner contact, current blocker, and next follow
   up date.

## Escalation Triggers

Escalate from low-touch plan handling to owner review when any of these occur:

- Customer exceeds return limits for 2-3 consecutive months.
- Customer uses most AI quota and asks for more analyses frequently.
- Customer needs API, custom import, multi-brand, multi-warehouse, or SLA.
- Customer requests data deletion, security review, DPA, or legal review.
- Customer reports payment, invoice, privacy, or account-access issues.

## What This SOP Does Not Cover

- Automated ECPay recurring billing.
- Provider-backed email delivery.
- Public self-serve signup.
- Automatic invoice issuing.
- DB-backed platform admin role rollout.
- Supabase migrations.
- Vercel env changes.

Those remain separately authorized Stage 2/3 work.
