# SaaS Tenant Isolation Audit

Date: 2026-05-20
Status: Draft for review
Scope: SaaS `develop-saas` checkout only

This audit covers the next safe SaaS work item after `023_saas_commercial_foundation.sql` and `024_saas_commercial_v2.sql`: attach tenant identity to business data and remove cross-organization read/write paths.

No database migration has been applied. No Supabase project has been touched.

## Executive Summary

The current SaaS branch has the commercial foundation tables, but most production business tables still come from the internal/live-era schema. Several tables either have no `org_id`, or have RLS policies using `USING (true)` for every authenticated user. Runtime code also uses service-role clients heavily in server actions and API routes.

Before implementing `getOrgContext()` and changing server actions, the safe order is:

1. Review this audit.
2. Review `supabase/migrations/025_attach_org_id_to_business_tables.sql`.
3. Apply `023`, `024`, and `025` only to the SaaS Supabase project after credentials exist.
4. Add `getOrgContext()` and replace service-role business paths with org-scoped queries.

## Design Decisions

| Decision | Result | Reason |
|---|---|---|
| Tenant key | `org_id UUID REFERENCES public.organizations(id)` | Matches `023` SaaS foundation. |
| Child tables | Store direct `org_id` on child rows | Simpler RLS, predictable indexes, avoids expensive join-based policies. |
| Existing data | Fresh SaaS DB assumed | Do not backfill from live/internal data. If migration from live data is ever needed, write a separate import plan. |
| Service role | Server-only, exceptional use | Service role bypasses RLS; every use must inject or filter `org_id` explicitly. |
| Client access | anon/authenticated client + RLS | SaaS runtime should not rely on service-role access for user-scoped data. |

## Schema And RLS Audit

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

High-risk runtime files that currently use service-role or admin clients for customer data:

| File | Main tables | Risk | Priority |
|---|---|---|---|
| `lib/actions/return.actions.ts` | `orders`, `return_requests`, `return_items`, `return_images`, `inspection_records`, `activity_logs`, `customers`, `pickup_records` | Many server actions bypass RLS and do not inject org scope yet. | P0 |
| `lib/actions/shopee-returns.actions.ts` | `shopee_returns`, `shopee_scan_events`, `shopee_unmatched_scans`, `orders`, `return_requests` | Core hot path for imports, scan, inbound updates. | P0 |
| `app/api/v1/ai/analyze/route.ts` | `return_requests`, `shopee_returns`, `pickup_records`, `ai_analysis_reports`, `ai_usage_events` | AI reports can aggregate across orgs without org filter. | P0 |
| `app/api/v1/admin/returns/export/route.ts` | `return_requests`, `users` | Export path must never cross org. | P0 |
| `app/api/v1/admin/shopee-returns/export/route.ts` | `shopee_returns`, `users` | Export path must never cross org. | P0 |
| `app/api/v1/admin/pickup/export/route.ts` | `pickup_records`, `users` | Export path must never cross org. | P0 |
| `lib/actions/pickup.actions.ts` | `pickup_records` | Service role write/read path; needs org context. | P1 |
| `lib/actions/customer-return.actions.ts` | `customers`, `orders`, `return_requests`, `return_items`, `return_images`, `activity_logs` | Public portal path must map request to org safely. | P1 |
| `lib/actions/upload.ts` and upload routes | `return_images`, storage `return-images` | Storage path and DB rows need org scoping. | P1 |
| `lib/actions/backup.actions.ts` | `backup_records`, `backups`, core tables | Backup feature can export all org data if not isolated. | P2 |
| Cron routes under `app/api/cron/*` | reports, KPIs, retention | Cron should iterate orgs or be platform-admin only. | P2 |
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
| P0 | hot customer data and exports | `return.actions.ts`, `shopee-returns.actions.ts`, AI analyze route, export routes |
| P1 | portal, upload, pickup | customer portal actions, signed upload/session routes, pickup actions |
| P2 | cron, backup, maintenance | cron routes, backup actions, retention/archive jobs |

## Next Local Tasks

1. Review `025_attach_org_id_to_business_tables.sql`.
2. Add `getOrgContext()` server utility.
3. Convert P0 paths to require org context and add `.eq('org_id', orgId)` to every read/write.
4. Add tests for org-scoped AI analysis, export, returns, and Shopee scan paths.

Blocked platform tasks:

- Create SaaS Supabase project.
- Provide SaaS Supabase env values.
- Apply `023`, `024`, and `025` to the SaaS Supabase project.
