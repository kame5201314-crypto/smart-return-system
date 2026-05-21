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
| todo | Customer portal SaaS polish | UI-only; do not alter portal APIs or tracking logic |
| todo | Returns dashboard visual polish | Handoff first if touching large client components used by Codex backend work |
| todo | Mobile responsive QA follow-up | Use existing breakpoints; record issues in `HANDOFF_LOG.md` |

## Codex Non-UI Tasks

| Status | Task | Notes |
|---|---|---|
| blocked | SaaS migrations apply | Needs SaaS DB password and explicit approval; use full `001_*` to `030_*` chain |
| done | Signup persistence backend | This commit; API is wired to `signup_requests` behind `ENABLE_PUBLIC_SIGNUP=false`, and `026` is a draft migration only |
| blocked | Platform admin live data wiring | Schema readiness gate exists; UI page live consumption still waits for migrations/live data readiness |
| done | Platform admin read model migration draft | This commit; added `027` for `owner_email` / `member_count` alignment with platform admin APIs |
| done | Manual Beta org provisioning backend foundation | This commit; added gated `POST /api/internal/saas/orgs` and `028` RPC draft, no DB apply |
| done | SaaS migration apply plan check | This commit; added read-only `saas:migration-plan` checks for SaaS project ref, DB password, and full 001-030 chain |
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
| blocked | SaaS predeploy strict gate | Schema readiness gate exists; final strict pass still needs Gemini key and SaaS migrations applied |
| done | SaaS schema readiness gate | Added `saas:schema-gate` / `saas:schema-gate:strict` for 023-028 table and org_id readiness checks |
| done | SaaS schema gate commercial v2 coverage | This commit; strict gate now checks organization billing/onboarding/upgrade suggestion fields, subscription period/provider fields, invoice fields, invite token fields, and audit metadata |
| done | Platform admin API DTO wiring | This commit; internal APIs return UI contract DTOs behind the platform admin flag |
| done | Convert UI mock contracts to backend DTOs | This commit; added `lib/saas/ui-backend-contracts.ts` and unit tests |
| done | Settings UI/backend DTO builders | This commit; added billing and team settings builders with validation tests, no live routes exposed |
| done | Settings usage data repository foundation | This commit; added repository/input builder for organizations, organization_members, organization_invites, return_requests, and ai_usage_events without exposing a live route |
| done | Settings billing data repository foundation | This commit; added repository/input builder for organizations, subscriptions, and invoices without exposing a live route |
| done | Settings team data repository foundation | This commit; added repository/input builder for organizations, organization_members, and organization_invites without exposing a live route |
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
