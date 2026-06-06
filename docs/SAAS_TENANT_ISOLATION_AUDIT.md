# SaaS Tenant Isolation Audit

Date: 2026-06-06
Status: P2 backup and cron gating completed locally for public multi-tenant readiness
Scope: SaaS `develop-saas` checkout only

This audit covers the current SaaS tenant isolation posture before any public multi-tenant rollout. It reviews local code, migrations, tests, and read-only schema gate output only.

No database migration was run by this refresh. No env/secret, deploy, provider, master/live/prod, or production/internal Supabase change was made.

## Executive Summary

The SaaS project has moved past the original draft state:

- The dedicated SaaS schema chain is applied through `032`.
- `npm run saas:schema-gate:strict` passes read-only with `22 table(s), 81 column(s) checked`.
- `025_attach_org_id_to_business_tables.sql` is present and the SaaS schema gate verifies the required `org_id` columns for core customer/business tables.
- P0 runtime isolation has been added for `lib/actions/return.actions.ts`, `app/api/v1/ai/analyze/route.ts`, and the three export routes.
- P1 Shopee runtime isolation is now added for `lib/actions/shopee-returns.actions.ts`.
- P1 pickup runtime isolation is now added for `lib/actions/pickup.actions.ts`.
- P1 customer-return portal writes now derive tenant scope from the matched existing order and bind all customer/order/return/image/item/log writes to the derived `org_id`.
- P1 upload image actions now require org context for authenticated image DB/storage reads and writes; signed upload sessions can carry `orgId` and write staged paths under `staging/{orgId}/{draftId}` while retaining legacy anonymous staging compatibility.
- P2 backup actions now require owner/admin org context, scope backup reads/writes by `org_id`, force restored rows back to the active org, and store/download/delete files only under `backups/{orgId}/`.
- The backup cron no longer performs platform-wide backup by default; it skips safely unless `SAAS_BACKUP_ORG_ID` is configured, and then calls the backup action with an explicit cron org id.
- Non-backup platform maintenance cron routes now skip safely unless `ENABLE_PLATFORM_MAINTENANCE_CRON=true` is configured.
- `tests/unit/saas-runtime-org-isolation.test.ts` asserts the P0, Shopee P1, pickup P1, customer-return P1, upload/signed-url, backup/backup-cron, and maintenance cron gate patterns.

Public multi-tenant runtime isolation is locally gated for the known P0/P1/P2 paths reviewed here. Remaining public rollout blockers are now external/product decisions rather than unscoped customer-data runtime actions:

- configuring `app.smart-return.tw`
- keeping email provider skipped or choosing a provider later
- keeping Billing/ECPay disabled until Stage 2
- deciding whether to set `ENABLE_PLATFORM_MAINTENANCE_CRON=true` for platform-wide maintenance cron after accepting its platform-only behavior

Current recommendation: keep Closed Manual Beta constrained until domain and public signup decisions are explicit. If public signup or broad onboarding is enabled, keep `ENABLE_PLATFORM_MAINTENANCE_CRON` unset/false unless platform-wide maintenance semantics are reviewed and accepted.

Before public multi-tenant, the safe order is:

1. Review this audit.
2. Keep `025` and `saas:schema-gate:strict` green; do not run new migrations without owner approval.
3. Convert the remaining P1/P2 runtime paths to `getOrgContext()` plus explicit `.eq('org_id', orgId)` filters before exposing them to public multi-tenant tenants.
4. Keep service-role access limited to platform-admin, cron, provider, or audited server-only paths with explicit authorization and tenant identifiers.

## Design Decisions

| Decision | Result | Reason |
|---|---|---|
| Tenant key | `org_id UUID REFERENCES public.organizations(id)` | Matches `023` SaaS foundation. |
| Child tables | Store direct `org_id` on child rows | Simpler RLS, predictable indexes, avoids expensive join-based policies. |
| Existing data | Fresh SaaS DB assumed | Do not backfill from live/internal data. If migration from live data is ever needed, write a separate import plan. |
| Service role | Server-only, exceptional use | Service role bypasses RLS; every use must inject or filter `org_id` explicitly. |
| Client access | anon/authenticated client + RLS | SaaS runtime should not rely on service-role access for user-scoped data. |

## Local Guard Foundation

`lib/saas/org-context.ts` now provides the first shared server guard for SaaS runtime work:

- Resolves authenticated user -> `organization_members` -> `organizations`.
- Normalizes role to `owner` / `admin` / `staff` / `viewer`; legacy `member` maps to `staff`.
- Resolves `organizations.plan` through `lib/config/saas-plans.ts`.
- Resolves feature flags through `lib/config/feature-flags.ts`, including plan gating.
- Supports guard requirements for role, feature flag, and writable billing status.
- Uses the authenticated Supabase server client for membership lookup; it does not use service-role clients for org context.

The first P0 runtime action rewrites are now in place for returns, AI analysis, and export routes. Shopee, pickup, customer-return, upload/signed-url, and backup actions now use tenant guard/filter or explicit-org gating patterns. Non-backup service-role cron/maintenance paths are now disabled by default unless `ENABLE_PLATFORM_MAINTENANCE_CRON=true`.

