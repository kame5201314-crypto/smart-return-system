import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/046_saas_self_service_billing.sql'),
  'utf8'
);
const privilegesSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/047_saas_billing_table_privileges.sql'),
  'utf8'
);

function functionBlock(name: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n$$;', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 4);
}

describe('SaaS self-service billing migration', () => {
  it('adds immutable checkout and subscription-period ledgers with provider idempotency', () => {
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.payment_orders');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.subscription_periods');
    expect(source).toContain(
      'UNIQUE (provider, provider_mode, merchant_id, merchant_trade_no)'
    );
    expect(source).toContain(
      'ON public.payment_orders(provider, provider_mode, merchant_id, trade_no)'
    );
    expect(source).toContain('UNIQUE (org_id, idempotency_key)');
    expect(source).toContain('UNIQUE (payment_order_id)');
    expect(source).toContain("CHECK (plan IN ('basic', 'growth'))");
    expect(source).toContain(
      "provider_mode TEXT NOT NULL CHECK (provider_mode IN ('test', 'production'))"
    );
    expect(source).toContain('CHECK (period_end > period_start)');
  });

  it('allows owner/admin reads while keeping direct writes service-role only', () => {
    expect(source).toContain('ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;');
    expect(source).toContain('ALTER TABLE public.subscription_periods ENABLE ROW LEVEL SECURITY;');
    expect(source).toContain(
      "USING (public.is_organization_member(org_id, ARRAY['owner', 'admin']))"
    );
    expect(source).toContain('CREATE POLICY "service_role_full_payment_orders"');
    expect(source).toContain('CREATE POLICY "service_role_full_subscription_periods"');
    expect(source).not.toMatch(
      /CREATE POLICY[\s\S][^;]*FOR (INSERT|UPDATE|DELETE)[\s\S][^;]*TO authenticated/i
    );
    expect(privilegesSource).toContain(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE'
    );
    expect(privilegesSource).toContain('GRANT SELECT ON TABLE');
    expect(privilegesSource).toContain('TO authenticated;');
    expect(privilegesSource).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE');
    expect(privilegesSource).toContain('TO service_role;');
    expect(privilegesSource).toContain('FROM anon;');
  });

  it('uses the API contract and creates orders only for an active owner/admin actor', () => {
    const block = functionBlock('create_self_service_payment_order');

    expect(block).toContain('SECURITY DEFINER');
    expect(block).toContain("COALESCE(auth.role(), '') <> 'service_role'");
    expect(block).toContain('member.user_id = p_actor_user_id');
    expect(block).toContain("member.role IN ('owner', 'admin')");
    expect(block).toContain("COALESCE(member.status, 'active') = 'active'");
    expect(block).toContain("WHEN 'basic' THEN 399");
    expect(block).toContain("WHEN 'growth' THEN 699");
    expect(block).toContain('p_amount_twd <> expected_amount_twd');
    expect(block).toContain("normalized_provider <> 'ecpay'");
    expect(block).toContain('p_provider_mode TEXT');
    expect(block).toContain("normalized_provider_mode NOT IN ('test', 'production')");
    expect(block).toContain('idempotency_key = normalized_idempotency_key');
    expect(block).toContain('PERFORM pg_advisory_xact_lock(');
    expect(block.indexOf('PERFORM pg_advisory_xact_lock(')).toBeLessThan(
      block.indexOf('FROM public.payment_orders')
    );
    expect(block).toContain('existing_order.provider_mode <> normalized_provider_mode');
    expect(block).toContain('existing_order.merchant_id <> normalized_merchant_id');
    expect(block).toContain('requested_plan_rank < current_plan_rank');
    expect(block).toContain('self-service checkout cannot downgrade the current plan');
    expect(block).toContain("'id', existing_order.id");
    expect(block).toContain("'merchant_trade_no', existing_order.merchant_trade_no");
    expect(source).toContain(
      'UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, JSONB'
    );
  });

  it('keeps order creation and payment settlement service-role only', () => {
    const block = functionBlock('process_ecpay_payment_notification');

    expect(block).toContain("COALESCE(auth.role(), '') <> 'service_role'");
    expect(block).toContain('p_provider_mode TEXT');
    expect(block).toContain("normalized_provider_mode NOT IN ('test', 'production')");
    expect(block).toContain('provider_mode = normalized_provider_mode');
    expect(source).toContain(
      'TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TIMESTAMPTZ, JSONB'
    );
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.process_ecpay_payment_notification('
    );
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.process_ecpay_payment_notification('
    );
    const grantStart = source.lastIndexOf(
      'GRANT EXECUTE ON FUNCTION public.process_ecpay_payment_notification('
    );
    const grantBlock = source.slice(grantStart, source.indexOf(';', grantStart) + 1);
    expect(grantBlock).toContain('TO service_role');
    expect(grantBlock).not.toContain('TO authenticated');
    expect(grantBlock).not.toContain('TO anon');
    expect(source).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.create_self_service_payment_order\([\s\S][^;]*TO authenticated/i
    );
  });

  it('does not append another subscription period when the provider retries success', () => {
    const block = functionBlock('process_ecpay_payment_notification');
    const paidRetryGuard = block.indexOf("payment_order_record.status IN ('paid', 'manual_review')");
    const periodCalculation = block.indexOf('period_start := CASE');
    const periodInsert = block.indexOf('INSERT INTO public.subscription_periods');

    expect(paidRetryGuard).toBeGreaterThan(-1);
    expect(periodCalculation).toBeGreaterThan(paidRetryGuard);
    expect(periodInsert).toBeGreaterThan(periodCalculation);
    expect(block.slice(paidRetryGuard, periodCalculation)).toContain("'status', 'duplicate'");
    expect(block).toContain('ON CONFLICT (provider, provider_event_id) DO NOTHING');
    expect(block).toContain('FOR UPDATE');
  });

  it('fails closed for RtnCode failure, stored-amount mismatch, and SimulatePaid', () => {
    const block = functionBlock('process_ecpay_payment_notification');
    const rejectionGuard = block.indexOf('failure_code := CASE');
    const activationUpdate = block.indexOf('UPDATE public.subscriptions');

    expect(rejectionGuard).toBeGreaterThan(-1);
    expect(block).toContain('p_rtn_code IS DISTINCT FROM 1');
    expect(block).toContain('p_trade_amount_twd <> payment_order_record.amount_twd');
    expect(block).toContain("WHEN COALESCE(p_simulate_paid, false) THEN 'simulate_paid'");
    expect(block).toContain("WHEN failure_code = 'simulate_paid' THEN 'ignored'");
    expect(block.slice(rejectionGuard, activationUpdate)).toContain(
      "'status', failure_status"
    );
    expect(activationUpdate).toBeGreaterThan(rejectionGuard);
  });

  it('atomically activates the organization and subscription and records the paid period', () => {
    const block = functionBlock('process_ecpay_payment_notification');

    expect(block).toContain('INSERT INTO public.subscription_periods');
    expect(block).toContain('payment_order_record.provider_mode');
    expect(block).toContain('UPDATE public.payment_orders');
    expect(block).toContain('UPDATE public.subscriptions');
    expect(block).toContain('UPDATE public.organizations');
    expect(block).toContain("status = 'active'");
    expect(block).toContain('current_period_start = period_start');
    expect(block).toContain('current_period_end = period_end');
    expect(block).not.toContain('provider_subscription_id = normalized_merchant_trade_no');
    expect(block).toContain("'self_service.billing.payment_applied'");
    expect(block).toContain("'status', 'processed'");
  });

  it('keeps platform suspensions and stale lower-plan orders in manual review', () => {
    const block = functionBlock('process_ecpay_payment_notification');

    expect(source).toContain('ADD COLUMN IF NOT EXISTS suspension_source TEXT');
    expect(source).toContain("'platform.billing.org_suspended' THEN 'platform_admin'");
    expect(block).toContain("'platform_suspension_requires_review'");
    expect(block).toContain("'stale_order_downgrade_requires_review'");
    expect(block).toContain("status = 'manual_review'");
    expect(block).toContain("'self_service.billing.payment_manual_review'");
    expect(block).toContain('suspension_source = NULL');
  });

  it('uses one billing lock order and clears stale suspension ownership on recovery', () => {
    const block = functionBlock('perform_platform_billing_operation');
    const suspensionSyncBlock = functionBlock(
      'sync_organization_suspension_source_from_audit'
    );
    const subscriptionLock = block.indexOf('FROM public.subscriptions');
    const organizationLock = block.indexOf('FROM public.organizations');

    expect(subscriptionLock).toBeGreaterThan(-1);
    expect(organizationLock).toBeGreaterThan(subscriptionLock);
    expect(block.slice(subscriptionLock, organizationLock)).toContain('FOR UPDATE');
    expect(block.slice(organizationLock)).toContain('FOR UPDATE');
    expect(block).toContain("p_operation = 'mark_manual_payment'");
    expect(block).toContain("p_operation = 'resume_org'");
    expect(block).toContain('suspension_source = NULL');
    expect(block).toContain("suspension_source = 'platform_admin'");
    expect(suspensionSyncBlock).toContain("'platform.billing.manual_payment_marked'");
    expect(suspensionSyncBlock).toContain("'platform.billing.org_resumed'");
    expect(suspensionSyncBlock).toContain('SET suspension_source = NULL');
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.perform_platform_billing_operation('
    );
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.perform_platform_billing_operation('
    );
  });

  it('starts upgrades immediately but appends same-plan renewals after the current period', () => {
    const block = functionBlock('process_ecpay_payment_notification');

    expect(block).toContain('WHEN requested_plan_rank = current_plan_rank');
    expect(block).toContain('THEN subscription_record.current_period_end');
    expect(block).toContain('ELSE effective_at');
  });
});
