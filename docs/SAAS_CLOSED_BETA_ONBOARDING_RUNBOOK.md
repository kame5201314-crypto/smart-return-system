# SaaS Closed Beta Onboarding Runbook

Last updated: 2026-07-01

This runbook is for manually onboarding the first closed Beta merchants to the
SaaS commercial version. It does not authorize deployments, Supabase
migrations, Vercel env changes, billing/provider enablement, DNS changes, or
live/internal project work by itself.

## Scope

Use this runbook only for controlled Manual Beta customers.

| Surface | Production URL | User |
|---|---|---|
| Public site | `https://smart-return-system-saas.vercel.app/` | Prospects |
| Merchant AI return system | `https://smart-return-system-saas.vercel.app/login` -> `/analytics` | Merchant owner/admin/staff/viewer |
| Commercial operations backend | `https://smart-return-system-saas.vercel.app/admin` -> `/internal` | Platform operator |

Do not promise:

- Automatic email delivery. Email remains dry-run until a provider is
  explicitly enabled.
- Automatic ECPay billing or recurring payments.
- Automatic invoice issuing.
- Public self-serve signup.
- Custom domain availability.
- Automatic official website or momo imports. Current copy should describe
  Shopee as automated and official website/momo as manual entry unless a future
  integration is explicitly built.

## Before Inviting A Merchant

Confirm these facts first:

| Item | Required |
|---|---|
| Merchant name | Yes |
| Owner email | Yes |
| Plan | `basic`, `growth`, or `enterprise discussion` |
| Trial or manual payment status | Yes |
| Support channel | Email or LINE |
| Whether team members are needed | Yes |
| Whether real customer data will be imported during onboarding | Yes |

If the merchant needs more than one account, first run `/settings/team` QA in a
disposable organization. Migration `038_saas_org_member_visibility.sql` is
already applied to the SaaS project, so owner/admin member visibility is no
longer schema-blocked; do not invite real staff until the disposable-org flow
passes.

## Account Handoff Rules

- Never paste temporary passwords into Git, docs, chat transcripts, or issue
  trackers.
- Share passwords only through the owner-approved secure channel.
- Ask the merchant owner to change/store the password immediately.
- If the password is lost, reset only that merchant owner account and avoid
  touching other organizations.

Suggested handoff message:

```text
Smart Return Beta account is ready.

Login:
https://smart-return-system-saas.vercel.app/login

Your first screen after login should be the data center.
Please change/store the temporary password before importing real data.

Current Beta scope:
- Shopee returns can be imported/managed in the system.
- Official website and momo returns can be entered manually.
- AI analysis is available within your plan quota.
- Email automation and automatic billing are not enabled during this Beta.

If you hit an issue, send a screenshot plus the page URL through the agreed
support channel.
```

## First Session Walkthrough

Run this in a short guided session or ask the merchant to follow it.

1. Open `/login` and sign in as the merchant owner.
2. Confirm redirect to `/analytics`.
3. Open `/shopee-returns`.
4. Import or review Shopee return rows.
5. Open `/returns` and confirm the return list is visible.
6. Manually create one non-Shopee return only if the merchant needs official
   website/momo tracking during Beta.
7. Open `/analytics/ai-report`.
8. Run one AI analysis on the Beta dataset.
9. Open `/settings/usage` and confirm:
   - Basic: 3 seats, 300 monthly returns, 10 AI analyses.
   - Growth: 5 seats, 800 monthly returns, 25 AI analyses.
10. If team management is needed, open `/settings/team` in a disposable QA org
    first and test invite, role change, disable, revoke, and resend before
    inviting real staff.

Stop if:

- The merchant sees another organization's data.
- `/internal` is visible to a merchant account.
- AI usage does not appear to count against the merchant's organization.
- A protected route loads without login.

## Operator Follow-Up In `/internal`

After the merchant finishes the first session, the platform operator should
check `/internal` and `/internal/orgs`.

Expected:

- Tenant count includes the merchant organization.
- Plan/status are correct.
- Return and AI usage summaries reflect the merchant activity.
- Platform admin views do not expose buyer names, phone numbers, addresses,
  order numbers, return reasons, images, or return-detail tables.

If `/internal` is gated in production, verify platform admin identity and env
configuration before relying on it for Beta operations. Do not change env values
without explicit owner authorization.

## Daily Beta Follow-Up

For each active Beta merchant, track:

| Field | Notes |
|---|---|
| Organization name / id | Use the SaaS org UUID when possible. |
| Owner email | Do not store passwords. |
| Plan | Basic/Growth/Enterprise discussion. |
| Return count | Watch for repeated overage. |
| AI usage | Watch for quota pressure or unusual cost. |
| Open support issues | Keep issue notes short and avoid raw personal data. |
| Next follow-up date | Do not let trial/payment follow-up rely on memory. |

## Escalation Rules

Escalate to owner review when any of these happen:

- Merchant exceeds plan return limits for 2-3 consecutive months.
- Merchant repeatedly uses most AI quota and asks for more.
- Merchant needs API, custom import, multi-brand, multi-warehouse, SLA, or
  repeated consulting.
- Merchant asks for legal review, DPA, data deletion, invoice details, or
  security questionnaire.
- Merchant is ready to pay.

Before collecting money, follow
[`SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md`](./SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md)
and confirm invoice/receipt capability plus final paid legal wording.

## Recommended First Beta Acceptance Criteria

Closed Beta is healthy enough to continue when:

1. Merchant can sign in and reach `/analytics`.
2. Merchant can import or create return data under its own organization.
3. Merchant can run AI analysis and understand the result.
4. Merchant can see usage/limits in settings.
5. Platform operator can see tenant health and usage in `/internal`.
6. No merchant account can access `/internal`.
7. No platform view exposes customer return details or buyer PII.
8. Support issues are mostly workflow questions, not data isolation or auth
   failures.
