# SaaS Privacy, DPA, And Data Deletion SOP

Last updated: 2026-07-01

This SOP defines the operating checklist for privacy, data deletion, DPA
requests, and security incident handling before Smart Return collects paid SaaS
customers at scale. It is for the SaaS `develop-saas` commercial version only.

This document is not legal advice and does not replace lawyer/accountant
review. It also does not authorize deployment, Supabase migrations, Vercel
environment changes, provider enablement, DNS changes, or live/internal project
work by itself.

## Scope And Roles

| Role | Practical meaning |
|---|---|
| Merchant customer | The organization using Smart Return to manage returns. |
| Buyer / end customer | The merchant's customer whose return/order/contact data may be processed. |
| Smart Return | The SaaS provider that processes return data on behalf of the merchant. |
| Platform operator | Smart Return internal operator using `/internal` to monitor tenant health, usage, and account status. |

Privacy boundary:

- Merchant workspace routes such as `/analytics`, `/returns`,
  `/shopee-returns`, `/pickup`, `/logistics`, `/analytics/ai-report`, and
  `/settings` may process tenant return data.
- Platform operations routes under `/internal` must stay focused on tenant
  account state, usage counts, subscription/trial posture, and follow-up
  alerts.
- Platform operations routes must not display buyer names, phone numbers,
  addresses, raw return reasons, order numbers, return images, or nested return
  detail rows.

## Data Categories

| Category | Examples | Notes |
|---|---|---|
| Account and organization | Owner email, organization name, slug, plan, subscription status, audit records. | Needed to provide the SaaS service. |
| Team access | Member email, role, invite status, invite audit events. | Used for owner/admin/staff/viewer access control. |
| Return/order records | Order number, SKU, product name, return reason, status, channel. | Tenant-scoped by `org_id`; may include buyer personal data depending on merchant import source. |
| Buyer contact data | Name, phone, address, parcel information. | Sensitive operational data; should not appear in `/internal`. |
| Images/files | Return photos, import files, exported files, backup files. | Storage paths should remain tenant-scoped where applicable. |
| AI inputs/outputs | AI analysis request metadata, usage events, generated insights. | Avoid sending unnecessary personal data to AI providers. |
| Billing/invoice records | Billing email, tax id, invoice/receipt number, payment period, amount. | Required once paid customers are accepted. |
| Security and audit logs | Login/session audit, membership changes, billing operations, preview actions. | Keep for investigation and compliance. |

## Draft Retention Defaults

These are operating defaults until the public legal pages are finalized.

| Data | Default retention | Notes |
|---|---|---|
| Operational return data | 12 months for Basic/Growth unless contract or law requires otherwise. | Matches the current product-spec direction. |
| AI usage events | At least current billing/usage window plus audit needs. | Needed for quota, cost review, and abuse handling. |
| Team/member audit records | At least 12 months. | Needed for account access investigations. |
| Billing/invoice/payment records | Follow accounting/tax requirements. | Owner/accountant must confirm exact legal retention. |
| Backups | Provider backup retention and any separately configured SaaS backup policy. | Deletion may not immediately purge provider backups; disclose this in legal wording. |
| Security incident records | At least 12 months, preferably longer for paid customers. | Needed for postmortem and customer notice history. |

Do not promise immediate deletion from immutable logs or provider-managed
backups unless the provider capability and legal wording have been verified.

## Subprocessor Register Draft

Publish and keep current before paid/public launch.

| Subprocessor | Purpose | Status |
|---|---|---|
| Supabase | Database, Auth, Storage, backup infrastructure. | Active. |
| Vercel | Hosting, serverless/runtime, deployment, edge routing. | Active. |
| Google Gemini / Google AI | AI return analysis. | Active when AI analysis is used. |
| Sentry | Error monitoring and diagnostics. | Active; configured not to send default PII. |
| ECPay | Payments and invoices. | Planned; not enabled for Closed Manual Beta. |
| Resend or other email provider | Invite, trial, quota, and billing email delivery. | Planned; email delivery remains dry-run. |

Before adding a new provider, update this register and check whether the public
privacy page and DPA appendix need to name it.

## Data Deletion Request Workflow

Use this workflow when a merchant asks to delete tenant data, export data before
deletion, close an organization, or remove buyer data.

1. Intake the request in a durable tracker.
2. Verify requester authority:
   - Organization owner/admin for organization-wide requests.
   - Merchant contact authority for buyer-specific requests.
3. Classify the request:
   - Buyer-specific deletion.
   - User/member deletion.
   - Organization closure.
   - Trial data cleanup.
   - Backup/export cleanup.
4. Identify legal/accounting holds:
   - Payment records and invoices may need to be retained.
   - Audit/security logs may need to be retained.
   - Dispute, refund, chargeback, or legal requests may delay deletion.
