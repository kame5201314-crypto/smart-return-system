# SaaS Billing Retry And Reconciliation SOP

Last updated: 2026-05-25

This SOP applies only to the SaaS `develop-saas` branch and the dedicated SaaS Supabase project. Do not use it for the protected live/internal project.

## Current Safety Boundary

- Provider replay is disabled by default.
- The platform retry route only supports dry-run eligibility checks:
  - `POST /api/internal/saas/billing/events/[id]/retry`
  - Body: `{ "dryRun": true }`
- `{ "dryRun": false }` returns `retry_not_enabled`.
- No route in this foundation calls ECPay, Stripe, TapPay, email, deployment, env, or Vercel/Supabase settings.

## Retry Eligibility Rules

Use `buildBillingEventRetryDecision()` before any UI retry button is enabled.

Retry is blocked when:

- the local event is already `processed`;
- the local event is `ignored`;
- `provider_event_id` is missing;
- the provider has no approved replay adapter;
- the event type is outside the approved payment/invoice/subscription allowlist;
- provider replay is not explicitly enabled.

The only future replay operation currently modeled is:

```text
provider_webhook_replay
```

ECPay is the only provider listed in the default future retry allowlist. The default runtime still keeps replay disabled.

## Manual Reconciliation Steps

1. Export or inspect the provider settlement ledger for the target day.
2. Pull the corresponding `billing_events` rows from the SaaS project only.
3. Compare provider/event ids through `buildBillingEventReconciliationView()`.
4. For `missing_local_event`, manually record or backfill only after verifying the provider signature/ledger entry.
5. For `local_failed`, inspect payload and subscription/invoice side effects before marking anything processed.
6. For stale `received` events, verify whether a processor was intentionally not wired yet or whether a handler failed after insert.
7. For duplicate local events, confirm the unique `(provider, provider_event_id)` constraint and do not replay blindly.
8. Record the final decision in `audit_logs` through a Codex-owned backend path before enabling UI actions.

## Go/No-Go For UI Retry

Do not enable a visible retry button until all are true:

- provider sandbox replay has passed for ECPay;
- the route can execute a provider adapter behind a feature flag;
- idempotency has been verified with duplicate provider ids;
- retry attempts write `audit_logs`;
- failed retry attempts cannot change subscription status;
- tests cover processed/ignored/missing-id/unsupported-provider blocks.

## Current Implementation

- `lib/saas/billing-reconciliation.ts`
  - `buildBillingEventRetryDecision()`
  - `buildBillingEventReconciliationView()`
- `app/api/internal/saas/billing/events/[id]/retry/route.ts`
  - platform-admin gated dry-run route only
- `tests/unit/saas-billing-reconciliation.test.ts`
  - retry eligibility, dry-run route gate, and reconciliation issue coverage
