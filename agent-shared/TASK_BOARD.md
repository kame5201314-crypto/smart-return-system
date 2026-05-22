# Shared Task Board

Status values:

- `todo`
- `in_progress`
- `blocked`
- `done`

## Claude UI Tasks

| Status | Task | Notes |
|---|---|---|
| done | Empty / loading / error states | Commit `927bf1a` |
| done | SaaS settings UI polish | Commit `f216cc8`; used existing `app/(admin)/settings/**` |
| done | Platform admin UI polish | Commit `f216cc8`; mock UI only |
| done | Shared SaaS page header + safe RWD audit | Commit `f0a937a` |
| done | Invite acceptance UI live data wiring | Commit `6ec9499`; `/invite/[token]` uses the Codex loader and accept route |
| done | Customer portal SaaS polish | Claude reported complete; loading/error/empty states covered without API/tracking changes |
| done | Returns dashboard visual polish | Claude reported complete; PageHeader, loading skeleton, and empty state covered |
| done | Mobile responsive QA follow-up | Claude reported PASS on 390x844 mobile emulation for `/`, `/pricing`, and `/invite/[token]` |

## Codex Non-UI Tasks

| Status | Task | Notes |
|---|---|---|
| done | SaaS migrations apply | SaaS project `auyznbwtjvemyamujmgt`; full local/remote migration chain aligned through `032`; schema-gate strict passed |
| done | Signup persistence backend | This commit; API is wired to `signup_requests` behind `ENABLE_PUBLIC_SIGNUP=false`, and `026` is a draft migration only |
| done | Platform admin live data wiring | Internal platform admin APIs return UI contract DTOs from service-role repositories; UI page consumption remains Claude-owned |
| done | Platform admin page-level live data loaders | This commit; added `/internal/orgs`, `/internal/orgs/[id]`, and `/internal/billing/events` loaders with platform-admin gates and four-state DTO results for Claude UI handoff |
| done | Platform admin read model migration draft | This commit; added `027` for `owner_email` / `member_count` alignment with platform admin APIs |
| done | Manual Beta org provisioning backend foundation | This commit; added gated `POST /api/internal/saas/orgs` and `028` RPC draft, no DB apply |
| done | SaaS migration apply plan check | This commit; added read-only `saas:migration-plan` checks for SaaS project ref, DB password, and full 001-032 chain |
| done | SaaS rollout readiness check | This commit; added read-only `saas:rollout-check` gates for Gemini key, app URL/domain, Sentry/logging, billing credentials, AI safety flags, and SaaS project safety |
| done | Billing foundation | ECPay webhook route is flag/credential/CheckMacValue gated and records idempotent billing_events only after verification |
| done | ECPay webhook signature verification | This commit; default route path verifies CheckMacValue locally before recording events |
| done | Billing event status schema draft | This commit; added `029` draft and backend record defaults for `billing_events.status` |
| done | Invoice status schema and DTO alignment | This commit; added `030` draft and aligned billing settings invoice statuses |
| done | AI quota enforcement hardening | This commit; return AI analysis now checks `org.plan` monthly quota before provider calls |
| done | Subscription access policy hardening | This commit; centralized trialing/active/past_due/suspended/cancelled access policy and made `past_due` read-only for write guards |
| done | Subscription lifecycle timing policy | This commit; added local trial expiry, cancel-at-period-end, past_due grace, and suspended retention resolver |
| done | Export subscription guard hardening | This commit; admin export APIs now require subscription access policy `exportable` permission |
| done | Return usage soft-limit policy | This commit; centralized 80/100 return soft-limit warnings and consecutive 2-month upgrade suggestion without blocking operations |
| done | Invite status policy foundation | This commit; centralized pending/accepted/expired/revoked invite status and admin/staff/viewer acceptability rules |
| done | Invite token data repository foundation | This commit; added future `/invite/[token]` token lookup from organization_invites without exposing a live route |
| done | Invite acceptance service foundation | This commit; added repository-backed invite acceptance use-case without exposing a route or live write implementation |
| done | Invite acceptance RPC draft | This commit; added `031` draft RPC and repository wrapper for atomic invite acceptance without applying migrations |
| done | Invite creation service and RPC draft | This commit; added seat-checked invite creation service, token generation, `032` draft RPC, and repository wrapper without applying migrations |
| done | Invite acceptance live data and API route | This commit; added `/invite/[token]` loader and `POST /api/saas/invite/accept` using the already-applied acceptance RPC wrapper |
| done | Team invite API foundation | This commit; added owner/admin writable-org `POST /api/saas/team/invites` using active seats, pending invites, and invite creation RPC wrapper |
| blocked | SaaS predeploy strict gate | migration/schema strict pass; rollout strict is blocked by missing/placeholder `GEMINI_API_KEY`, placeholder `NEXT_PUBLIC_APP_URL`, missing Sentry/logging DSN, and billing disabled for paid self-serve |
| done | SaaS schema readiness gate | Added `saas:schema-gate` / `saas:schema-gate:strict` for 023-028 table and org_id readiness checks |
| done | SaaS schema gate commercial v2 coverage | This commit; strict gate now checks organization billing/onboarding/upgrade suggestion fields, subscription period/provider fields, invoice fields, invite token fields, and audit metadata |
| done | Platform admin API DTO wiring | This commit; internal APIs return UI contract DTOs behind the platform admin flag |
| done | Convert UI mock contracts to backend DTOs | This commit; added `lib/saas/ui-backend-contracts.ts` and unit tests |
| done | Settings UI/backend DTO builders | This commit; added billing and team settings builders with validation tests, no live routes exposed |
| done | Settings usage data repository foundation | This commit; added repository/input builder for organizations, organization_members, organization_invites, return_requests, and ai_usage_events without exposing a live route |
| done | Settings billing data repository foundation | This commit; added repository/input builder for organizations, subscriptions, and invoices without exposing a live route |
| done | Settings team data repository foundation | This commit; added repository/input builder for organizations, organization_members, and organization_invites without exposing a live route |
| done | Settings live data server loader | This commit; added server-side billing/usage/team DTO loaders with org-context gates and ready/empty/error/gated states for Claude UI handoff |
| done | Team seat limit policy | This commit; team DTOs now reserve seats for active members and pending invites before enabling invites |

## Shared Rules

- `agent-shared/**` is Codex-maintained only.
- Claude reports task scope and handoff notes in the chat or commit message; Codex records durable notes here.
- Prefer serialized work in this shared checkout: one agent commits and pushes before the next starts.
- New behavior must not be enabled for everyone by default.
- UI may use mock data, but it must be clearly marked.
- Backend must not serve fake data on production paths.
- Do not work in the live production checkout.
- Do not push `master`.
- Use `REVIEW_CHECKLIST.md` before every handoff, commit, and push.
