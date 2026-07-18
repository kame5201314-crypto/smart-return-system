# SaaS Self-Service Prepaid Billing Goal And Rollout

Last updated: 2026-07-19

## Goal

Allow an authenticated merchant owner or administrator to choose Basic or
Growth from `/settings/billing`, complete a one-month prepaid ECPay checkout,
and receive the paid plan only after a verified server-to-server payment
notification. The same page must show the current subscription period, expiry
date, and past payment periods.

This first release is deliberately **prepaid and non-recurring**. It must not
store card data or silently charge the customer again. Automatic recurring
billing requires a separate cancellation, recurring-notification, query, and
reconciliation rollout.

## Acceptance Criteria

### Merchant experience

- Every in-product upgrade action opens `/settings/billing#plans`; it does not
  send an authenticated merchant back to the marketing pricing page.
- Basic and Growth show the server-owned price and one-month service period.
- Enterprise remains a contact-assisted plan.
- Trial-expired, past-due, cancelled, or billing-suspended owners and
  administrators can start checkout while the workspace remains read-only for
  business data. A platform-admin suspension cannot be cleared by payment.
- Staff and viewers cannot start checkout.
- The billing page shows current plan, status, period start, period end or
  trial end, and a bounded newest-first payment/period history.
- Pending, completed, failed, and cancelled browser-return states use clear
  Traditional Chinese copy. A browser return never grants access by itself.

### Payment and data integrity

- The client sends only the requested plan. Organization, price, period, and
  ECPay fields are derived on the server.
- Every checkout has a unique, server-persisted merchant trade number and an
  idempotency key.
- ECPay CheckMacValue, MerchantID, merchant trade number, stored amount, and
  server-owned plan are verified before processing.
- `SimulatePaid=1`, unknown orders, mismatched amounts, invalid signatures,
  and mismatched merchants never activate a subscription.
- A verified success updates the order, organization, subscription, immutable
  paid period, billing event, and audit log atomically.
- Repeated notifications return an idempotent success and never add another
  month.
- Same-plan renewal appends one month after the current period. A higher-plan
  upgrade starts immediately; a stale lower-plan order is retained for manual
  review and never downgrades the workspace.
- Stage and Production event/trade identifiers are isolated by mode and
  merchant. Verified callbacks for already-created orders continue to drain
  after new checkout creation is disabled.
- The ECPay server callback returns exact plain text `1|OK` only after the
  notification has been accepted and processed.

### Rollout safety

- Checkout fails closed unless both billing feature flags, the ECPay provider,
  and every required credential are configured.
- Browser form submission is restricted by both application validation and CSP
  to the official ECPay Stage and Production HTTPS checkout hosts.
- No secret, provider key, card data, or customer password is written to Git,
  logs, browser JavaScript, or documentation.
- Migration `046_saas_self_service_billing.sql` is a repository draft until an
  explicit, separate authorization applies it only to SaaS Supabase project
  `auyznbwtjvemyamujmgt`.
- Repository completion does not authorize a Vercel deployment, environment
  change, provider activation, migration, or real charge.

## Required Verification

Before an external rollout:

1. Run repository safety, lint, typecheck, complete tests, and production
   build.
2. Review migration `046`, apply it to a disposable Supabase project, and prove
   RLS plus RPC behavior before requesting production migration approval.
3. Configure ECPay Stage credentials outside Git and keep `ECPAY_MODE=test`.
4. Enable the billing flags only in a Stage deployment.
5. Test Basic purchase, Growth purchase, active renewal, immediate upgrade,
   expired renewal, stale-order downgrade, platform suspension, duplicate
   notification, Stage/Production isolation, feature-flag drain, failure,
   amount mismatch, simulated payment, browser-return-before-callback, and
   callback-before-browser-return.
6. Verify the billing page and platform billing events show the same confirmed
   result and service period.
7. Complete legal invoice/receipt and refund decisions before collecting a real
   customer payment.

## External Values Required Later

- `BILLING_PROVIDER=ecpay`
- `ECPAY_MODE=test` for the first end-to-end verification
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ENABLE_BILLING=true`
- `ENABLE_SUBSCRIPTION_PLAN=true`
- A public HTTPS callback URL reachable by ECPay without Vercel protection

The values and secrets are never copied into this document. Production mode
must remain off until the Stage matrix passes and a separate production rollout
is explicitly approved.