## Schema And RLS Audit

Read-only current status:

- `npm run saas:schema-gate:strict` passed on 2026-05-29.
- The gate checks core SaaS/commercial tables plus business-table `org_id` readiness.
- Draft migrations `033`-`036` remain unapplied and are outside this audit's allowed actions.
- `proxy.ts` was not changed; current Next build behavior recognizes it as Proxy / Middleware.

The table below remains useful as the baseline risk map that `025` was designed to close. The live SaaS project should continue to rely on schema-gate output rather than the older internal/live-era assumptions.

| Table | Source | `org_id` today | Current RLS risk | Required action |
|---|---|---:|---|---|
| `organizations` | `023` | native | member SELECT only, service_role full | Keep. |
| `organization_members` | `023` + `024` | native | member self SELECT only, service_role full | Keep; use as tenant membership source. |
| `subscriptions` | `023` + `024` | native | members can SELECT own subscription | Keep; write via billing/server only. |
| `billing_events` | `023` | native | service_role only | Keep; webhook/server only. |
| `organization_invites` | `024` | native | owner/admin scoped | Keep. |
| `invoices` | `024` | native | org members can SELECT | Keep; write via billing/server only. |
| `audit_logs` | `024` | nullable native | owner/admin scoped SELECT | Keep; allow `org_id` null only for platform-level events. |
| `customers` | `004` / `setup.sql` | missing in active portal migration | authenticated policies are broad | Add direct `org_id`, tenant RLS, org composite indexes. |
| `orders` | `004` / `setup.sql` | missing in active portal migration | authenticated policies are broad | Add direct `org_id`, tenant RLS, org composite unique/indexes. |
| `return_requests` | `004` / `setup.sql` | missing in active portal migration | authenticated policies are broad | Add direct `org_id`, tenant RLS, org indexes. |
| `return_items` | `004` / `setup.sql` | missing in active portal migration | inherited only through `return_request_id` | Add direct `org_id`; keep FK to `return_requests`. |
| `return_images` | `004` / `setup.sql` | missing in active portal migration | inherited only through `return_request_id` | Add direct `org_id`; storage paths must also include org context later. |
| `activity_logs` | `004` / `setup.sql` | missing in active portal migration | broad authenticated SELECT/INSERT | Add direct `org_id`; consider replacing with `audit_logs` later. |
| `inspection_records` | `004` / `setup.sql` | missing in active portal migration | inherited only through `return_request_id` | Add direct `org_id`. |
| `ai_analysis_reports` | `004` | missing in active portal migration | broad authenticated ALL | Add direct `org_id`; include `(org_id, report_period)`. |
| `ai_usage_events` | `022`, `023` adds nullable `org_id` | nullable | authenticated SELECT true | Make org-scoped before SaaS launch; events without `org_id` are not SaaS-safe. |
| `shopee_returns` | `003` | missing | authenticated ALL true | Add direct `org_id`; change unique key from global to `(org_id, order_number, option_sku)` style. |
| `pickup_records` | `005` | missing | authenticated ALL true | Add direct `org_id`; index `(org_id, process_date)`. |
| `shopee_scan_events` | `009` | missing | authenticated ALL true | Add direct `org_id`; scan audit is tenant data. |
| `shopee_unmatched_scans` | `009` | missing | authenticated ALL true | Add direct `org_id`; unique open normalized code must include org. |
| `shopee_scan_daily_kpis` | `011` | missing | authenticated ALL true | Add direct `org_id`; unique date must become `(org_id, metric_date)`. |
| `scan_audit_logs` | `016` | missing | authenticated SELECT true | Add direct `org_id`; owner/admin read only. |
| `backup_records` | UI/server action references only | not in migrations | likely missing RLS | Add to a later migration if backup feature remains in SaaS. |

The older `supabase/schema.sql` and `001_return_system_schema.sql` already contain an `org_id` design, but the currently used portal/returns migrations and runtime paths do not consistently enforce it. SaaS should converge on `organizations` / `organization_members` from `023`, not the older `users.org_id` design.

## Runtime Query And Service Role Audit

Runtime files that use service-role or admin clients for customer data:

