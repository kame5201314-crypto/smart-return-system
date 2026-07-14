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

```text
Owner: Codex
Commit: 7838530, e9ff6c3, 6e4e5a6, 24ac804, e7695e8
Scope: Public lead capture and Manual Beta operations closure
Files:
- supabase/migrations/039_saas_public_lead_capture.sql
- lib/saas/lead-capture*.ts
- lib/saas/platform-lead-management.ts
- app/api/saas/leads/route.ts
- app/api/internal/saas/leads/**
- app/internal/leads/page.tsx
- components/marketing/lead-capture-form.tsx
- components/internal/platform-leads-list.tsx
- components/internal/org-billing-operation-controls.tsx
Status: done
Notes: Lead capture is independently gated from public signup. Owner-authorized migration 039 was applied only to SaaS project `auyznbwtjvemyamujmgt` on 2026-07-14; remote history, five columns, six constraints, strict migration plan, and strict schema gate were verified. Owner also authorized `ENABLE_PUBLIC_LEAD_CAPTURE=true` only for Vercel Production project `smart-return-system-saas`; the env name is present, but a new production deployment is still required before runtime activation. Migrations 034 and 036 remain unapplied. Manual LINE/copy/Email channels remain available. Manual payment uses the already-applied platform billing operation RPC; billing/provider/email/public signup remain disabled. Full lint, typecheck, unit, E2E, integration, UI, build, doctor, and rollout checks passed at e7695e8.
```

## Current

