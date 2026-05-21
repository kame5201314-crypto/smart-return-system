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
| blocked | SaaS migrations apply | Needs SaaS DB password and explicit approval; use full `001_*` to `027_*` chain |
| done | Signup persistence backend | This commit; API is wired to `signup_requests` behind `ENABLE_PUBLIC_SIGNUP=false`, and `026` is a draft migration only |
| blocked | Platform admin live data wiring | Schema readiness gate exists; UI page live consumption still waits for migrations/live data readiness |
| done | Platform admin read model migration draft | This commit; added `027` for `owner_email` / `member_count` alignment with platform admin APIs |
| done | Billing foundation | ECPay webhook route is flag/credential/CheckMacValue gated and records idempotent billing_events only after verification |
| done | ECPay webhook signature verification | This commit; default route path verifies CheckMacValue locally before recording events |
| done | AI quota enforcement hardening | This commit; return AI analysis now checks `org.plan` monthly quota before provider calls |
| blocked | SaaS predeploy strict gate | Schema readiness gate exists; final strict pass still needs Gemini key and SaaS migrations applied |
| done | SaaS schema readiness gate | Added `saas:schema-gate` / `saas:schema-gate:strict` for 023-027 table and org_id readiness checks |
| done | Platform admin API DTO wiring | This commit; internal APIs return UI contract DTOs behind the platform admin flag |
| done | Convert UI mock contracts to backend DTOs | This commit; added `lib/saas/ui-backend-contracts.ts` and unit tests |

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