5. Offer data export if the contract or policy requires it.
6. Schedule deletion or anonymization in a maintenance window.
7. Execute only against the requested tenant/org scope.
8. Verify cross-org data was not touched.
9. Record:
   - Requester.
   - Organization id.
   - Scope.
   - Operator.
   - Execution date/time.
   - Exceptions retained and why.
10. Confirm completion to the requester without exposing other tenants' data.

Do not delete real customer data as part of QA. Use disposable QA
organizations for destructive testing.

## DPA Checklist For Merchant Customers

When a merchant asks for a DPA or security review, cover these clauses before
signing or promising terms:

- Processing purpose: provide return management, AI analysis, team access,
  support, billing, and security monitoring.
- Customer instructions: Smart Return processes data according to the merchant's
  instructions and the product contract.
- Confidentiality: internal operators and subprocessors must protect customer
  data.
- Security controls: tenant isolation, RLS, authenticated access, secure
  headers, same-origin mutation guard, audit logs, backup controls, and limited
  platform admin views.
- Subprocessors: publish the current subprocessor register.
- AI provider disclosure: explain when AI analysis may send return text/product
  context to Google AI services and avoid unnecessary buyer PII.
- Data subject assistance: Smart Return assists the merchant with export,
  correction, or deletion requests within a reasonable window.
- Breach notice: define an internal target such as notifying affected merchant
  contacts without undue delay after confirming a personal-data incident, with
  a 72-hour target where practical.
- Deletion on termination: define what data is deleted, retained, exported, or
  anonymized after service ends.
- Audit support: provide reasonable written evidence or security summary for
  merchant due diligence; avoid granting direct database access.

## Security Incident Workflow

Use this when there is suspected unauthorized access, cross-tenant leakage,
lost credentials, exposed secrets, unexpected platform-admin access, or AI/data
provider misuse.

1. Triage:
   - What system is affected?
   - Which tenant/org ids are affected?
   - Is buyer personal data involved?
   - Is the incident ongoing?
2. Contain:
   - Revoke exposed credentials.
   - Disable affected accounts or sessions.
   - Roll back a bad deployment if needed.
   - Stop affected provider/job/cron path if needed.
3. Preserve evidence:
   - Keep logs, timestamps, deployment ids, request ids, and operator notes.
   - Do not paste secrets into chat, docs, or git.
4. Assess impact:
   - Data categories involved.
   - Number of affected tenants/buyers.
   - Whether data was viewed, exported, modified, or deleted.
5. Notify internally:
   - Owner/operator.
   - Legal/accounting support if paid customer or invoice/payment data is
     involved.
6. Notify customers when required:
   - Describe what happened.
   - Describe affected data categories.
   - Describe containment and next steps.
   - Provide support channel and expected follow-up timing.
7. Remediate:
   - Fix code/config.
   - Add tests or monitoring.
   - Rotate secrets if needed.
8. Postmortem:
   - Root cause.
   - Timeline.
   - Customer impact.
   - Permanent corrective actions.

## Cookie, Analytics, And Marketing Tracking

Before adding non-essential analytics, ad pixels, heatmaps, or marketing
tracking:

1. Decide whether the tool is necessary for Closed Beta.
2. Add it to the subprocessor register if it receives personal data or visitor
   identifiers.
3. Update the privacy page.
4. Add a cookie/consent posture if required.
5. Keep app/admin/internal routes free of unnecessary marketing trackers.

## Current Repo Controls To Preserve

- Platform admin DTO privacy-boundary tests must continue to assert that
  `/internal` does not leak customer return detail payloads.
- Tenant-scoped business tables and actions must keep `org_id` scoping.
- Backup and maintenance cron routes must stay gated unless explicitly enabled.
- Service-role access must stay server-side and narrowly scoped to explicit
  platform routes or maintenance jobs.
- Secrets must not be committed.

## What This SOP Does Not Do

- It does not finalize legal terms.
- It does not change public legal pages.
- It does not apply migration `030`, `033`, `034`, `036`, or `038`.
- It does not enable Billing/ECPay.
- It does not enable email delivery.
- It does not change Sentry, Vercel, Supabase, DNS, or provider settings.
- It does not delete or export any customer data.

## Next Legal/Owner Actions

Before the first paid customer:

1. Confirm the legal entity, business registration, tax id, and invoice/receipt
   capability.
2. Finalize the public Terms, Privacy Policy, and Refund Policy for paid use.
3. Decide whether to publish a DPA appendix or provide it on request.
4. Confirm retention wording, deletion windows, and backup limitations with
   legal/accounting support.
5. Confirm support contact and incident-notice contact.