```text
Owner: none
Started:
Scope:
Files:
Status:
Notes: Closed Manual Beta is live and the first Beta customer has been provisioned. Production now runs `f009621 fix(saas): sign return image storage URLs` on Vercel deployment `dpl_qJfFc3z5UFc7Qqb6u5DmNCSoae8v` (Ready), aliased to `https://smart-return-system-saas.vercel.app`; `npm run saas:production-smoke` passed 16/16 after deployment. This deployment includes the post-`796a02a` Shopee workspace-error localization, SEO infrastructure, public access for `robots.txt`, `sitemap.xml`, and `opengraph-image`, the 499/699 pricing contract, the multi-channel honesty copy, platform tenant suspend/resume UI, `/internal` server-side non-admin redirect hardening, tenant list operations UI, and signed return-image storage URL handling. After deploying `f009621`, Codex switched SaaS Supabase project `auyznbwtjvemyamujmgt` bucket `return-images` from `public=true` to `public=false`; storage verification confirmed the bucket is private, and no existing object was found in the bucket during the signed/public URL smoke. 2026-06-06 Sentry setup completed and Vercel Production env has `SENTRY_DSN` plus `NEXT_PUBLIC_SENTRY_DSN`. 2026-06-06 owner-authorized migration `035_saas_onboarding_completion_rpc.sql` was applied only to SaaS project `auyznbwtjvemyamujmgt`; 2026-06-26 owner-authorized migration `037_saas_team_invite_status.sql` was also applied only to the same SaaS project; 2026-07-01 owner-authorized migration `038_saas_org_member_visibility.sql` was applied only to the same SaaS project; 2026-07-09 owner-authorized migration `033_saas_platform_billing_operations.sql` was applied only to the same SaaS project, remote migration history records `033` as applied, and `/internal/orgs/[id]` now exposes guarded `暫停租戶` / `恢復租戶` controls through the existing platform billing operations API; `034` and `036` remain unapplied. Owner confirmed `smart-return.tw` has not been purchased and chose to continue Closed Manual Beta on `https://smart-return-system-saas.vercel.app`; custom domain work remains deferred until the owner buys/registers a domain and explicitly reauthorizes DNS/Vercel verification. Vercel inspect lists the historical `app.smart-return.tw` alias for the latest deployment, but customer traffic should continue to use the Vercel production URL until domain ownership/DNS is deliberately resumed. Email provider remains disabled; Resend is the recommended first provider after owner prepares a Resend account, verified sender domain, `RESEND_API_KEY`, sender address, and delivery scope decision. Current email backend supports queue creation and dry-run inspection only; provider adapter/status-update/retry-audit work is still a future authorized Codex task. Public multi-tenant hardening/gating is complete for the reviewed Shopee, pickup, customer-return, upload/signed-url, backup, maintenance cron, and return-image storage paths. Team management P1 invite schema blocker is resolved by migration `037`, and owner/admin same-org member visibility is resolved by migration `038`; full `/settings/team` browser QA should use a disposable org before real staff are invited. The current ordered go-live plan is in `docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md`: closed free/manual Beta is acceptable with controlled scope; first paid manual customers require invoice/receipt capability, finalized legal/refund wording, payment-record SOP, and legal review of the privacy/DPA/deletion SOP; public paid self-serve remains blocked by email, ECPay, public signup/provisioning, lifecycle automation, and provider-backed invoice flow. The latest predeploy pass succeeded: safety, env, rollout check, schema gate, lint, typecheck, test:scripts-backend, unit, e2e, integration, and build passed; rollout warnings were the expected local admin password/Sentry/Billing warnings. Owner/legal/accounting still must confirm invoice/receipt capability and legal wording before collecting money. No unblocked local Codex backend task is currently recorded without explicit owner authorization; production read-only `/admin` and `/internal` env/route verification is complete, and Vercel Production env names include `ENABLE_MULTI_TENANT_ADMIN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` but not `PLATFORM_ADMIN_ROLES`. Do not deploy again, run additional migrations, edit env/secrets, enable billing/provider/email, configure domain/DNS, touch master/live/prod, or use production/internal Supabase without explicit owner authorization and real values.
```

## Recent Completed

```text
Owner: Codex
Commit: this commit
Scope: Production smoke script
Files:
- scripts/saas/production-smoke.mjs
- package.json
- docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added read-only `npm run saas:production-smoke` for post-deploy public route, pricing marker, and unauthenticated redirect checks against `https://smart-return-system-saas.vercel.app` by default, with override support through `SAAS_PRODUCTION_URL` or `--url=`. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: 82b51c5
Scope: Closed Beta onboarding runbook
Files:
- docs/SAAS_CLOSED_BETA_ONBOARDING_RUNBOOK.md
- docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md
- docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added a customer/operator runbook for Closed Manual Beta: account handoff without storing passwords, first-session flow through `/login`, `/analytics`, `/shopee-returns`, `/returns`, `/analytics/ai-report`, and `/settings/usage`, honest Shopee automated vs official-site/momo manual scope, platform `/internal` follow-up, daily Beta tracking fields, escalation rules, and acceptance criteria. No account provisioning, customer data import, migration, deployment, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: 389bf53
Scope: Owner-authorized production deploy of 3fadd75
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized deploying latest `develop-saas` HEAD `3fadd75 docs(saas): record production deployment gap` to Vercel Production project `smart-return-system-saas`. Preflight, `npm run safety:agent-boundary`, and `npm run saas:predeploy` passed. Deployed to `dpl_2ELVrGvkGzEF47juNTZA9yu5UV76` (Ready), aliased to `https://smart-return-system-saas.vercel.app`; smoke confirmed public routes, protected redirects, and `/pricing` now shows 499/699 markers plus multi-channel honesty copy. No migration, env/secret edit, domain/DNS command, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or unrelated production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Privacy, DPA, and data deletion SOP
Files:
- docs/SAAS_PRIVACY_DPA_DELETION_SOP.md
- docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added the repo-side SOP for privacy roles, data categories, draft retention defaults, subprocessor register, merchant deletion workflow, DPA checklist, security incident workflow, and cookie/analytics tracking. This prepares legal/privacy operating readiness before paid/public rollout. Owner/legal must still finalize public legal wording. No data export/deletion, migration, deployment, env/secret edit, provider/billing/domain change, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Go-live risk and service plan
Files:
- docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added the ordered launch/subscription/service risk plan for Closed Manual Beta, first paid manual customers, and public self-serve paid launch. The plan records that `038` plus read-only production `/internal` verification and disposable-org QA are the next owner-authorized technical steps, while invoice/legal/payment-record readiness is required before collecting money. No migration, deployment, env/secret edit, email/billing/provider enablement, domain/DNS change, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Go-live local execution pass
Files:
- docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Ran the local non-external gate sequence for the go-live plan: safety, lint, typecheck, saas:migration-plan:strict, saas:schema-gate:strict, test:all, saas:doctor, and build. All passed; saas:doctor reported 165 pass, 1 expected local `ENABLE_MULTI_TENANT_ADMIN=true` warning, 0 fail. No migration, deployment, env/secret edit, email/billing/provider enablement, domain/DNS change, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Manual payment and support SOP
Files:
- docs/SAAS_MANUAL_PAYMENT_SUPPORT_SOP.md
- docs/SAAS_GO_LIVE_RISK_AND_SERVICE_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added the repo-side SOP for manual payment records, manual payment workflow, refund review, Basic/Growth support SLA, Beta onboarding, and escalation triggers. This prepares the non-provider operating workflow before ECPay/email automation. Owner/legal/accounting still must confirm invoice/receipt capability before collecting money. No migration, deployment, env/secret edit, email/billing/provider enablement, domain/DNS change, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin privacy-boundary regression
Files:
- tests/unit/saas-platform-admin-live-data.test.ts
- docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added a regression test that injects customer return detail fields into the platform admin repository fixture and asserts dashboard, org list, and org detail DTO payloads do not contain order numbers, buyer names, phone numbers, addresses, return reasons, or nested return detail arrays. This keeps `/internal` focused on tenant health/usage rather than customer return detail data. No migration, deployment, env/secret edit, provider/billing/domain change, or master/live/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: AI returns to platform admin QA contract
Files:
- supabase/migrations/038_saas_org_member_visibility.sql
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- tests/unit/saas-platform-admin-data.test.ts
- docs/SAAS_AI_RETURNS_PLATFORM_QA_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added a repo-only QA contract for the AI return system and commercial platform admin connection. Platform admin usage aggregation now has direct unit coverage proving return and AI usage summaries are sourced from org-scoped `return_requests` and non-cached successful `ai_usage_events`. Added a full manual QA plan for merchant `/analytics` to `/internal` verification and drafted migration `038_saas_org_member_visibility.sql` to let owner/admin users read same-org `organization_members` rows through a helper-backed, non-recursive RLS policy. Updated migration-plan/readiness coverage. No migration was applied, no deployment was performed, no env/secrets/domain/provider/billing setting was changed, and no master/live/internal Supabase operation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Pricing plan contract refresh
Files:
- lib/config/saas-plans.ts
- components/marketing/commercial-data.ts
- app/pricing/page.tsx
- app/page.tsx
- app/features/ai/page.tsx
- app/legal/terms/page.tsx
- components/internal/manual-beta-org-form.tsx
- scripts/saas/readiness-check.mjs
- tests/unit/saas-commercial-config.test.ts
- tests/unit/saas-ai-quota.test.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- tests/unit/saas-platform-admin-routes.test.ts
- tests/unit/saas-public-signup-request.test.ts
- tests/unit/saas-notifications.test.ts
- tests/unit/saas-org-context.test.ts
- tests/unit/saas-platform-admin-billing-operations.test.ts
- tests/e2e/platform-admin-dashboard-flow.e2e.test.ts
- docs/SAAS_PRODUCT_SPEC.md
- docs/SAAS_ARCHITECTURE_DECISION.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Updated the commercial SaaS pricing contract to two public plans plus quote-only enterprise: `basic` NT$499 / 3 seats / 300 monthly return soft limit / 10 AI, `growth` NT$699 / 5 seats / 800 monthly return soft limit / 25 AI with advanced analytics, and `enterprise` quote-only with unlimited contract limits and API access. Removed runtime `pro` from plan definitions and UI/backend contracts, updated readiness coverage and plan-sensitive tests, and kept migration history untouched. Ran focused plan/contract tests, lint, typecheck, test:all, saas:doctor, and build successfully. No deployment, migration, env/secret edit, billing/provider enablement, domain/DNS change, or master/live/internal Supabase operation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Owner-authorized migration 037 apply
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized applying only `037_saas_team_invite_status.sql` to SaaS Supabase project `auyznbwtjvemyamujmgt`. Ran preflight/safety, confirmed remote migration list showed `033`, `034`, `036`, and `037` pending with `035` applied, executed only the `037` SQL through `supabase db query --linked --file`, repaired remote migration history for version `037` to applied, and confirmed remote migration list now shows `037` applied while `033`, `034`, and `036` remain unapplied. `npm run saas:schema-gate:strict` now passes. No deployment, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or migrations `033`/`034`/`036` apply was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Team management P1 invite status schema draft
Files:
- supabase/migrations/037_saas_team_invite_status.sql
- lib/saas/invite-policy.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/check-saas-schema-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-invite-policy.test.ts
- tests/unit/saas-schema-readiness.test.ts
- tests/unit/saas-migration-plan.test.ts
- docs/SAAS_TEAM_MANAGEMENT_P1_SPEC.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added draft migration `037_saas_team_invite_status.sql` to align the real SaaS DB schema with the implemented team-management P1 backend/UI. It adds `organization_invites.status`, backfills accepted/expired states, adds an org/status index, and refreshes invite accept/create RPCs after the column exists. Updated invite status policy and readiness/migration/schema gates. No migration was applied, no deployment/env/provider/billing/domain change was performed, and production/internal Supabase was not touched.
```

```text
Owner: Codex
Commit: this commit
Scope: Team management P1 backend contract
Files:
- lib/saas/team-management.ts
- app/api/saas/team/members/[id]/route.ts
- app/api/saas/team/members/[id]/disable/route.ts
- app/api/saas/team/invites/[id]/revoke/route.ts
- app/api/saas/team/invites/[id]/resend/route.ts
- lib/saas/settings-team-data.ts
- lib/saas/settings-live-data.ts
- lib/saas/ui-backend-contracts.ts
- lib/saas/invite-token-data.ts
- lib/saas/team-invite-route.ts
- tests/unit/saas-team-management.test.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Implemented the Codex backend contract from `docs/SAAS_TEAM_MANAGEMENT_P1_SPEC.md` §C for merchant team management: role changes, non-destructive member disable, pending invite revoke, and pending/expired invite resend/regenerate link. Mutations require owner/admin writable org context, scope by `org_id` plus member/invite id, enforce owner/admin management boundaries, block self and last-active-owner unsafe changes, write audit logs, and expose per-row member/invite action flags for Claude UI. No UI page/component, migration, deployment, env/secret edit, email provider, billing/provider, master/live/internal Supabase, or production DB change was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Custom domain deferral documentation
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner confirmed `smart-return.tw` has not been purchased and decided to use `https://smart-return-system-saas.vercel.app` for Closed Manual Beta. Updated rollout docs so future agents do not repeatedly retry `app.smart-return.tw` DNS/Vercel verification as an active blocker. No deploy, migration, env/secret edit, DNS/domain mutation, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production DB change was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Domain ownership and email provider planning
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Rechecked Vercel project/domain state and confirmed local project link points to `smart-return-system-saas`, but current CLI scope cannot inspect/manage `smart-return.tw` or `app.smart-return.tw` and DNS is still NXDOMAIN. Documented owner dashboard/DNS steps: add `app.smart-return.tw` to the SaaS Vercel project, add any exact Vercel TXT ownership challenge, and set `CNAME app -> cname.vercel-dns.com`. Reviewed email queue code and documented Resend as the recommended first provider; current code remains dry-run only and still needs a future provider adapter/status update/retry/audit implementation after credentials and owner authorization. No deploy, migration, env/secret edit, DNS mutation, provider enablement, billing enablement, master/live/internal Supabase action, or production DB change was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Vercel dashboard domain detail refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner opened the Vercel Dashboard and Codex inspected project `smart-return-system-saas` -> Domains. `app.smart-return.tw` is present but still `Invalid Configuration`; no TXT ownership challenge is visible, and Vercel shows the required DNS record as `CNAME app -> 64ed959ebaa2a805.vercel-dns-016.com.`. TWNIC RDAP for `smart-return.tw` returned 404 and local DNS for `smart-return.tw` / `app.smart-return.tw` still has no records, so the owner must confirm the root domain is registered/delegated and add the CNAME at the DNS provider. No domain purchase, DNS edit, alias, deploy, migration, env/secret edit, provider enablement, billing enablement, master/live/internal Supabase action, or production DB change was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Read-only SaaS rollout status check
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Rechecked production and owner-blocked rollout items without deploy/migration/env/DNS/provider changes. Vercel production alias remains on `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot` (Ready). `https://smart-return-system-saas.vercel.app` public smoke returned 200 and protected routes returned 307 redirects. `app.smart-return.tw` remains blocked because DNS is NXDOMAIN, HTTPS cannot resolve host, Vercel domain inspect returns 403, and `vercel domains ls` shows 0 domains. Sentry env names are present; email provider and ECPay credential names are not visible. Draft migrations `033`, `034`, and `036` still require separate owner authorization.
```

```text
Owner: Codex
Commit: this commit
Scope: Owner-authorized production deploy of f634bc0
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized deploying `develop-saas` latest HEAD `f634bc0 fix(saas): keep SEO metadata routes public` to Vercel Production project `smart-return-system-saas`. Preflight, `npm run safety:agent-boundary`, and `npm run saas:predeploy` passed. Deployed to `dpl_2YWna1ojcAQQ5YbQ2SByKxd5oJot` (Ready), with `https://smart-return-system-saas.vercel.app` smoke passing for public routes, SEO metadata routes, tenant redirects, and platform redirects. Vercel CLI auto-listed existing alias `app.smart-return.tw`, but DNS still does not resolve and SSL was asynchronous, so the custom domain remains not ready for use. No migration, env/secret edit, separate domain/DNS command, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or unrelated production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Post-rollout production and custom-domain recheck
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Rechecked deployment `dpl_28RhEVo2Nespq7xjTEQvmELag34r`, which remains Ready. `https://smart-return-system-saas.vercel.app` smoke still passes for public routes, merchant redirects, and platform redirects. Vercel inspect lists `app.smart-return.tw` as an alias, but DNS for `app.smart-return.tw` and `smart-return.tw` is still NXDOMAIN, direct HTTPS cannot resolve the host, Vercel domain inspect returns 403, and `vercel domains ls` reports 0 domains in the current scope. No deploy, migration, env/secret edit, DNS mutation, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Owner-authorized production deploy of 796a02a
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized deploying `develop-saas` latest HEAD `796a02a` to Vercel Production project `smart-return-system-saas`. Preflight, `npm run safety:agent-boundary`, and `npm run saas:predeploy` passed. Deployed to `dpl_28RhEVo2Nespq7xjTEQvmELag34r` (Ready), with `https://smart-return-system-saas.vercel.app` smoke passing for public routes, tenant redirects, and platform redirects. Vercel CLI auto-listed existing alias `app.smart-return.tw`, but DNS still does not resolve and SSL was asynchronous, so the custom domain remains not ready for use. No migration, env/secret edit, separate domain/DNS command, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or unrelated production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Sequential completion readiness check
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner asked to continue completing the remaining queue in order. Re-ran safe local checks only: `npm run saas:doctor` passed with 155 pass / 1 expected local platform-admin warning / 0 fail; `npm run saas:rollout-check` reported 22 pass / 3 warn / 0 fail; `Resolve-DnsName app.smart-return.tw` still returns NXDOMAIN. No external mutation was performed because DNS/provider/billing/migration items still require real values or explicit per-action authorization.
```

```text
Owner: Codex
Commit: this commit
Scope: Split queue status refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Reconciled the post-`b2fc132` state for future Claude/Codex handoffs. Local implementation work is complete and pushed; production still runs `0c9c983` / `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`; remaining work is external/owner-blocked unless a new local task is explicitly assigned. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin dashboard alert copy refinement
Files:
- app/internal/page.tsx
- components/internal/platform-labels.ts
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: `/internal` now uses denser KPI cards, localizes the trial pipeline helper, and maps at-risk alert types to operator-facing messages plus suggested actions. No backend DTO, deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Merchant settings secondary-entry gating
Files:
- app/(admin)/settings/page.tsx
- app/(admin)/settings/backup/page.tsx
- components/saas/backup-settings-client.tsx
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Completed the follow-up to the merchant sidebar cleanup. `/settings` now keeps the primary sidebar lean while surfacing `/onboarding` only when onboarding is incomplete and `/settings/backup` only for owner/admin users. `/settings/backup` now has a matching server-side owner/admin plus exportable gate before rendering the client backup tool. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform operations UI simplification handoff
Files:
- app/(admin)/layout.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- app/internal/billing/events/page.tsx
- components/internal/platform-labels.ts
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Finalized the working-tree UI refinement for the Beta operations console. `/internal/orgs` now shows trial deadline/remaining days from the Codex DTO, displays suggested actions for risk reasons, and removes the disabled tenant pause button in favor of one Stage 2 note while keeping the manual beta org form. `/internal/orgs/[id]` localizes operator-facing labels, displays suggested risk actions, and collapses disabled plan/status write buttons into the Stage 2 note while preserving tenant preview. `/internal/billing/events` removes the static webhook checklist, localizes status labels, and replaces the disabled retry button with one read-only Stage 2 note. The merchant sidebar removes `/onboarding` and `/settings/backup` from primary navigation. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform organization trial deadline DTO handoff
Files:
- lib/saas/ui-backend-contracts.ts
- lib/saas/platform-admin-live-data.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: `/internal/orgs` and `/internal/orgs/[id]` live data loaders now fetch subscription snapshots and include `trialEnd` plus `daysUntilTrialEnd` in `PlatformOrganizationListItem`, enabling Claude to add Trial 到期日 / 剩餘天數 columns without UI-side data fetching. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Owner-authorized production deploy of current origin/develop-saas HEAD
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized deployment of current `origin/develop-saas` HEAD to Vercel Production project `smart-return-system-saas`, requiring inclusion of `27c5ecb fix(saas): gate backup and maintenance cron isolation`. Pulled latest `develop-saas`, confirmed deployed HEAD `0c9c983` contains `27c5ecb`, ran `npm run saas:predeploy` successfully, deployed to Vercel deployment `dpl_EwmXZXdxNAYHZdoBNRHN5kQnW7yu`, and production smoke passed for public routes, tenant protected redirects, and platform protected redirects. No migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or additional provider setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: P2 backup action and backup cron tenant gating
Files:
- lib/actions/backup.actions.ts
- app/api/cron/backup/route.ts
- app/api/cron/reconcile-ai-reports/route.ts
- app/api/cron/scan-retention/route.ts
- app/api/cron/shopee-scan-daily-report/route.ts
- app/api/cron/shopee-scan-smoke/route.ts
- lib/maintenance/cron-policy.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- docs/SAAS_TENANT_ISOLATION_AUDIT.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Backup actions now require owner/admin org context for tenant calls, scope backup table reads/writes/restores by `org_id`, restrict storage paths to `backups/{orgId}/`, and reject cross-org restore/download/delete. The backup cron no longer performs platform-wide backup by default; it skips safely unless `SAAS_BACKUP_ORG_ID` is configured, then runs the hardened backup action for that explicit org id. Non-backup maintenance cron routes now skip unless `ENABLE_PLATFORM_MAINTENANCE_CRON=true`. No deployment, migration, env/secret edit, `SAAS_BACKUP_ORG_ID` or `ENABLE_PLATFORM_MAINTENANCE_CRON` env setting, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: P1 pickup/customer/upload tenant isolation hardening
Files:
- lib/actions/pickup.actions.ts
- lib/actions/customer-return.actions.ts
- lib/actions/upload.ts
- lib/upload/security.ts
- app/api/v1/upload/signed-url/route.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- tests/unit/upload-signed-url.route.test.ts
- tests/unit/pickup.actions.test.ts
- tests/backend/pickup-scan.backend.test.ts
- docs/SAAS_TENANT_ISOLATION_AUDIT.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Continued public multi-tenant P1 hardening after Shopee. Pickup actions now use read/writable SaaS org context and explicit `org_id` filters/inserts for pickup records and scan updates. Customer-return public portal writes derive org scope from an existing matched order number + phone, reject missing/ambiguous org matches, and write/filter returns, images, items, logs, and final storage paths by org. Upload helpers now require org context and signed-url sessions support org-scoped staging paths with legacy anonymous staging fallback. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: P1 Shopee tenant isolation hardening
Files:
- lib/actions/shopee-returns.actions.ts
- tests/unit/saas-runtime-org-isolation.test.ts
- tests/e2e/shopee-scan-flow.e2e.test.ts
- docs/SAAS_TENANT_ISOLATION_AUDIT.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner confirmed broad multi-customer rollout. Hardened Shopee return and scan actions with SaaS org context and `org_id` scoping for reads, imports, updates, deletes, scan events, unmatched scans, dashboard, search, and manual bind. Added regression coverage and updated the rollout queue. No deployment, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Owner-authorized migration 035 apply
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized applying only `035_saas_onboarding_completion_rpc.sql` to SaaS Supabase project `auyznbwtjvemyamujmgt`. Ran preflight, safety, `npm run saas:migration-plan:strict`, applied only 035 through the linked SaaS DB query path, repaired remote migration history for version `035`, and confirmed the RPC exists with service-role execute privilege. `npm run saas:schema-gate:strict` passed and `npm run saas:doctor` reported 155 pass, 1 expected local flag warning, 0 fail. No deployment, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or migrations `033`/`034`/`036` apply was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Next owner-blocked queue hardening
Files:
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Recorded the post-Sentry next executable order and the stop condition for agents asked to finish everything without external values. No deploy, migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Sentry setup and production redeploy
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Created Sentry org `smart-return-saas` with Google account `kawei88888@gmail.com`, selected Next.js setup, copied DSN without committing it, set Vercel Production env `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, and redeployed production to `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`. Production smoke passed. No migration, source code change, custom domain/DNS change, email provider enablement, billing/provider enablement, master/live/internal Supabase action, or DSN commit was performed.
```

