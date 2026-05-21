# Active Work

Use this file to avoid Claude / Codex editing the same files at the same time.

This file is Codex-maintained. Claude should not edit it directly; Claude should declare task scope in the chat or commit message, and Codex records it here after handoff.

This is a coordination log, not a hard git lock. In one shared working tree, prefer serialized work: one agent finishes, commits, and pushes before the next agent starts.

Update format:

```text
Owner:
Started:
Scope:
Files:
Status:
Notes:
```

## Current

```text
Owner: none
Started:
Scope:
Files:
Status:
Notes: Ready for the next agent to claim a task before editing.
```

## Recent Completed

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite status policy foundation
Files:
- lib/saas/invite-policy.ts
- lib/saas/settings-team-data.ts
- lib/saas/settings-usage-data.ts
- tests/unit/saas-invite-policy.test.ts
- tests/unit/saas-settings-team-data.test.ts
- tests/unit/saas-settings-usage-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Centralized invite pending/accepted/expired/revoked status and admin/staff/viewer acceptability rules. No route was exposed, no UI file was changed, no migration was applied, and no invite email was sent.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings usage data repository foundation
Files:
- lib/saas/settings-usage-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-settings-usage-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository/input builder for future usage settings live data from organizations, seats, return_requests, and successful non-cached AI usage. No route was exposed, no UI file was changed, no migration was applied, and no platform operation was added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings team data repository foundation
Files:
- lib/saas/settings-team-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-settings-team-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository/input builder for future team settings live data from organizations, organization_members, and organization_invites. No route was exposed, no UI file was changed, no migration was applied, and no invite email was sent.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings billing data repository foundation
Files:
- .gitignore
- lib/saas/settings-billing-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-settings-billing-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository/input builder for future billing settings live data from organizations, subscriptions, and latest invoices. No route was exposed, no UI file was changed, no migration was applied, and no billing provider was enabled.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invoice status schema and DTO alignment
Files:
- supabase/migrations/030_saas_invoice_status_alignment.sql
- lib/saas/ui-backend-contracts.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-migration-plan.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added draft 030 for invoices.status and aligned billing settings DTOs on draft/issued/paid/failed/void. No DB migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS billing event status schema draft
Files:
- supabase/migrations/029_saas_billing_event_status.sql
- lib/saas/billing.ts
- lib/saas/platform-admin-data.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-billing-foundation.test.ts
- tests/unit/saas-migration-plan.test.ts
- tests/unit/saas-schema-readiness.test.ts
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added draft 029 for billing_events.status, aligned backend record defaults to received, and updated migration/schema gates. Current chain ends at 030. No migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS schema gate commercial v2 coverage
Files:
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-schema-readiness.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Strict schema gate now checks commercial v2 fields from the migration drafts, including upgrade suggestion, subscription period/provider, invoice, invite token, and audit metadata columns. No DB migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS return usage soft-limit policy
Files:
- lib/saas/return-usage-policy.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-return-usage-policy.test.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Centralized return volume soft-limit warnings at 80/100 percent and added consecutive 2-month upgrade suggestion resolver. Return volume remains non-blocking.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS subscription lifecycle timing policy
Files:
- lib/saas/subscription-lifecycle.ts
- tests/unit/saas-subscription-lifecycle.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added pure local timed status resolver for trial_end expiry, cancel_at_period_end, past_due 7-day grace, and suspended 30-day retention. No route or DB write was added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS team seat limit policy
Files:
- lib/saas/team-limits.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-team-limits.test.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Team DTOs now reserve seats for active members and pending invites before enabling invites. No live invite route or DB query was added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS export subscription guard
Files:
- lib/saas/org-context.ts
- app/api/v1/admin/returns/export/route.ts
- app/api/v1/admin/shopee-returns/export/route.ts
- app/api/v1/admin/pickup/export/route.ts
- tests/unit/saas-org-context.test.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Admin export APIs now require exportable subscription access so past_due, suspended, and cancelled orgs cannot export data.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS subscription access policy
Files:
- lib/saas/subscription-access.ts
- lib/saas/org-context.ts
- tests/unit/saas-subscription-access.test.ts
- tests/unit/saas-org-context.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Centralized subscription status access policy and made past_due read-only for writable guards, matching the product spec.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS migration apply plan check
Files:
- scripts/saas/check-migration-plan.mjs
- package.json
- tests/unit/saas-migration-plan.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a read-only pre-apply migration plan check that validates SaaS project ref, forbidden internal refs, DB password readiness, and the full migration chain. Current chain ends at 029. No migration is applied by the script.
```

```text
Owner: Codex
Commit: this commit
Scope: Settings UI/backend DTO builders
Files:
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Added billing and team settings DTO builders with validation tests. No routes were exposed, no DB queries were added, and no UI files were changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Manual Beta org provisioning backend foundation
Files:
- lib/saas/platform-admin-provisioning.ts
- app/api/internal/saas/orgs/route.ts
- tests/unit/saas-platform-admin-routes.test.ts
- supabase/migrations/027_saas_platform_admin_read_model.sql
- supabase/migrations/028_saas_manual_beta_org_provisioning.sql
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added gated platform admin POST foundation for manual Beta org provisioning via draft RPC. ENABLE_MULTI_TENANT_ADMIN remains false, and no migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin read model migration draft
Files:
- supabase/migrations/027_saas_platform_admin_read_model.sql
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a draft migration for organizations.owner_email and organizations.member_count because platform admin APIs already read those fields. No migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: ECPay webhook signature verification
Files:
- lib/saas/billing.ts
- app/api/billing/ecpay/webhook/route.ts
- tests/unit/saas-billing-foundation.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Default ECPay webhook path now verifies CheckMacValue before recording billing_events. Billing remains closed by ENABLE_BILLING=false and no provider credentials or API calls were added.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS schema readiness gate
Files:
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- package.json
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added read-only SaaS schema readiness scripts for 023-026 tables/columns and tenant org_id checks. This does not apply migrations; strict mode is expected to fail until SaaS migrations are approved and applied.
```

```text
Owner: Codex
Commit: this commit
Scope: Signup persistence backend
Files:
- lib/saas/signup-request.ts
- lib/saas/signup-request-repository.ts
- app/api/saas/signup/route.ts
- tests/unit/saas-public-signup-request.test.ts
- scripts/saas/readiness-check.mjs
- supabase/migrations/026_saas_public_signup_requests.sql
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Public signup remains closed by default. When explicitly enabled after SaaS migrations, requests persist to signup_requests via service-role server repository; org creation is still a separate approval step.
```

```text
Owner: Codex
Commit: this commit
Scope: Billing foundation
Files:
- lib/saas/billing.ts
- app/api/billing/ecpay/webhook/route.ts
- tests/unit/saas-billing-foundation.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: ECPay webhook route stays closed by default, requires billing flag, credentials, and signature verification, and records idempotent billing_events only after verification.
```

```text
Owner: Codex
Commit: this commit
Scope: AI quota enforcement hardening
Files:
- lib/saas/ai-quota.ts
- app/api/v1/ai/analyze/route.ts
- tests/unit/saas-ai-quota.test.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Return AI analysis now checks monthly non-cached successful AI usage against org.plan before Gemini provider calls. Cache hits remain allowed and do not consume quota.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin API DTO wiring
Files:
- app/api/internal/saas/orgs/route.ts
- app/api/internal/saas/orgs/[id]/route.ts
- app/api/internal/saas/billing/events/route.ts
- lib/saas/platform-admin-data.ts
- tests/unit/saas-platform-admin-routes.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Internal platform admin APIs now return UI contract DTOs and require real usage snapshots. Feature flag remains closed by default.
```

```text
Owner: Codex
Commit: this commit
Scope: Convert UI mock contracts to backend DTOs
Files:
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: No live backend routes exposed. DTO builders require real usage snapshots instead of fake production data.
```

```text
Owner: Claude
Commit: f0a937a
Scope: Task 3 safe subset + Task 5 RWD audit
Files:
- components/saas/page-header.tsx
- app/(admin)/logistics/page.tsx
- app/(admin)/settings/page.tsx
Status: done
Notes: UI-only. Large client-heavy admin pages remain deferred.
```

```text
Owner: Claude
Commit: f216cc8
Scope: Task 1 + 2 partial - SaaS settings and platform admin UI polish
Files:
- components/saas/demo-data-banner.tsx
- components/saas/usage-progress.tsx
- components/internal/nav-link.tsx
- app/(admin)/settings/billing/page.tsx
- app/(admin)/settings/usage/page.tsx
- app/(admin)/settings/team/page.tsx
- app/internal/layout.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- app/internal/billing/events/page.tsx
Status: done
Notes: UI-only. Build issue from server-to-client icon prop was fixed by using an iconName string.
```

```text
Owner: Claude
Commit: 927bf1a
Scope: Task 4 - Empty / loading / error states
Files:
- app/not-found.tsx
- app/(admin)/loading.tsx
- app/(admin)/error.tsx
- app/(admin)/returns/loading.tsx
- app/(admin)/returns/[id]/loading.tsx
- app/(admin)/shopee-returns/loading.tsx
- app/(admin)/shopee-returns/[id]/loading.tsx
- app/(customer)/portal/loading.tsx
- app/(customer)/portal/error.tsx
Status: done
Notes: UI-only, no data layer changes.
```

```text
Owner: Codex
Commit: 6863003
Scope: Shared review checklist
Files:
- agent-shared/REVIEW_CHECKLIST.md
- agent-shared/README.md
- agent-shared/TASK_BOARD.md
Status: done
Notes: Added handoff, commit, and push checklist.
```
