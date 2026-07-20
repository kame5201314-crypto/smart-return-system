# SaaS Self-Service Prepaid Billing Goal And Rollout

Last updated: 2026-07-20

## Current Verified Status

- Migrations `045`, `046`, `047`, and `048` are applied only to SaaS Supabase project
  `auyznbwtjvemyamujmgt`. They must not be rerun or applied to another project.
- Migration `047` explicitly grants authenticated users RLS-scoped read access
  to `payment_orders` and `subscription_periods`, keeps anonymous access and
  authenticated writes revoked, and grants `service_role` the table privileges
  required by trusted billing workflows.
- Migration `048_saas_checkout_order_hardening.sql` passed Supabase Migration
  Gate run `29696812039`, was applied to the SaaS project on 2026-07-20, and was
  verified by the strict Billing schema gate (25 tables and 126 columns plus the
  Billing RPCs). It adds atomic pending-order reuse and durable actor/tenant
  checkout limits.
- Preview ECPay Stage E2E passed for the Basic NT$399 plan, including the hosted
  checkout, 3D verification, signed callback, independent verified webhook
  settlement, and creation of the paid subscription period.
- Preview Vercel Authentication was disabled only for the provider-callback
  acceptance window and was restored after verification.
- Production deployment `dpl_E1MZVpRMiZhULVnQEuo165AyHVx4` is Ready with the
  latest prepaid Billing code and migration-compatible schema. Production has
  `BILLING_PROVIDER=ecpay` and `ECPAY_MODE=production`, but no formal ECPay
  merchant credentials. Keep
  `ENABLE_BILLING=false` and `ENABLE_SUBSCRIPTION_PLAN=false`; do not accept a
  real payment until the Production checklist below is completed.

## Goal

Allow an authenticated merchant owner or administrator to choose the single
public Basic plan at NT$399 from `/settings/billing`, complete a one-month
prepaid ECPay checkout, and receive the paid plan only after a verified
server-to-server payment notification. The same page must show the current
subscription period, expiry date, and past payment periods.

Growth and Enterprise remain in the internal data contract only for existing
tenants, historical payment records, administrative reporting, and safe
callback compatibility. New public signup and self-service checkout must never
offer or create either legacy plan.

This first release is deliberately **prepaid and non-recurring**. It must not
store card data or silently charge the customer again. Automatic recurring
billing requires a separate cancellation, recurring-notification, query, and
reconciliation rollout.

## Acceptance Criteria

### Merchant experience

- Every in-product upgrade action opens `/settings/billing#plans`; it does not
  send an authenticated merchant back to the marketing pricing page.
- The page shows one public paid plan only: Basic at the server-owned NT$399
  price with a one-month service period.
- Existing Growth or Enterprise tenants keep their stored plan and history,
  but cannot start a new public self-service plan change.
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
- Checkout creation is serialized per organization. An unexpired pending order
  for the same provider environment, merchant, plan, and amount is reused even
  when a new browser request has a different idempotency key; expired or
  terminal orders are never reused for a new checkout.
- Durable creation limits allow at most five new orders per actor in 15 minutes
  and ten new orders per organization in one hour. Idempotent retries and
  pending-order reuse do not consume another order slot. A rejected request
  returns HTTP `429` with a stable code and `Retry-After` value.
- A reused merchant trade number keeps the persisted order creation time as its
  ECPay `MerchantTradeDate`, so retries produce the same signed provider form.
- ECPay CheckMacValue, MerchantID, merchant trade number, stored amount, and
  server-owned plan are verified before processing. A real successful
  notification must also be confirmed server-to-server through the official
  signed `QueryTradeInfo/V5` response with `TradeStatus=1` before settlement.
- Callback and query amounts are compared with the immutable amount persisted
  on the payment order. A later catalogue price change must not invalidate an
  already-created pending order; new checkout creation still uses the current
  server-owned plan price.
- `SimulatePaid=1`, unknown orders, mismatched amounts, invalid signatures,
  and mismatched merchants never activate a subscription.