```text
Owner: Codex
Commit: 360c56f
Scope: Owner-blocked launch readiness audit
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/SAAS_EXTERNAL_OWNER_ACTIONS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Completed the safe read-only launch checks requested by the owner. Confirmed Vercel project `smart-return-system-saas`, production deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` Ready, no visible Sentry DSN env keys, no visible custom/beta domain, no visible email provider keys, no visible ECPay/provider keys, billing disabled for Manual Beta, and migrations `033`-`036` still only draft/unapplied. Ran `npm run saas:doctor`, `npm run saas:rollout-check`, `npm run lint`, `npm run typecheck`, and `npm run test:all`. No deploy, migration, env/secret edit, domain/DNS change, provider enablement, billing enablement, master/live/prod/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: 54cffed
Scope: Post-deploy external blocker audit
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Read-only check confirmed production alias is still Ready on deployment `dpl_x5K1udVYJBGo1sMEwenry9csz8UR`. Vercel env names still do not list Sentry DSN, ECPay/provider credentials, or email provider keys. No custom/beta domain is visible from the alias/project check. Draft migrations `033`-`036` remain present as repo drafts and recorded as unapplied. No deploy, migration, env/secret edit, domain/DNS change, provider enablement, billing enablement, master/live/prod/internal Supabase action, or production setting mutation was performed.
```

```text
Owner: Codex
Commit: 05bf8d2
Scope: Owner-authorized production deployment of latest UI HEAD
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Owner authorized deploying `develop-saas` HEAD `9176589 fix(saas/ui): finish public RWD and role separation polish` to Vercel production project `smart-return-system-saas`. Ran `npm run saas:predeploy` before deployment; it passed. New production deployment is `dpl_x5K1udVYJBGo1sMEwenry9csz8UR` (Ready), aliased to `https://smart-return-system-saas.vercel.app`. Smoke passed for public routes, unauthenticated merchant-route redirects, and unauthenticated platform-route redirects. No migration, env/secret edit, Sentry/domain/email/billing/provider enablement, master/live/prod/internal Supabase action, or billing activation was performed.
```

```text
Owner: Codex
Commit: 9176589
Scope: Public marketing/legal RWD QA and UI touch targets
Files:
- components/marketing/site-shell.tsx
- components/marketing/mobile-nav.tsx
- app/features/returns/page.tsx
- app/features/ai/page.tsx
- app/features/security/page.tsx
- app/contact/page.tsx
- app/signup/page.tsx
- app/login/page.tsx
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Ran local public/legal smoke and Chrome DevTools mobile QA for `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/legal/terms`, `/legal/privacy`, `/legal/refund`, and `/signup`. All returned 200, no mobile horizontal overflow was detected at 390x844, and public marketing links/CTAs now meet 44px touch target sizing. Wrapped the `/login` search-param UI in a Suspense boundary so Next 16 production build can prerender the login route. Lint currently reports no warnings. No backend/API/server action/migration/env/billing/provider change was made.
```

```text
Owner: Codex
Commit: this commit
Scope: Read-only tenant isolation audit refresh
Files:
- docs/SAAS_TENANT_ISOLATION_AUDIT.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Audited current SaaS tenant isolation without running migrations or changing env/deploy/provider settings. Confirmed `npm run saas:schema-gate:strict` passes read-only and P0 return actions, AI analyze route, and export routes are covered by org-context/org_id regression tests. Recorded remaining public multi-tenant gaps in Shopee returns actions, pickup actions, customer portal actions, upload/signed-url, backup actions, and cron/maintenance service-role paths. `proxy.ts` was not changed.
```

```text
Owner: Codex
Commit: b3bf314
Scope: Public signup rate limit hardening
Files:
- lib/security/request-rate-limit.ts
- app/api/saas/signup/route.ts
- scripts/saas/readiness-check.mjs
- tests/unit/request-rate-limit.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added shared in-memory request throttling and applied it to `POST /api/saas/signup` ahead of any future public signup rollout. Public signup remains disabled by default. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Mutation route same-origin hardening
Files:
- lib/security/same-origin.ts
- app/api/v1/upload/session/route.ts
- app/api/v1/upload/signed-url/route.ts
- app/api/v1/ai/analyze/route.ts
- app/api/saas/signup/route.ts
- app/api/saas/invite/accept/route.ts
- app/api/saas/onboarding/complete/route.ts
- app/api/saas/team/invites/route.ts
- app/api/internal/saas/orgs/route.ts
- app/api/internal/saas/orgs/[id]/preview/route.ts
- app/api/internal/saas/tenant-preview/route.ts
- app/api/internal/saas/platform-admins/route.ts
- app/api/internal/saas/billing/operations/route.ts
- app/api/internal/saas/billing/events/[id]/retry/route.ts
- scripts/saas/readiness-check.mjs
- tests/unit/same-origin-request.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added a shared same-origin guard for browser-driven mutation APIs. The guard rejects explicit cross-site `Sec-Fetch-Site`, `Origin`, and `Referer` requests while allowing missing browser origin headers for non-browser clients. ECPay webhook, cron, and schema alert routes remain excluded because they are provider/secret-gated server-to-server paths. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin login rate limit hardening
Files:
- lib/auth/admin-login-rate-limit.ts
- lib/actions/auth.ts
- scripts/saas/readiness-check.mjs
- tests/unit/admin-login-rate-limit.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added best-effort, per-runtime throttling for platform admin password login attempts by login id and client IP. The external audit suggestion to rename `proxy.ts` was not applied because this repo is on Next.js 16.2.6 and local builds recognize `proxy.ts` as `Proxy (Middleware)`. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Launch security hardening
Files:
- lib/security/headers.ts
- next.config.ts
- package.json
- package-lock.json
- scripts/saas/readiness-check.mjs
- tests/unit/security-headers.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added browser security headers, unit coverage, SaaS doctor coverage, and non-breaking dependency audit updates. High-severity npm audit findings are cleared; 4 moderate nested `postcss`/`uuid` advisories remain because npm only offers breaking `--force` dependency changes. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Post-push Vercel preview status correction
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Recorded that after pushing `82d8b0d`, Vercel Preview alias still pointed at old Preview `dpl_5qqTLC2gQ6AZKWoF2oqteygma4nd`. Production remains unchanged and any launch still needs explicit deploy/promote authorization. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Git/Vercel linkage status refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Recorded that `develop-saas` HEAD `bf371b8` is synchronized with origin and produces Vercel Preview deployments, while production remains on `a3af638` / `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` until explicit owner authorization. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Authenticated merchant `/admin` entry separation
Files:
- lib/auth/proxy-login-redirect.ts
- proxy.ts
- tests/unit/proxy-login-redirect.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Authenticated merchant users who hit `/admin` now redirect to `/analytics` instead of falling through to `/internal` forbidden. Direct `/internal/*` access still stays gated/forbidden for Claude-owned switch-account UI. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Proxy login redirect platform admin separation
Files:
- lib/auth/proxy-login-redirect.ts
- proxy.ts
- tests/unit/proxy-login-redirect.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Authenticated platform admins who revisit `/login` now resolve to `/internal` or a safe `/internal/*` next path, while merchant users continue to resolve to `/analytics`. This closes the proxy-level mismatch after explicit platform admin identity separation. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Explicit platform admin identity separation
Files:
- lib/auth/platform-admin-identity.ts
- lib/auth/route-auth.ts
- lib/actions/auth.ts
- lib/auth/post-login-redirect.ts
- scripts/saas/readiness-check.mjs
- tests/unit/platform-admin-identity.test.ts
- tests/unit/post-login-redirect.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Platform admin access and post-login redirects no longer use legacy `users.role='admin'` as a platform grant. Real platform admins must use the internal admin session, explicit `ADMIN_EMAIL` / email-style `ADMIN_USERNAME`, or a valid `PLATFORM_ADMIN_ROLES` mapping. No deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Latest Git readiness record
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Recorded that latest application/UI HEAD is `a63cfe2`, local `npm run saas:predeploy` passes, and production remains on `a3af638` / `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` until owner explicitly authorizes deployment. No deployment, migration, env/secret edit, Sentry/domain/email/billing provider setup, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Claude
Commit: a63cfe2
Scope: Not-found SaaS branding
Files:
- app/not-found.tsx
Status: done
Notes: Aligned the not-found page copy and palette with SaaS branding. UI-only; no backend/API/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: 31e2362
Scope: Internal loading skeleton
Files:
- app/internal/loading.tsx
Status: done
Notes: Added a loading skeleton for platform internal pages. UI-only; no backend/API/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: ca773c8
Scope: Login page SaaS branding
Files:
- app/login/page.tsx
Status: done
Notes: Aligned the login page with Smart Return SaaS branding and restored the missing `next/link` import so the production build passes. UI-only except for the import required by the existing JSX; no backend/API/migration/env/deploy changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin canonical entry routes
Files:
- app/admin/page.tsx
- app/admin/login/page.tsx
- lib/auth/public-routes.ts
- lib/auth/internal-login-redirect.ts
- proxy.ts
- scripts/saas/readiness-check.mjs
- tests/unit/internal-login-redirect.test.ts
- tests/unit/public-routes.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added `/admin` as the operator-facing platform admin entry and `/admin/login` as the platform-admin login alias. `/admin/login` is public so unauthenticated operators can reach the shared login form. Proxy-level unauthenticated `/admin` and `/internal/*` access now redirects to `/admin/login?next=...`, while merchant users remain routed to `/analytics` and authenticated non-admin internal access remains forbidden. Claude owns the visual login/forbidden/sidebar copy polish that explains the account switch clearly. No deployment, migration, env/secret edit, billing/provider enablement, or master/live/prod change was performed.
```

```text
Owner: Codex
Commit: a3af638
Scope: Onboarding guide legacy RLS recursion hotfix
Files:
- lib/saas/onboarding-live-data.ts
- tests/unit/saas-onboarding-live-data.test.ts
Status: done
Notes: Optional return-policy signal lookup now treats legacy `system_settings` -> `users` RLS recursion as an incomplete signal instead of failing the whole onboarding page. Deployed to Vercel production deployment `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr`; unauthenticated `/onboarding` still redirects to `/login`. No migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Latest HEAD production deployment record
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Recorded owner-authorized deployment of latest develop-saas HEAD `c699e70` to Vercel production deployment `dpl_9KFNXG1Cw6k54uvSJNuruJchDb5H`. Predeploy gates passed, deployment is Ready, public routes returned 200, and protected unauthenticated routes redirected to /login. Sentry DSN remains missing because no real DSN value is available; no migration, env/secret edit, domain/DNS change, email provider enablement, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Latest deploy readiness status refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Read-only refresh recorded that `develop-saas` is synced at `4a1d7f8`, latest HEAD includes Claude UI improvements through `615ce7c`, and production still remains on Ready deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` until owner authorizes deploying latest HEAD. Sentry DSN, beta/custom domain, email provider delivery, Billing/ECPay, and draft migrations `033`-`036` remain owner-blocked. No deploy, migration, env/secret edit, domain/DNS change, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Claude
Commit: 615ce7c
Scope: Marketing mobile navigation drawer
Files:
- components/marketing/mobile-nav.tsx
- components/marketing/site-shell.tsx
Status: done
Notes: MarketingShell now exposes a mobile drawer below md for public links, legal links, and login while keeping the existing desktop nav and sticky conversion CTA. UI-only; no backend, route, persistence, billing, migration, env, or deploy changes were reported.
```