| File | Main tables | Risk | Priority |
|---|---|---|---|
| `lib/actions/return.actions.ts` | `orders`, `return_requests`, `return_items`, `return_images`, `inspection_records`, `activity_logs`, `customers`, `pickup_records` | P0 guard/filter now present: `getOrgContext()` / writable context plus explicit `org_id` inserts and filters. Keep regression tests. | P0 done |
| `app/api/v1/ai/analyze/route.ts` | `return_requests`, `shopee_returns`, `pickup_records`, `ai_analysis_reports`, `ai_usage_events` | P0 guard/filter now present: org context, AI quota by org, org-scoped reads/writes and usage events. Keep regression tests. | P0 done |
| `app/api/v1/admin/returns/export/route.ts` | `return_requests`, `orders`, `return_items` | P0 export guard now requires org context with `exportable: true` and filters by `org_id`. | P0 done |
| `app/api/v1/admin/shopee-returns/export/route.ts` | `shopee_returns` | P0 export guard now requires org context with `exportable: true` and filters by `org_id`. | P0 done |
| `app/api/v1/admin/pickup/export/route.ts` | `pickup_records` | P0 export guard now requires org context with `exportable: true` and filters by `org_id`. | P0 done |
| `lib/actions/shopee-returns.actions.ts` | `shopee_returns`, `shopee_scan_events`, `shopee_unmatched_scans`, `orders`, `return_requests` | P1 guard/filter now present: read actions use org context, write/scan/import/bind actions require writable org context, tenant reads filter by `org_id`, and tenant writes include `org_id`. Keep regression tests. | P1 done |
| `lib/actions/pickup.actions.ts` | `pickup_records` | P1 guard/filter now present: read actions use org context, mutating actions require writable org context, reads/updates/deletes filter by `org_id`, imports/creates include `org_id`, and scan audit metadata includes the org id. | P1 done |
| `lib/actions/customer-return.actions.ts` | `customers`, `orders`, `return_requests`, `return_items`, `return_images`, `activity_logs` | P1 hardening now derives tenant scope from an existing matched order number + customer phone pair, rejects missing or ambiguous org matches, writes child rows with `org_id`, filters lookups by derived org, and stores final images under `returns/{orgId}/...`. Anonymous public portal uploads still use a legacy-compatible staging fallback until the UI can pass org-scoped upload sessions earlier in the flow. | P1 done with compatibility note |
| `lib/actions/upload.ts` and `app/api/v1/upload/signed-url/route.ts` | `return_images`, storage `return-images` | P1 action hardening now requires org context for authenticated image upload/record/delete/read helpers, DB rows include/filter `org_id`, and storage paths include org id. Signed-url route supports org-scoped session payloads and falls back to legacy anonymous staging when no org-scoped session exists. | P1 done with compatibility note |
| `lib/actions/backup.actions.ts` | `backup_records`, `backups`, core tables | P2 hardening now requires owner/admin org context for tenant backup actions, filters table reads by `org_id`, writes backup records with `org_id`, stores files under `backups/{orgId}/`, rejects cross-org file paths, and forces restored rows to the active org. | P2 done |
| `app/api/cron/backup/route.ts` | `backup_records`, `backups`, core tables | P2 gate now skips unless `SAAS_BACKUP_ORG_ID` is configured, then runs a single explicit-org backup through the hardened backup action. | P2 gated |
| Other cron routes under `app/api/cron/*` | reports, KPIs, retention | P2 gate now skips platform maintenance cron unless `ENABLE_PLATFORM_MAINTENANCE_CRON=true`. This keeps public rollout from accidentally running platform-wide service-role maintenance. | P2 gated |
| Maintenance/predeploy scripts | service role checks | OK for local/CI checks, but SaaS env must point to SaaS DB only. | P2 |

## RLS Policy Templates

Use these templates for business tables with direct `org_id`.

### SELECT

```sql
CREATE POLICY "<table>_members_select"
  ON public.<table>
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
```

### INSERT

```sql
CREATE POLICY "<table>_members_insert"
  ON public.<table>
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
    )
  );
```

### UPDATE

```sql
CREATE POLICY "<table>_members_update"
  ON public.<table>
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
    )
  );
```

### DELETE

```sql
CREATE POLICY "<table>_owners_admins_delete"
  ON public.<table>
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
```

Service-role policies may stay for controlled server-only paths, but runtime code must still pass `org_id` explicitly. Service role is not a substitute for tenant filtering.

## Rewrite Priority

| Priority | Scope | First target |
|---|---|---|
| P0 | hot customer data and exports | Completed for return actions, AI analyze route, and export routes; keep regression coverage. |
| P1 | Portal, upload, pickup | Completed for pickup actions, customer portal actions, upload helpers, and signed-url org-scoped session support; anonymous staging compatibility remains until UI can pass org earlier |
| P2 | cron, backup, maintenance | Backup action, backup cron, and non-backup maintenance cron are gated locally |

## Next Local Tasks

1. Keep `tests/unit/saas-runtime-org-isolation.test.ts` as the P0/P1/P2 regression guard.
2. Keep the Shopee regression coverage in `tests/unit/saas-runtime-org-isolation.test.ts` and `tests/e2e/shopee-scan-flow.e2e.test.ts`.
3. Keep `ENABLE_PLATFORM_MAINTENANCE_CRON` unset/false for public multi-tenant launch unless platform-wide maintenance cron is explicitly approved.
4. If customer portal UX is revised later, pass a verified org-scoped upload session before direct uploads so anonymous staging no longer needs the legacy `staging/{draftId}` fallback.

Blocked platform tasks:

- External public rollout decisions remain owner-blocked: beta/custom domain, email provider, Billing/ECPay, and any production/provider changes.
- Draft migrations `033`-`036` still require explicit owner authorization before any apply.
- Public signup / broad self-serve tenant onboarding should stay closed until the owner explicitly approves domain/signup posture and confirms maintenance cron should remain disabled or be enabled as platform-wide maintenance.
