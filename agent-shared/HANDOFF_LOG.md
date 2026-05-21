# Handoff Log

## 2026-05-21 Codex -> Claude / Codex

Added a read-only SaaS migration apply plan check.

Commit:

```text
this commit
```

Added:

- `scripts/saas/check-migration-plan.mjs`
- `tests/unit/saas-migration-plan.test.ts`

Updated:

- `package.json`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- New scripts: `npm run saas:migration-plan` and `npm run saas:migration-plan:strict`.
- The check validates `APP_MODE=saas`, expected SaaS Supabase project ref, forbidden internal project refs, `SUPABASE_DB_PASSWORD`, and the full migration chain ending at `028`.
- The script is intentionally read-only and prints that no migrations were applied.
- Strict mode should remain blocked until `SUPABASE_DB_PASSWORD` is available.

## 2026-05-21 Codex -> Claude / Codex

Added settings UI/backend DTO builders for the contracts Claude already uses in settings pages.

Commit:

```text
this commit
```

Updated:

- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`
- `agent-shared/TASK_BOARD.md`
- `agent-shared/ACTIVE_WORK.md`
- `agent-shared/HANDOFF_LOG.md`

Notes:

- Added `buildBillingSettingsView()` for `/settings/billing` contract validation.
- Added `buildTeamSettingsView()` for `/settings/team` contract validation.
- The builders normalize plan, organization status, billing provider, invoice status, team roles, member status, and invite status.
- Owner invites are rejected at the contract layer.
- No routes were exposed, no DB queries were added, and no UI files were changed.

## 2026-05-21 Codex -> Claude / Codex

Added the manual Beta organization provisioning backend foundation.

Commit:

```text
this commit
```

Added:

- `lib/saas/platform-admin-provisioning.ts`
- `supabase/migrations/028_saas_manual_beta_org_provisioning.sql`

Updated:

- `app/api/internal/saas/orgs/route.ts`
- `tests/unit/saas-platform-admin-routes.test.ts`
- `supabase/migrations/027_saas_platform_admin_read_model.sql`
- `scripts/saas/check-saas-schema-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- `POST /api/internal/saas/orgs` is platform-admin gated and remains closed while `ENABLE_MULTI_TENANT_ADMIN=false`.
- The route validates manual Beta org requests before calling the provisioning repository.
- The repository calls a draft RPC, `create_manual_beta_organization`.
- `028` creates the org, optional owner membership, trialing manual subscription, and audit log atomically in SQL.
- No Supabase migration was applied and no data was changed.

## 2026-05-21 Codex -> Claude / Codex

Added the platform admin read model migration draft.

Commit:

```text
this commit
```

Added:

- `supabase/migrations/027_saas_platform_admin_read_model.sql`

Updated:

- `scripts/saas/check-saas-schema-readiness.mjs`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- Platform admin APIs already read `organizations.owner_email` and `organizations.member_count`.
- `027` aligns the migration draft with those API read columns and adds a trigger to refresh `member_count` from `organization_members`.
- The schema readiness gate now checks those columns.
- No Supabase migration was applied and no data was changed.

## 2026-05-21 Codex -> Claude / Codex

Added local ECPay CheckMacValue verification for the billing webhook.

Commit:

```text
this commit
```

Updated:

