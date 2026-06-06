# Shared Task Board

Status values:

- `todo`
- `in_progress`
- `blocked`
- `done`

## Claude UI Tasks

| Status | Task | Notes |
|---|---|---|
| done | Platform admin dashboard visual polish | Claude commit `ee474ed`; `/internal` now renders the Codex dashboard DTO with KPI cards, at-risk alerts, trial follow-up, billing summary, and gated/empty/error states |
| done | Platform admin mode floating indicator | Claude commit `9edf220`; `(admin)` tenant pages now render the Codex `loadPlatformAdminModeView()` contract as a persistent platform-admin indicator |
| done | Platform admin org page copy polish | Claude commit `f5d8171`; `/internal/orgs` and `/internal/orgs/[id]` now use operator-facing wording without schema/table helper text |
| done | Platform billing events copy polish | Claude commit `8a5a6dc`; `/internal/billing/events` now removes stage wording and schema-source copy while keeping operator-relevant guard requirements |
| done | Tenant preview start button UI | Claude commit `85f65bd`; `/internal/orgs/[id]` now exposes the Codex preview-start route through a guarded org-detail action button |
| done | Tenant preview banner UI | Claude commit `da23eff`; `(admin)` tenant pages now show a read-only orange tenant-preview banner and exit button when Codex preview cookie is active |
| done | Onboarding progress banner | Claude commit `1924065`; `(admin)` tenant pages now show a slim setup-progress banner from `loadSaaSOnboardingView()` until onboarding is complete |
| done | Onboarding sidebar entry | Claude commit `f46c344`; tenant sidebar now links to `/onboarding` as `設定指引` so customers no longer need to know the setup guide URL |
| done | At-risk and health metric presentation | Claude commit `e8fa91f`; platform risk/status/reason labels are localized across `/internal`, `/internal/orgs`, and `/internal/orgs/[id]` using existing DTO fields |
| done | Billing / usage / team settings UI refinement | Claude commits `0dc1fcb` and `64e6345`; settings sub-pages now share `PageHeader`, and billing shows trial countdown plus cancel-at-period-end banners from existing billing DTO data |
| done | Trial / onboarding UI screens | Claude commit `60e702d`; `/onboarding` now highlights the next setup step using `loadSaaSOnboardingView()` without backend/API/migration changes; migration `035` is now applied, so the backend completion RPC exists for the existing guarded route |
| done | Public marketing mobile navigation | Claude commit `615ce7c`; marketing shell now has a mobile drawer for public and legal links below `md`, using existing shared navigation data |
| done | Public marketing and legal RWD inspection | This commit; Chrome DevTools mobile QA at 390x844 passed for `/features/returns`, `/features/ai`, `/features/security`, `/contact`, `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/signup`; all routes returned 200 locally, no horizontal overflow, and public CTAs/nav links now meet 44px touch targets |
| done | Responsive QA pass | This commit; recorded route-by-route mobile public/legal QA and kept changes UI-only in public marketing components/pages |
| done | Customer settings page declutter and copy polish | Commits `1316b02`, `fb561fa`, and `14dad06`; UI-only cleanup kept backend/auth contracts unchanged |
| done | Customer vs platform role separation UI polish | Commits `5962954`, `bb8329a`, `5f2f889`, and this QA pass; `/login?next=/internal` distinguishes platform admin login, internal gated/forbidden states explain account switching, and the merchant sidebar remains focused on merchant workflows without platform-management entries |
| done | Login page SaaS branding | Claude commit `ca773c8`; `/login` now uses Smart Return SaaS branding and links back to the public site/signup while preserving the Codex role-aware redirect contract |
| done | Internal loading skeleton | Claude commit `31e2362`; `/internal` now has a loading skeleton while platform admin dashboard data resolves |
| done | Not-found SaaS branding | Claude commit `a63cfe2`; `/not-found` copy and palette now align with SaaS branding |
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
| done | Platform tenant preview audit trail | This commit; start/clear preview routes now write platform tenant preview audit events to `audit_logs`, with clear using best-effort audit so admins can always exit preview mode |
| done | Platform tenant preview backend contract | This commit; added signed, one-hour platform tenant preview cookie contract and guarded start/get/clear API routes for future Claude UI; not wired into `getOrgContext()` or tenant write permissions |
| done | Platform admin role management backend foundation | This commit; added owner-gated `GET/POST /api/internal/saas/platform-admins`, repository/RPC contract, tests, and draft `036`; migration not applied and guard still uses current env/profile role source until owner approves DB role rollout |
| done | Onboarding live data loader contract | This commit; added `loadSaaSOnboardingView()` and org-scoped onboarding signal repository for Claude onboarding UI handoff; no UI or DB writes |
| done | Onboarding guide legacy policy hotfix | Commit `a3af638`; optional return-policy signal now treats legacy `system_settings` -> `users` RLS recursion as incomplete instead of failing the whole `/onboarding` page; deployed as `dpl_58GGGEpqZTtj6MPGyQvQ5jYhX6zr` |
| done | Onboarding completion API route contract | This commit; added owner/admin writable-org `POST /api/saas/onboarding/complete` wrapper for Claude onboarding UI handoff; owner-authorized migration `035` is now applied to the SaaS DB |
| done | SaaS doctor coverage for role separation contracts | This commit; readiness check now verifies auth redirects, internal admin redirects, platform admin mode, and platform dashboard contracts |
| done | Platform admin canonical entry routes | This commit; added `/admin` -> `/internal`, `/admin/login` -> `/login?next=/internal...`, public allowlist coverage for `/admin/login`, and proxy-level unauthenticated `/admin` / `/internal/*` redirects to the platform admin login entry |
| done | Explicit platform admin identity separation | This commit; platform admin access and post-login redirects now require an internal admin session, explicit `ADMIN_EMAIL` / email-style `ADMIN_USERNAME`, or valid `PLATFORM_ADMIN_ROLES`; tenant/profile `users.role='admin'` no longer grants the platform console |
| done | Proxy login redirect platform admin separation | This commit; authenticated platform admins who revisit `/login` or `/login?next=/internal...` now stay on `/internal` paths instead of being routed to merchant `/analytics` |
| done | Authenticated merchant `/admin` entry separation | This commit; authenticated merchant users who hit the canonical `/admin` operator entry are sent back to `/analytics`, while `/internal/*` keeps the gated forbidden path for explicit account-switch UX |
| done | Launch security header and dependency audit hardening | This commit; added Next security headers, unit coverage, SaaS doctor coverage, and non-breaking dependency audit updates. High-severity audit findings are cleared; 4 moderate nested `postcss`/`uuid` advisories remain because npm only offers breaking `--force` changes |
| done | Platform admin login rate limit hardening | This commit; platform admin password login now has best-effort per-runtime throttling by login id and client IP, with unit tests and SaaS doctor coverage. No deploy, migration, env/secret edit, or provider setting change was performed |
| done | Mutation route same-origin hardening | This commit; browser-driven POST/DELETE mutation APIs now reject explicit cross-site requests through a shared same-origin guard, with unit tests and SaaS doctor coverage. ECPay webhook, cron, and schema alert routes remain provider/secret-gated server-to-server paths |
| done | Public signup rate limit hardening | Commit `b3bf314`; `POST /api/saas/signup` now has best-effort per-runtime request throttling by scope, client IP, and user agent, with unit tests and SaaS doctor coverage. Public signup remains disabled by default |
| done | Non-UI lint warning cleanup | This commit; removed unused local variables from Codex-owned `lib/**` and `scripts/**` paths without changing API behavior. Known lint warnings are reduced from 44 to 31; remaining warnings are UI/component scoped |
| done | Tenant isolation read-only audit refresh | This commit; `saas:schema-gate:strict` passed read-only and P0 return/AI/export org isolation is covered by regression tests; public multi-tenant still needs P1/P2 hardening or gating for Shopee returns actions, pickup actions, customer portal actions, upload/signed-url, backup, and cron/maintenance service-role paths |
| done | Tenant isolation P1 Shopee actions | This commit; `lib/actions/shopee-returns.actions.ts` now requires SaaS org context for reads, writable org context for import/status/scan/create/update/delete/bind writes, scopes reads/writes by `org_id`, and regression coverage asserts the guard/filter pattern |
| done | Tenant isolation P1 pickup/customer/upload actions | This commit; `pickup.actions.ts` now requires read/writable org context and scopes pickup reads/writes/deletes/scans by `org_id`; customer-return public portal writes derive tenant scope from the matched existing order and write/filter child rows by `org_id`; upload helpers require org context and signed-url sessions support org-scoped staging paths |
| done | Platform admin dashboard backend contract | This commit; added `loadPlatformAdminDashboardView()` with organization KPI, at-risk, trial conversion, and billing event summaries for Claude's `/internal` dashboard UI |
| done | Platform admin mode backend contract | This commit; added `loadPlatformAdminModeView()` so Claude can render an admin mode indicator without client-side role checks |
| done | Internal admin unauthenticated redirect contract | This commit; `/internal/*` page loaders now redirect unauthenticated visitors to the platform admin login entry while preserving forbidden gated states for authenticated non-admin users |
| done | Role-based post-login redirect contract | This commit; `signIn()` returns `redirectTo` so platform admins land on `/internal` while merchant users land on `/analytics`; UI only consumes the backend result |
| done | Latest HEAD production deployment | Deployed `360c56f` to Vercel deployment `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`; public smoke returned 200, tenant protected routes redirected to `/login`, and platform protected routes redirected to `/admin/login?next=...`; Sentry DSN is configured in Vercel Production env |
| done | Sentry DSN activation | Sentry org `smart-return-saas` created, Vercel Production env now has `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`, and production was redeployed to `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`; DSN values were not committed |
| done | Onboarding completion migration apply | Owner authorized only `035_saas_onboarding_completion_rpc.sql`; applied it to SaaS project `auyznbwtjvemyamujmgt`, repaired remote migration history for version `035`, confirmed the RPC exists and service role can execute it, and left `033`/`034`/`036` unapplied |
| done | External owner action runbook | This commit; added `docs/SAAS_EXTERNAL_OWNER_ACTIONS.md` with Sentry/domain/email/Billing/ECPay handoff templates, production smoke snapshot, and migration `033`-`036` sequencing guidance. No deployment, migration, env/secret edit, or provider enablement |
| done | Closed Manual Beta production smoke | Deployment `dpl_8Huiefp9Y3A3W3Wxpsvsx4WFDajS` for `smart-return-system-saas` is Ready; public pages returned 200 and protected unauthenticated pages redirected to `/login` |
| done | Platform admin billing operation backend plan | This commit; added guarded `POST /api/internal/saas/billing/operations`, RPC wrapper, and draft `033` for manual payment marking, suspend/resume, refund request, and audit logging |
| done | At-risk alert backend contract | This commit; added read-only `PlatformAtRiskAlertsView` and `loadPlatformAtRiskAlertsView()` for past_due, suspended, AI/return/seat quota, and trial expiry signals |
| done | Trial conversion backend contract | This commit; added read-only `PlatformTrialConversionView` and `loadPlatformTrialConversionView()` for trialing, converted active, expired trial, and onboarding incomplete counts |
| done | Billing event retry and reconciliation design | This commit; added dry-run retry eligibility contract, reconciliation view builder, SOP, and tests. Provider replay remains disabled |
| done | Platform admin role model | This commit; added owner/support/billing permission matrix, optional `PLATFORM_ADMIN_ROLES` mapping, and route-level permission gates |
| done | Notification backend foundation | This commit; added queue-only notification/email contracts, repository wrapper, tests, and draft `034`; no email provider is wired |
| done | Email queue worker dry-run contract | This commit; added CRON_SECRET-gated dry-run inspection for `email_queue`, no provider call or DB mutation |
| done | Onboarding backend foundation | This commit; added onboarding progress DTO, guarded completion service/RPC wrapper, tests, and draft `035`; completion route contract is now available for Claude UI handoff |
| done | Manual Beta smoke and consistency gate hardening | This commit; verified local beta owner/invitee login paths, AI analyze, exports, invite acceptance, and hardened the AI analytics predeploy check for optional Shopee date columns |
| done | SaaS migrations apply | SaaS project `auyznbwtjvemyamujmgt`; full local/remote migration chain aligned through `032`; schema-gate strict passed |
| done | Signup persistence backend | This commit; API is wired to `signup_requests` behind `ENABLE_PUBLIC_SIGNUP=false`, and `026` is a draft migration only |
| done | Platform admin live data wiring | Internal platform admin APIs return UI contract DTOs from service-role repositories; UI page consumption remains Claude-owned |
| done | Platform admin page-level live data loaders | This commit; added `/internal/orgs`, `/internal/orgs/[id]`, and `/internal/billing/events` loaders with platform-admin gates and four-state DTO results for Claude UI handoff |
| done | Platform admin read model migration draft | This commit; added `027` for `owner_email` / `member_count` alignment with platform admin APIs |
| done | Manual Beta org provisioning backend foundation | This commit; added gated `POST /api/internal/saas/orgs` and `028` RPC draft, no DB apply |
| done | SaaS migration apply plan check | Read-only `saas:migration-plan` checks SaaS project ref, DB password, and the current local migration chain; local draft chain now extends through `033` |
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
| blocked | SaaS public rollout external setup | 2026-06-06 Sentry setup and owner-authorized migration `035` are complete; owner selected `app.smart-return.tw` but domain/DNS changes still need explicit authorization; owner skipped email provider for now; production is Ready at `360c56f` / `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`; next queue is remaining public multi-tenant isolation P1/P2, custom domain authorization, Stage 2 Billing/ECPay, then separately authorized `033`/`034`/`036` |
| done | Beta customer onboarding: 遇見未來 | Owner handoff reports org/account/login provisioned for `kawei88888@gmail.com`; keep billing disabled and email dry-run unless owner explicitly authorizes changes |
| done | Manual Beta local readiness | SaaS project, migrations, schema gate, Gemini key, test org, seed data, login smoke, AI analyze, invite flow, exports, and platform admin read views have been verified locally |
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

