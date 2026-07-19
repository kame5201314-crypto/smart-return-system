-- Migration: 047_saas_billing_table_privileges.sql
-- Purpose: grant the minimum table privileges required by the RLS policies
-- created in migration 046. Policies alone do not grant SQL table access.

REVOKE ALL ON TABLE
  public.payment_orders,
  public.subscription_periods
FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.payment_orders,
  public.subscription_periods
FROM authenticated;

GRANT SELECT ON TABLE
  public.payment_orders,
  public.subscription_periods
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.payment_orders,
  public.subscription_periods
TO service_role;

COMMENT ON TABLE public.payment_orders
  IS 'Server-priced ECPay checkout orders. Authenticated organization owners/admins have RLS-scoped read access; writes remain service-role only.';
COMMENT ON TABLE public.subscription_periods
  IS 'Immutable paid subscription period history. Authenticated organization owners/admins have RLS-scoped read access; writes remain service-role only.';
