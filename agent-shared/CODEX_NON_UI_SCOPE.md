# Codex Non-UI Scope

Codex owns non-UI SaaS commercial work.

## Ownership

Codex owns:

- `agent-shared/**` coordination files.
- Supabase migration design and migration readiness checks.
- `org_id`, RLS, and tenant isolation.
- `getOrgContext()` and runtime org isolation.
- API routes.
- Server actions.
- Signup persistence and org creation backend.
- Billing and ECPay webhook foundation.
- AI usage limits, cache, and quota guards.
- Feature flags.
- Platform admin backend wiring.
- Tests, doctor checks, CI gates.
- Architecture docs, safety docs, and setup status docs.

## External Operation Rule

These actions require explicit user approval:

```text
git push
Supabase migration apply
Vercel deploy
Vercel env changes
GitHub branch protection writes
domain / billing / secret changes
```

## Current External Blockers

- SaaS migrations `040`-`048` are applied only to project
  `auyznbwtjvemyamujmgt` and must not be rerun or applied to another project.
  Drafts `034` and `036` remain unapplied and each requires a separate
  feature-matched authorization.
- `npm run saas:migration-plan:strict` passes against project `auyznbwtjvemyamujmgt`.
- `npm run saas:schema-gate:strict` passes against project `auyznbwtjvemyamujmgt`.
- `npm run saas:rollout-check` reports the remaining rollout blockers without changing external state.
- Google login, 3-day self-service trial, single-use AI, scoped expiry, Sentry,
  and post-expiry read-only are already live. They are not current blockers.
- Verified Email/Phone migration `044` is applied, but OTP delivery/recovery
  remains blocked on provider/CAPTCHA readiness, per-channel smoke, and an
  explicitly approved Production flag rollout. Custom SMTP still requires a
  verified sender domain and credentials supplied out of band.
- Prepaid Billing repository code, migrations `045`-`048`, strict schema gate,
  ECPay Stage acceptance, and Production code deployment are complete. Formal
  Production ECPay credentials, owner-approved Billing flag activation, and a
  bounded real-charge/refund/reconciliation smoke remain external blockers.
- Company legal/tax/invoice/refund decisions, optional custom domain, and
  DB-backed platform roles remain separate future approvals.

## Routing Strategy

Do not create `app/(app)` yet.

Authenticated SaaS app pages stay under:

```text
app/(admin)/**
```

Reason:

- Existing routes, middleware, proxy, and auth guards already use this structure.
- Backend, DB, billing, and quota work should land before a route-group migration.
- A future route-group migration must be a separate Codex-owned task.

## Coordination

Codex is the single writer for `agent-shared/**`.

Before editing UI-owned files, check `ACTIVE_WORK.md` and the latest Claude commit.

If Claude owns a file, write the request in `HANDOFF_LOG.md` instead of editing directly.

If Claude reports a completed task in chat or a commit message, Codex should record the durable summary in `HANDOFF_LOG.md` and update `ACTIVE_WORK.md` after pulling the latest `develop-saas`.