```text
Owner: Claude
Commit: 60e702d
Scope: Onboarding next-step focus card
Files:
- app/(admin)/onboarding/page.tsx
Status: done
Notes: /onboarding now surfaces the current setup step above the progress card from loadSaaSOnboardingView(), reusing existing step metadata and the existing completion button path. UI-only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported. Completion writes still depend on explicit migration 035 apply before production enablement.
```

```text
Owner: Claude
Commit: 64e6345
Scope: Billing trial countdown and cancellation banners
Files:
- app/(admin)/settings/billing/page.tsx
Status: done
Notes: /settings/billing now shows prominent trial countdown and cancel-at-period-end banners from existing BillingSettingsView fields. UI-only; no loader/contract/backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: 0dc1fcb
Scope: Settings sub-page PageHeader consistency
Files:
- app/(admin)/settings/billing/page.tsx
- app/(admin)/settings/team/page.tsx
- app/(admin)/settings/usage/page.tsx
Status: done
Notes: Settings billing, team, and usage pages now share the PageHeader component for consistent title/description/action layout. UI refactor only; no copy, backend, contract, auth, API, migration, env, or deploy changes were reported.
```

```text
Owner: Claude
Commit: e8fa91f
Scope: Platform at-risk and health label localization
Files:
- app/internal/page.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- components/internal/platform-labels.ts
Status: done
Notes: Platform dashboard and org views now localize org status, risk level, risk reasons, and alert severity labels while using existing DTO fields. UI/label-only; no backend, contract, route, migration, env, billing, or deployment changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: External rollout blocker refresh
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Read-only Vercel check confirmed deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` remains Ready, production URL remains `https://smart-return-system-saas.vercel.app`, no custom domains are configured, `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are absent, ECPay env values are absent, email delivery remains dry-run, draft migrations `033`-`036` remain unapplied, and no deploy/env/domain/billing/provider/migration/master/live/prod change was performed.
```