- A verified success updates the order, organization, subscription, immutable
  paid period, billing event, and audit log atomically.
- Repeated notifications return an idempotent success and never add another
  month.
- Basic same-plan renewal appends one month after the current period. New
  Growth or Enterprise checkout requests fail closed; previously persisted
  provider callbacks may still drain through the verified idempotent settlement
  path and must never downgrade a workspace.
- Stage and Production event/trade identifiers are isolated by mode and
  merchant. Verified callbacks for already-created orders continue to drain
  after new checkout creation is disabled.
- The ECPay server callback returns exact plain text `1|OK` only after the
  notification has been accepted and processed.
- Query timeout, non-2xx response, malformed or duplicate response fields,
  invalid query signature, `TradeStatus` other than `1`, or any merchant,
  order, trade-number, or amount mismatch fails closed without settlement or
  `1|OK` acknowledgement.

### Rollout safety

- Checkout fails closed unless both billing feature flags, the ECPay provider,
  and every required credential are configured.
- Browser form submission is restricted by both application validation and CSP
  to the official ECPay Stage and Production HTTPS checkout hosts.
- No secret, provider key, card data, or customer password is written to Git,
  logs, browser JavaScript, or documentation.
- Migrations `045_saas_suspended_org_write_guards.sql`,
  `046_saas_self_service_billing.sql`, and
  `047_saas_billing_table_privileges.sql` are already applied only to SaaS
  Supabase project `auyznbwtjvemyamujmgt`. Do not rerun them.
- Migration `048_saas_checkout_order_hardening.sql` is already applied and
  verified only on the SaaS project. Do not rerun it or apply it elsewhere.
- Successful Preview Stage acceptance does not authorize Production environment
  changes, provider activation, deployment, or a real charge.

## Required Production Verification

The Basic NT$399 Preview Stage happy path and database settlement are complete.
Before accepting a real customer payment:

1. Obtain formal Production MerchantID, HashKey, and HashIV directly from the
   approved ECPay merchant account and store them only in the Production secret
   manager. Never reuse Stage credentials.
2. Configure `BILLING_PROVIDER=ecpay`, `ECPAY_MODE=production`, and the formal
   credentials while both billing flags remain `false`.
3. Confirm the stable Production HTTPS webhook/result URLs are registered with
   ECPay and publicly reachable by the provider without weakening protection on
   merchant or administration pages.
4. Run repository safety, lint, typecheck, complete tests, production build,
   and a no-charge Production readiness smoke.
5. Confirm migration `048` remains recorded only on the SaaS project and that
   the strict Billing schema gate remains green. Do not rerun migrations
   `045`-`048`.
6. Complete the remaining provider matrix: Basic first purchase and same-plan
   renewal, expired renewal, rejection of new legacy-plan checkout, verified
   callback drain for previously persisted orders, platform suspension,
   duplicate notification, Stage/Production isolation, feature-flag drain,
   provider failure, amount mismatch, simulated payment,
   browser-return/callback races, signed `QueryTradeInfo/V5` timeout/non-2xx,
   invalid query signature, and query-field mismatches.
7. Verify the merchant billing page and platform billing events show the same
   confirmed payment and service period, then restore any temporary Preview or
   deployment protection change used for acceptance.
8. Complete legal invoice/receipt, refund, customer-support, and reconciliation
   decisions.
9. Only after all earlier steps pass, explicitly approve the Production deploy
   and set `ENABLE_BILLING=true` plus `ENABLE_SUBSCRIPTION_PLAN=true` together.

## External Values Required Later

- `BILLING_PROVIDER=ecpay`
- `ECPAY_MODE=production` for Production activation
- `ECPAY_MERCHANT_ID`
- `ECPAY_HASH_KEY`
- `ECPAY_HASH_IV`
- `ENABLE_BILLING=true`
- `ENABLE_SUBSCRIPTION_PLAN=true`
- A public HTTPS callback URL reachable by ECPay without Vercel protection

The values and secrets are never copied into this document. Production billing
must remain off until formal merchant credentials are available and the
Production verification above is explicitly approved and completed.