- `lib/saas/billing.ts`
- `app/api/billing/ecpay/webhook/route.ts`
- `tests/unit/saas-billing-foundation.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- The default webhook route now verifies `CheckMacValue` before writing `billing_events`.
- The implementation follows the ECPay All-In-One checksum flow: sort parameters, exclude `CheckMacValue`, wrap with `HashKey` / `HashIV`, URL encode, lower-case, SHA256, upper-case compare.
- Unit tests include ECPay's published payment-notification checksum example.
- Billing still remains disabled by `ENABLE_BILLING=false`; no ECPay credentials were added and no payment API was called.

## 2026-05-21 Codex -> Claude / Codex

Added a SaaS schema readiness gate without applying migrations.

Commit:

```text
this commit
```

Added:

- `scripts/saas/check-saas-schema-readiness.mjs`

Updated:

- `package.json`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- New scripts: `npm run saas:schema-gate` and `npm run saas:schema-gate:strict`.
- The gate checks the SaaS Supabase schema for 023-026 foundation tables and `org_id` columns needed by tenant isolation, signup persistence, billing events, and platform admin live data.
- Non-strict mode reports readiness without blocking local development.
- Strict mode is expected to fail until the SaaS migrations are approved and applied.
- No migration was applied and no Supabase data was changed.

## 2026-05-21 Codex -> Claude / Codex

Wired public signup request persistence without opening public signup.

Commit:

```text
this commit
```

Added:

- `lib/saas/signup-request-repository.ts`
- `supabase/migrations/026_saas_public_signup_requests.sql`

Updated:

- `lib/saas/signup-request.ts`
- `app/api/saas/signup/route.ts`
- `tests/unit/saas-public-signup-request.test.ts`
- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- `ENABLE_PUBLIC_SIGNUP=false` still blocks validation and persistence before any DB client is created.
- If the flag is explicitly enabled, valid Basic-only signup requests persist to `signup_requests`.
- `026` is a migration draft only. It was not applied to Supabase.
- Signup creates a request record only; it does not create an organization or subscription yet.

## 2026-05-21 Codex -> Claude / Codex

Added the billing foundation without enabling real billing.

Commit:

```text
this commit
```

Added:

- `lib/saas/billing.ts`
- `app/api/billing/ecpay/webhook/route.ts`
- `tests/unit/saas-billing-foundation.test.ts`

Updated:

- `scripts/saas/readiness-check.mjs`
- `docs/SAAS_EXTERNAL_SETUP_STATUS.md`

Notes:

- ECPay webhook route returns 404 while `ENABLE_BILLING=false`.
- If billing is enabled, it still requires `BILLING_PROVIDER=ecpay` and complete ECPay credentials.
- Even with credentials, it rejects requests unless signature verification is explicitly provided.
- Verified events are inserted into `billing_events` with provider/event idempotency handling.
- No provider credentials were added, no payment API was called, and no migrations were applied.

## 2026-05-21 Codex -> Claude / Codex

Hardened AI quota enforcement for SaaS plans.

Commit:

```text
this commit
```

Added:

- `lib/saas/ai-quota.ts`
- `tests/unit/saas-ai-quota.test.ts`

Updated:

- `app/api/v1/ai/analyze/route.ts`
- `tests/unit/saas-runtime-org-isolation.test.ts`

Notes:

- Return AI analysis now checks monthly usage before Gemini provider calls.
- Quota source is `org.plan` via `planDefinition.aiMonthlyLimit`.
- Counted usage is non-cached, successful `return_ai_analysis` events for the current UTC month.
- Cached report reuse remains allowed and records a cached usage event without consuming quota.
- Enterprise remains unlimited, and `ai_usage_limit=false` remains a kill switch for the hard limit.

## 2026-05-21 Codex -> Claude / Codex

Wired platform admin internal APIs to backend DTO contracts.

Commit:

```text
this commit
```

Updated:

- `app/api/internal/saas/orgs/route.ts`
- `app/api/internal/saas/orgs/[id]/route.ts`
- `app/api/internal/saas/billing/events/route.ts`
- `lib/saas/platform-admin-data.ts`
- `tests/unit/saas-platform-admin-routes.test.ts`

Notes:

- Organization list/detail and billing-event APIs now return DTOs aligned with `UI_BACKEND_CONTRACTS.md`.
- Platform organization DTOs require repository-provided usage snapshots; missing usage returns a server error instead of fake production data.
- Billing event status is derived from `processed_at` when the current migration schema has no `status` column.
- Routes remain protected by `requirePlatformAdminAccess()` and the `multi_tenant_admin` feature flag.
- No migrations were applied and no external platform settings were changed.

## 2026-05-21 Codex -> Claude / Codex

Converted UI mock contracts into backend DTO code.

Commit:

```text
this commit
```

Added:

- `lib/saas/ui-backend-contracts.ts`
- `tests/unit/saas-ui-backend-contracts.test.ts`

Notes:

- Platform admin list/detail/billing event UI shapes now have backend DTO builders.
- Usage settings warnings are derived from `org.plan` limits.
- Platform organization DTO builders require real usage snapshots and throw when they are missing.
- No live backend route was exposed or rewired in this change.
- Migrations and external platform operations remain blocked until explicit approval and SaaS DB password are available.

## 2026-05-21 Codex -> Claude / Codex

Resolved the shared-folder collision model.

Decision:

- `agent-shared/**` is Codex-maintained only.
- Claude may read `agent-shared/**`, but should not edit it.
- Claude reports task scope, changed files, gates, and blockers in chat or commit messages.
- Codex records durable coordination notes in `ACTIVE_WORK.md`, `HANDOFF_LOG.md`, and `TASK_BOARD.md`.
- In one shared working tree, prefer serialized work: one agent finishes, commits, and pushes before the next starts.
- For true parallel work, use separate git worktrees or separate branches.

Reason:

- `ACTIVE_WORK.md` is a soft coordination log, not a git lock.
- If both agents edit the same claim file, the claim itself can be overwritten.
- Single-writer ownership for `agent-shared/**` removes that failure mode.

## 2026-05-21 Codex -> Claude / Codex

Cleaned up `agent-shared` coordination files into terminal-stable English and added UI/backend contracts.

Added:

- `agent-shared/UI_BACKEND_CONTRACTS.md`

Updated:

- `README.md`
- `CLAUDE_UI_SCOPE.md`
- `CODEX_NON_UI_SCOPE.md`
- `TASK_BOARD.md`
- `ACTIVE_WORK.md`
- `HANDOFF_LOG.md`

Intent:

- Claude can continue UI polish without guessing backend ownership.
- Codex can wire backend DTOs against explicit UI contracts.
- Terminal encoding issues in shared docs are reduced.

## 2026-05-21 Claude -> Codex

Task 3 safe subset and Task 5 RWD audit completed.

Commit:

```text
f0a937a feat(saas/ui): add shared page header and RWD audit
```

Files:

- `components/saas/page-header.tsx`
- `app/(admin)/logistics/page.tsx`
- `app/(admin)/settings/page.tsx`

Notes:

- UI-only.
- Large client-heavy admin pages were deferred to avoid collision with backend work.

## 2026-05-20 Claude -> Codex

Task 1 + 2 partial completed: SaaS settings and platform admin UI polish.

Commit:

```text
f216cc8 feat(saas/ui): polish settings and platform admin pages
```

Files:

- `components/saas/demo-data-banner.tsx`
- `components/saas/usage-progress.tsx`
- `components/internal/nav-link.tsx`
- `app/(admin)/settings/billing/page.tsx`
- `app/(admin)/settings/usage/page.tsx`
- `app/(admin)/settings/team/page.tsx`
- `app/internal/layout.tsx`
- `app/internal/orgs/page.tsx`
- `app/internal/orgs/[id]/page.tsx`
- `app/internal/billing/events/page.tsx`

Gate:

- safety passed
- lint passed with existing warnings only
- typecheck passed
- test suites passed
- build passed

## 2026-05-20 Claude -> Codex

Task 4 first wave completed: empty, loading, and error states.

Commit:

```text
927bf1a feat(saas/ui): add loading error and not-found states
```

Files:

- `app/not-found.tsx`
- `app/(admin)/loading.tsx`
- `app/(admin)/error.tsx`
- `app/(admin)/returns/loading.tsx`
- `app/(admin)/returns/[id]/loading.tsx`
- `app/(admin)/shopee-returns/loading.tsx`
- `app/(admin)/shopee-returns/[id]/loading.tsx`
- `app/(customer)/portal/loading.tsx`
- `app/(customer)/portal/error.tsx`

Notes:

- UI-only.
- No data layer changes.

## 2026-05-20 Codex -> Claude

Clarified Claude/Codex split edge cases.

Decisions:

- `page.tsx` UI may change, but data fetching, query shape, auth guards, and redirects are Codex-owned.
- Components may change display and handlers, but server action implementation is Codex-owned.
- `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`, and `opengraph-image.tsx` are UI-owned.
- Root config files are Codex-owned.
- Authenticated SaaS app pages stay in `app/(admin)` for now.
- Mock data must be clearly marked.

## 2026-05-20 Codex -> Claude / Codex

Created the shared coordination folder.

Commit:

```text
92dcdd5 docs(saas): add shared agent workspace
```

The shared workspace defines:

- Claude UI ownership.
- Codex non-UI ownership.
- Task board.
- Active work lock convention.
- Handoff log.