```text
Owner: Claude
Commit: 85f65bd
Scope: Tenant preview start button UI
Files:
- app/internal/orgs/[id]/page.tsx
- components/internal/start-tenant-preview-button.tsx
Status: done
Notes: Platform org detail now exposes a client action button that POSTs /api/internal/saas/orgs/[id]/preview, then routes to the returned previewPath so the tenant preview banner can render. UI/route-consumption only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: da23eff
Scope: Tenant preview banner UI
Files:
- app/(admin)/template.tsx
- components/saas/tenant-preview-banner.tsx
- components/saas/tenant-preview-exit-button.tsx
Status: done
Notes: Tenant pages now render a read-only orange preview banner from loadPlatformTenantPreviewMode() and expose a client exit button wired to DELETE /api/internal/saas/tenant-preview. UI/composition only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: 1924065
Scope: Onboarding progress banner
Files:
- app/(admin)/template.tsx
- components/saas/onboarding-progress-banner.tsx
Status: done
Notes: Tenant pages now show a slim onboarding progress banner from loadSaaSOnboardingView() until onboarding is complete. UI/composition only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Claude
Commit: f46c344
Scope: Onboarding sidebar entry
Files:
- app/(admin)/layout.tsx
Status: done
Notes: Tenant sidebar now surfaces `/onboarding` as `設定指引` with a Compass icon. UI/navigation only; no backend/auth/API/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform tenant preview audit trail
Files:
- lib/saas/platform-tenant-preview.ts
- app/api/internal/saas/orgs/[id]/preview/route.ts
- app/api/internal/saas/tenant-preview/route.ts
- tests/unit/saas-platform-tenant-preview.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added audit_logs coverage for platform tenant preview start/clear events. Start requires the audit write before returning the signed cookie. Clear deletes the cookie even if the audit insert fails, with the failure logged server-side, so admins are not trapped in preview mode. No UI, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform tenant preview backend contract
Files:
- lib/saas/platform-tenant-preview.ts
- app/api/internal/saas/orgs/[id]/preview/route.ts
- app/api/internal/saas/tenant-preview/route.ts
- tests/unit/saas-platform-tenant-preview.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/WORK_SPLIT_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a signed, one-hour platform tenant preview cookie and guarded internal start/get/clear routes for future Claude UI. It requires platform admin view_organizations permission and organization lookup before issuing the cookie. The preview session is intentionally not wired into getOrgContext() or tenant write permissions. No UI, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin role management backend foundation
Files:
- lib/saas/platform-admin-role-management.ts
- app/api/internal/saas/platform-admins/route.ts
- tests/unit/saas-platform-admin-role-management.test.ts
- supabase/migrations/036_saas_platform_admin_roles.sql
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/WORK_SPLIT_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added an owner-gated platform admin role management contract for future internal admin UI. It lists/upserts/disables platform admin role assignments through a service-role repository and draft RPC, with audit-log metadata. Migration 036 was not applied, the live guard remains on the existing admin/profile/env role source, and no UI, deployment, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Onboarding live data loader contract
Files:
- lib/saas/onboarding-live-data.ts
- tests/unit/saas-onboarding-live-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/WORK_SPLIT_PLAN.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added loadSaaSOnboardingView() and an org-scoped onboarding signal repository for future Claude onboarding UI. It reads organization profile, return policy, team setup, first return, and AI review signals without serving mock data. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Claude
Commit: 8a5a6dc
Scope: Platform billing events copy polish
Files:
- app/internal/billing/events/page.tsx
Status: done
Notes: /internal/billing/events copy no longer uses Stage 2 or schema-source wording, while keeping operator-relevant guard requirements. UI/copy only; no backend/auth/contract/test/deploy changes were reported.
```

