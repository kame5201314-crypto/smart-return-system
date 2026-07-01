# SaaS AI Returns To Platform Admin QA Plan

Date: 2026-06-30
Status: Codex QA plan for `develop-saas`
Scope: AI return system merchant workspace data flow into the commercial platform admin views.

## 1. Product Entry Points

| Surface | URL | User | Purpose |
|---|---|---|---|
| Merchant AI return workspace | `/login` -> `/analytics` | Tenant owner/admin/staff/viewer | Import and manage returns, Shopee returns, pickup records, logistics lookup, AI return analysis, usage/settings. |
| Commercial platform admin | `/admin` -> `/internal` | Platform operator only | View tenant count, subscription/trial posture, usage health, and billing events. Do not show customer return detail rows. |

Expected separation:

- Merchant accounts must not enter `/internal`.
- Platform operators can enter `/internal`.
- Platform admin summaries may show tenant health and usage counts, but must not expose customer order/return detail, images, addresses, or buyer PII.

## 2. Automated Coverage

| Area | Coverage |
|---|---|
| 499 / 699 / enterprise plan contract | `tests/unit/saas-commercial-config.test.ts`, `tests/unit/saas-ui-backend-contracts.test.ts` |
| AI quota reads org plan limits | `tests/unit/saas-ai-quota.test.ts` |
| AI analyze route requires org context and writes usage events | `tests/unit/saas-runtime-org-isolation.test.ts` |
| Platform usage reads by org id from returns and AI usage tables | `tests/unit/saas-platform-admin-data.test.ts` |
| `/internal` dashboard and org list receive usage snapshots | `tests/unit/saas-platform-admin-live-data.test.ts`, `tests/e2e/platform-admin-dashboard-flow.e2e.test.ts` |
| Platform admin privacy boundary | `tests/unit/saas-platform-admin-live-data.test.ts` asserts platform admin DTOs do not leak customer return detail payloads such as order numbers, buyer names, phone numbers, addresses, or return reasons. |
| Merchant mutation safety and auth redirects | `tests/unit/same-origin-request.test.ts`, `tests/unit/proxy-login-redirect.test.ts`, `tests/unit/internal-login-redirect.test.ts` |

## 3. Manual QA Path

Use a disposable QA organization only. Do not use `yu-jian-wei-lai` or any real customer org.

1. Sign in as the QA merchant owner at `/login`; confirm redirect to `/analytics`.
2. Go to `/shopee-returns`; import or create test return rows for the QA org.
3. Go to `/returns`; confirm the same-org return rows are visible and cross-org rows are not visible.
4. Go to `/analytics/ai-report`; run an AI analysis on the QA org data.
5. Go to `/settings/usage`; confirm AI usage increased and is compared against the current plan limit.
6. Sign in as a platform admin and open `/internal`; confirm the QA org return and AI usage counts are reflected in summaries.
7. Open `/internal/orgs` and the QA org detail page; confirm plan, status, seats, returns, AI usage, and health indicators are consistent.
8. Confirm `/internal` does not expose return detail rows, buyer PII, images, phone numbers, or addresses.
9. Sign in as a merchant-only account and request `/internal`; expect a forbidden/gated state or redirect to the platform admin login path.

## 4. Team Management Precheck

`/settings/team` uses a normal authenticated SaaS RLS client to read `organization_members`.
The original commercial foundation only allowed users to read their own membership row.
That prevents an owner/admin from seeing the rest of the same organization team.

This repo contains the migration:

```text
supabase/migrations/038_saas_org_member_visibility.sql
```

It adds `public.is_organization_member(...)` as a `SECURITY DEFINER` helper and a helper-backed same-org SELECT policy for `organization_members`.
This avoids recursive `organization_members` RLS while allowing same-org team visibility.

Current status:

- Owner authorized applying only `038` to SaaS Supabase project
  `auyznbwtjvemyamujmgt` on 2026-07-01.
- Remote migration history records `038` as applied.
- `public.is_organization_member(uuid, text[])` exists.
- Policy `members_select_org_memberships` exists on `organization_members`.
- Full `/settings/team` owner/admin browser QA is no longer schema-blocked,
  but it must use a disposable QA org before real merchant staff are invited.

Historical owner authorization text:

```text
I authorize applying only supabase/migrations/038_saas_org_member_visibility.sql
to SaaS Supabase project auyznbwtjvemyamujmgt.
Do not deploy, do not apply other migrations, do not edit env/secrets, do not
enable email/billing/provider, and do not touch master/live/internal Supabase.
```

## 5. Platform Admin QA Checklist

| Check | Expected result |
|---|---|
| `/internal` access | Platform admin can view it; merchant-only users cannot. |
| `/internal/orgs` | Shows tenant list, plan/status, owner email, seats, return usage, and AI usage. |
| `/internal/orgs/[id]` | Shows single-tenant health summary and audit/billing context without customer return details. |
| At-risk signals | `past_due`, `suspended`, `trial_expired`, AI 100%, return 100%, and seat-full cases render operator-facing alerts. |
| Privacy boundary | Platform admin views do not show buyer PII or return detail tables. |
| Disabled write operations | Stage 2 write operations remain disabled or clearly marked until billing operations are authorized. |
| Navigation separation | Merchant sidebar does not link to `/internal`; platform admin entry is `/admin`. |
| Team management | Disposable owner/admin can see same-org members on `/settings/team` and test role/disable/invite flows without touching real merchants. |

## 6. Final Local Gates

Run before commit/push:

```powershell
npm run safety:agent-boundary
npm run lint
npm run typecheck
npm run test:all
npm run saas:doctor
npm run build
```

Run this read-only smoke check after an owner-authorized production deploy:

```powershell
npm run saas:production-smoke
```

Only run predeploy after explicit owner deployment authorization:

```powershell
npm run saas:predeploy
```
