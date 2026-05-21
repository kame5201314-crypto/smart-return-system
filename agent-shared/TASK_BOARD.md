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
| blocked | SaaS migrations apply | Needs SaaS DB password and explicit approval; use full `001_*` to `025_*` chain |
| todo | Signup persistence backend | Wire after migrations; public signup remains closed by default |
| todo | Platform admin live data wiring | Use `UI_BACKEND_CONTRACTS.md`; keep feature flag closed until approved |
| todo | Billing foundation | ECPay env / webhook / idempotency; no real billing without test keys and approval |
| todo | AI quota enforcement hardening | Ensure all AI entrypoints use `org.plan` quota |
| todo | SaaS predeploy strict gate | Needs Gemini key and migration status confirmation |
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
