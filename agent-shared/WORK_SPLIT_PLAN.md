# Work Split Plan

Date: 2026-05-25
Branch: `develop-saas`

This plan is the operating split for the SaaS commercial branch.

## Ownership Summary

| Area | Owner | Rule |
|---|---|---|
| UI / UX / visual polish | Claude | Page composition, responsive layout, copy, icons, loading/empty/error states, and client-side interaction polish only. |
| Backend / data / safety | Codex | Database, RLS, API routes, server actions, DTO contracts, billing, quotas, auth, tests, docs, CI gates, and Git coordination. |
| Shared coordination files | Codex | `agent-shared/**` is single-writer to avoid claim-file conflicts. |
| External operations | Codex after explicit user approval | Pushes, Supabase migration apply, Vercel deploy/env, billing provider setup, branch protection, secrets. |

## Claude UI Work

Claude can work after Codex has committed and pushed the current backend/coordination changes.

| Priority | Task | Allowed files | Backend dependency |
|---|---|---|---|
| C1 | Platform admin dashboard visual polish | `app/internal/**`, `components/internal/**`, `components/saas/**` | Use existing `PlatformOrganizationListView`, `PlatformOrganizationDetailView`, and billing event DTOs. |
| C2 | At-risk and health metric presentation | `app/internal/orgs/**`, `components/saas/**` | Do not change risk calculation; only render `health`, `summary`, and existing usage fields. |
| C3 | Billing / usage / team settings UI refinement | `app/(admin)/settings/**`, `components/saas/**` | Use existing settings loaders and DTOs. |
| C4 | Trial / onboarding UI screens | `app/signup/**`, future onboarding page files, `components/saas/**` | Use Codex `loadSaaSOnboardingView()` and `POST /api/saas/onboarding/complete`; do not enable completion writes in production until migration `035` is explicitly applied. |
| C5 | Public marketing and legal page polish | `/`, `/pricing`, `/features/**`, `/legal/**`, `/contact` page files | UI-only; do not change signup persistence or billing behavior. |
| C6 | Responsive QA pass | UI page files only | Record findings in chat/commit message; Codex records durable status. |
| C7 | Platform admin team UI | `app/internal/**`, `components/internal/**` | Use Codex `GET/POST /api/internal/saas/platform-admins`; do not expose production role editing until migration `036` is explicitly applied. |

Claude must not edit `app/api/**`, `lib/saas/**`, `lib/actions/**`, `lib/config/**`, `lib/supabase/**`, `scripts/**`, `supabase/**`, `.env*`, root config files, or `agent-shared/**`.

## Codex Non-UI Work

Codex owns the remaining Stage 2/3 foundation and should keep feature flags closed until explicitly opened.

| Priority | Task | Output |
|---|---|---|
| X1 | Platform admin billing operation backend plan | RPC/API contract for manual payment marking, suspend/resume, refund request, and audit logging. |
| X2 | At-risk alert backend contract | DTO/data loader for `past_due`, `suspended`, AI 100%, return 100%, seat full, and trial expiry signals. |
| X3 | Trial conversion backend contract | Read-only loader for trialing, converted active, expired trial, and onboarding incomplete counts. |
| X4 | Billing event retry and reconciliation design | Safe retry contract, reconciliation SOP, and tests before any UI retry button is enabled. |
| X5 | Platform admin role model | Backend policy plus owner-gated role assignment API/RPC draft for owner/support/billing platform roles before multi-admin UI is exposed. |
| X6 | Notification backend foundation | Email/notification queue contracts for billing failure, AI 100%, trial ending, and platform announcements. |
| X7 | Migration and schema gates | Draft migrations and strict checks; apply only after explicit approval and target confirmation. |
| X8 | CI/readiness hardening | Unit tests, doctor checks, typecheck, lint, and safe predeploy gates. |

## Handoff Protocol

1. One agent edits at a time in this checkout.
2. The current agent commits and pushes before the next agent starts.
3. Claude reports changed files, tests, screenshots, blockers, and UI-only scope in chat or commit message.
4. Codex records durable coordination updates in `agent-shared/**`.
5. If Claude needs new data, Claude describes the desired DTO shape in chat; Codex updates `UI_BACKEND_CONTRACTS.md` and backend loaders.
6. If Codex needs a UI page changed for backend wiring, Codex should keep the change minimal and leave visual polish to Claude.

## Stage Gate

Do not move to paid Beta until these Codex-owned backend items exist and pass tests:

- MRR / trial pipeline / at-risk read-only metrics.
- Billing write operation contract with audit logs.
- Past-due and suspended lifecycle enforcement.
- Billing event idempotency and retry SOP.
- Refund/manual adjustment audit trail.

Do not move to public signup until these shared items exist:

- Trial conversion and onboarding metrics.
- Customer communication / notification path.
- Platform admin role split.
- Public signup and onboarding UI wired to Codex-approved backend contracts.