## Current Split Queue

Claude owns the next executable UI-only work:

- No open Claude UI task is recorded after the public marketing/legal RWD QA and customer/platform role-separation polish.
- Any future UI follow-up from owner feedback should stay UI-only unless Claude explicitly needs a new backend contract.

Codex owns the non-UI queue:

- Public multi-tenant expansion is now explicitly planned by the owner. Shopee plus pickup/customer/upload P1 isolation is complete; continue remaining tenant-isolation P2 gaps documented in `docs/SAAS_TENANT_ISOLATION_AUDIT.md` before public signup or broad onboarding.
- Codex should record future Claude handoffs here, update readiness/docs/tests, and implement backend contracts only when Claude needs a new contract or the owner explicitly authorizes an external/backend change.
- External/owner-blocked items should be handled in this order: finish tenant-isolation P1/P2 hardening, configure selected domain `app.smart-return.tw` only after explicit Vercel/DNS authorization, keep email provider skipped until credentials are provided, Stage 2 Billing/ECPay plus `ENABLE_BILLING`, then separately authorized draft migrations `033`/`034`/`036`. Sentry DSN activation and migration `035` are complete, and production is currently Ready on `dpl_FjkpCWZwYPSv7RY2sBJEhpFPPMab`.
- Tenant preview is currently a signed, audited, read-only visual context for platform admins. It is not full impersonation and is not wired into `getOrgContext()` or tenant write permissions.

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