```text
Owner: Claude
Commit: f5d8171
Scope: Platform admin org pages copy polish
Files:
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
Status: done
Notes: /internal/orgs and org detail copy now use operator-facing wording and remove schema/table helper text. UI/copy only; no backend/auth/contract/test/deploy changes were reported.
```

```text
Owner: Claude
Commit: 9edf220
Scope: Platform Admin Mode floating indicator
Files:
- app/(admin)/template.tsx
- components/saas/platform-admin-mode-indicator.tsx
Status: done
Notes: Tenant admin pages now render a server-fetched Platform Admin Mode indicator from loadPlatformAdminModeView(). UI/composition only; no backend/auth/contract/test/deploy changes were reported.
```

```text
Owner: Claude
Commit: ee474ed
Scope: Platform admin dashboard visual polish
Files:
- app/internal/page.tsx
- app/internal/layout.tsx
- components/internal/nav-link.tsx
Status: done
Notes: /internal now renders the Codex loadPlatformAdminDashboardView() contract with KPI cards, at-risk alerts, trial follow-up, billing summary, recent billing events, and gated/empty/error states. UI/nav only; no backend/auth/RLS/billing/migration/env/deploy changes were reported.
```

```text
Owner: Codex
Commit: this commit
Scope: Onboarding completion API route contract
Files:
- lib/saas/onboarding-route.ts
- app/api/saas/onboarding/complete/route.ts
- tests/unit/saas-onboarding-route.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a guarded owner/admin writable-org onboarding completion API wrapper for Claude onboarding UI handoff. The route reuses completeSaaSOnboarding() and stable JSON error mapping. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed. Migration 035 still needs explicit approval/apply before production UI enables completion writes.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS doctor coverage for role separation contracts
Files:
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: saas:doctor now checks the role-aware login redirect contract, internal admin login redirect helper, platform admin mode contract, and platform dashboard live-data contract. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin dashboard backend contract
Files:
- lib/saas/ui-backend-contracts.ts
- lib/saas/platform-admin-live-data.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added loadPlatformAdminDashboardView() for Claude-owned /internal dashboard UI. The contract combines organization KPI, at-risk alerts, trial conversion follow-up, and billing event summaries from real platform repositories without exposing customer return details. No UI page, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin mode backend contract
Files:
- lib/saas/platform-admin-mode.ts
- tests/unit/saas-platform-admin-mode.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added loadPlatformAdminModeView() for Claude-owned admin mode indicator UI. The contract reports ready platform admin identity, role, permissions, internal links, and whether the internal console flag is enabled; unauthenticated or non-admin users get hidden state. No UI component, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Internal admin unauthenticated redirect contract
Files:
- lib/auth/internal-login-redirect.ts
- lib/auth/post-login-redirect.ts
- lib/actions/auth.ts
- app/login/page.tsx
- app/internal/orgs/page.tsx
- app/internal/orgs/[id]/page.tsx
- app/internal/billing/events/page.tsx
- lib/saas/platform-admin-live-data.ts
- tests/unit/internal-login-redirect.test.ts
- tests/unit/post-login-redirect.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Unauthenticated /internal page access redirects to /login?next=<internal path>. Authenticated non-admin users still receive gated/forbidden state for Claude UI treatment. Login accepts a safe requestedPath but rejects external, protocol-relative, login, backslash, and unauthorized /internal redirects. No visual redesign, deployment, migration, env/secret edit, billing/provider enablement, master/live/prod change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Role-based post-login redirect contract
Files:
- lib/auth/post-login-redirect.ts
- lib/actions/auth.ts
- app/login/page.tsx
- tests/unit/post-login-redirect.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: signIn() now returns redirectTo so platform admins land on /internal and merchant users land on /analytics. The login page only consumes this backend result; no visual UI redesign, deployment, migration, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Closed Manual Beta post-deploy smoke documentation
Files:
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- docs/MANUAL_BETA_LAUNCH_DECISION_CHECKLIST.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/TASK_BOARD.md
Status: done
Notes: Verified production URL `https://smart-return-system-saas.vercel.app` public routes return 200, protected unauthenticated routes redirect to `/login`, and Vercel deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` remains Ready. No deployment, migration, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was performed by this review.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS remaining-work and blocker documentation refresh
Files:
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Reconciled the post-b3f045e state: Manual Beta backend/readiness/predeploy consistency gate is complete, email_queue remains dry-run/CRON_SECRET-gated, AI analytics consistency fallback is complete, Claude's next UI scope is public marketing/legal RWD inspection, and public rollout is blocked only by external setup/approval items. No migration, deployment, env/secret edit, billing/provider enablement, master change, or production/internal Supabase action was made.
```

```text
Owner: Codex
Commit: this commit
Scope: Manual Beta smoke and consistency gate hardening
Files:
- scripts/predeploy/check-ai-analytics-consistency.mjs
- tests/unit/ai-analytics-consistency.test.mts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Verified local Manual Beta auth/data smoke for beta owner and invitee paths, exports, AI analyze, invite acceptance, settings, returns, and platform admin read pages. Hardened the AI analytics predeploy consistency check so SaaS DBs without optional legacy Shopee date columns still pass while non-schema query errors remain fatal. No migration, provider call, deployment, env secret output, master, or production/internal Supabase change was made.
```

```text
Owner: Codex
Commit: this commit
Scope: Email queue worker dry-run contract
Files:
- lib/saas/email-queue-worker.ts
- app/api/cron/saas/email-queue/route.ts
- tests/unit/saas-email-queue-worker.test.ts
- scripts/maintenance/cron-drill.mjs
- scripts/saas/readiness-check.mjs
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added CRON_SECRET-gated dry-run email_queue inspection for due queued records. The endpoint rejects dryRun=false and does not send email, mutate queue rows, call a provider, apply migrations, deploy, or change env/platform settings.
```

```text
Owner: Codex
Commit: this commit
Scope: Onboarding backend foundation
Files:
- lib/saas/onboarding.ts
- supabase/migrations/035_saas_onboarding_completion_rpc.sql
- tests/unit/saas-onboarding.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added onboarding progress DTO builder plus owner/admin writable-org completion service and RPC wrapper. Draft migration 035 updates organizations.onboarding_completed_at and writes audit_logs. No route, UI change, migration apply, deployment, env, email, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Notification backend foundation
Files:
- lib/saas/notifications.ts
- supabase/migrations/034_saas_notification_email_queue.sql
- tests/unit/saas-notifications.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added queue-only builders and repository wrapper for billing failure, AI quota reached, trial ending, and platform announcements. Draft migration 034 extends notifications and adds email_queue. No email provider, migration apply, DB write, deployment, env, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin role model
Files:
- lib/saas/platform-admin-roles.ts
- lib/saas/platform-admin.ts
- lib/saas/platform-admin-live-data.ts
- app/api/internal/saas/orgs/route.ts
- app/api/internal/saas/orgs/[id]/route.ts
- app/api/internal/saas/billing/events/route.ts
- app/api/internal/saas/billing/events/[id]/retry/route.ts
- app/api/internal/saas/billing/operations/route.ts
- tests/unit/saas-platform-admin.test.ts
- tests/unit/saas-platform-admin-routes.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- tests/unit/saas-platform-admin-billing-operations.test.ts
- tests/unit/saas-billing-reconciliation.test.ts
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added owner/support/billing platform admin role policy and route-level permission gates. Existing single-admin sessions default to owner; optional PLATFORM_ADMIN_ROLES can narrow specific admins by email or user id. No DB migration, env change, deployment, provider call, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Billing event retry and reconciliation design
Files:
- lib/saas/billing-reconciliation.ts
- app/api/internal/saas/billing/events/[id]/retry/route.ts
- tests/unit/saas-billing-reconciliation.test.ts
- docs/SAAS_BILLING_RETRY_RECONCILIATION_SOP.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
- scripts/saas/readiness-check.mjs
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added dry-run retry eligibility and reconciliation issue contracts before any UI retry button is enabled. Provider replay remains disabled; no provider API call, DB mutation, audit write, migration, email, deployment, env, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin billing operation backend plan
Files:
- lib/saas/platform-admin-billing-operations.ts
- app/api/internal/saas/billing/operations/route.ts
- supabase/migrations/033_saas_platform_billing_operations.sql
- tests/unit/saas-platform-admin-billing-operations.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-migration-plan.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added a platform-admin-gated billing operations contract for manual payment marking, suspend/resume, and refund request audit logging. The RPC migration is a draft only; no migration, provider payment, email, deployment, env, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin trial conversion backend contract
Files:
- lib/saas/platform-admin-data.ts
- lib/saas/platform-admin-live-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added read-only PlatformTrialConversionView and loadPlatformTrialConversionView for trialing, converted active, expired trial, and onboarding incomplete counts. No route, migration, DB write, email, deployment, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin at-risk alert backend contract
Files:
- lib/saas/platform-admin-data.ts
- lib/saas/platform-admin-live-data.ts
- lib/saas/ui-backend-contracts.ts
- tests/unit/saas-ui-backend-contracts.test.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- tests/unit/saas-platform-admin-routes.test.ts
- agent-shared/UI_BACKEND_CONTRACTS.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added read-only PlatformAtRiskAlertsView and loadPlatformAtRiskAlertsView for billing, quota, team-seat, and trial expiry signals. No route, migration, DB write, billing provider action, email, deployment, or platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Claude/Codex work split plan
Files:
- agent-shared/WORK_SPLIT_PLAN.md
- agent-shared/README.md
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/ACTIVE_WORK.md
Status: done
Notes: Added the owner-requested split: Claude owns UI/UX/page polish; Codex owns backend, data, security, billing, APIs, tests, docs, coordination, and Git. No runtime behavior changed.
```

```text
Owner: Codex
Commit: this commit
Scope: Record Claude UI completion handoff
Files:
- agent-shared/TASK_BOARD.md
- agent-shared/HANDOFF_LOG.md
Status: done
Notes: Recorded Claude's report that customer portal SaaS polish, returns dashboard visual polish, and mobile responsive QA follow-up are complete. The mobile QA used 390x844 Chrome emulation for /, /pricing, and /invite/[token]. No product code changed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS rollout readiness check
Files:
- package.json
- scripts/saas/check-rollout-readiness.mjs
- scripts/saas/readiness-check.mjs
- tests/unit/saas-rollout-readiness.test.ts
- agent-shared/TASK_BOARD.md
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added a read-only rollout gate and wired it into saas:predeploy in non-strict mode. The check validates SaaS project safety, Gemini key, NEXT_PUBLIC_APP_URL/domain readiness, AI safety flags, billing credential readiness, and Sentry/logging status. It does not change env, DB, Vercel, Supabase, billing, production, or master.
```

```text
Owner: Codex
Commit: this commit
Scope: Shared coordination and external setup status sync
Files:
- agent-shared/TASK_BOARD.md
- agent-shared/CODEX_NON_UI_SCOPE.md
- agent-shared/HANDOFF_LOG.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Recorded Claude invite acceptance UI completion, confirmed migration-plan strict and schema-gate strict pass through chain 032, and narrowed the remaining strict blocker to missing/placeholder GEMINI_API_KEY. No runtime behavior, env/secret, migration, deployment, production Supabase, or master branch operation was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Invite acceptance live data loader and accept route
Files:
- lib/saas/invite-acceptance-live-data.ts
- lib/saas/invite-accept-route.ts
- app/api/saas/invite/accept/route.ts
- tests/unit/saas-invite-acceptance-live-data.test.ts
- tests/unit/saas-invite-accept-route.test.ts
- lib/auth/route-auth.ts
- scripts/saas/readiness-check.mjs
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/TASK_BOARD.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added /invite/[token] page loader with viewer state plus POST /api/saas/invite/accept using the invite acceptance service and RPC wrapper. No UI page was changed, no email was sent, no migration was run, no env/secret was changed, and no deployment was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: Platform admin page-level live data loaders
Files:
- lib/saas/platform-admin-live-data.ts
- tests/unit/saas-platform-admin-live-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/TASK_BOARD.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added /internal/orgs, /internal/orgs/[id], and /internal/billing/events page loaders that call requirePlatformAdminAccess before service-role repository access and return ready/empty/gated/error DTO states. No UI page was changed, no migration was run, no env/secret was changed, and no deployment was performed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS team invite API foundation
Files:
- app/api/saas/team/invites/route.ts
- lib/saas/team-invite-route.ts
- tests/unit/saas-team-invite-route.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added owner/admin writable-org team invite API handler for Claude team UI handoff. It counts active seats plus pending invites and calls the invite creation RPC wrapper. No UI page was changed, no email was sent, no migration was run, and no platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS settings live data server loader
Files:
- lib/saas/settings-live-data.ts
- tests/unit/saas-settings-live-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
Status: done
Notes: Added server-side billing, usage, and team settings loaders that compose org context, server Supabase/RLS client, repository input builders, and UI DTO builders. No UI page was changed, no mock data is served, no migration was run, and no platform setting was changed.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite creation service and RPC draft
Files:
- lib/saas/invite-creation.ts
- tests/unit/saas-invite-creation.test.ts
- supabase/migrations/032_saas_invite_creation_rpc.sql
- tests/unit/saas-migration-plan.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added repository-backed invite creation use-case, URL-safe token generation, and draft atomic invite creation RPC. No migration was applied, no route was exposed, no UI file was changed, no invite email was sent, and no live invite was created.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite acceptance RPC draft and repository
Files:
- supabase/migrations/031_saas_invite_acceptance_rpc.sql
- lib/saas/invite-acceptance.ts
- tests/unit/saas-invite-acceptance.test.ts
- tests/unit/saas-migration-plan.test.ts
- scripts/saas/check-migration-plan.mjs
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added draft atomic invite acceptance RPC and local repository wrapper. No migration was applied, no route was exposed, no UI file was changed, no invite email was sent, and no live invite was accepted.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite acceptance service foundation
Files:
- lib/saas/invite-acceptance.ts
- tests/unit/saas-invite-acceptance.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added pure invite acceptance use-case over repository interfaces. No route was exposed, no UI file was changed, no Supabase client was created, no invite email was sent, and no migration was applied.
```

```text
Owner: Codex
Commit: this commit
Scope: SaaS invite token data repository foundation
Files:
- lib/saas/invite-token-data.ts
- tests/unit/saas-invite-token-data.test.ts
- scripts/saas/readiness-check.mjs
- agent-shared/TASK_BOARD.md
- agent-shared/ACTIVE_WORK.md
- agent-shared/HANDOFF_LOG.md
- agent-shared/UI_BACKEND_CONTRACTS.md
- docs/SAAS_EXTERNAL_SETUP_STATUS.md
Status: done
Notes: Added token lookup repository for future /invite/[token] live data from organization_invites plus organization context. No route was exposed, no UI file was changed, no invite email was sent, and no migration was applied.
```

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
