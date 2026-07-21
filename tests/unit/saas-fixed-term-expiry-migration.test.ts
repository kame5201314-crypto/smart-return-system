import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/051_saas_fixed_term_expiry_enforcement.sql'),
  'utf8'
);

function functionBlock(name: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n$$;', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 4);
}

describe('SaaS fixed-term prepaid expiry migration', () => {
  it('adds a bounded lookup index and preserves only evidence-free legacy manual NULL periods', () => {
    expect(source).toContain('CREATE INDEX IF NOT EXISTS idx_subscriptions_active_prepaid_expiry');
    expect(source).toContain("WHERE status = 'active'");
    expect(source).toContain("AND provider IN ('ecpay', 'manual')");
    expect(source).toContain('AND current_period_end IS NOT NULL');

    const block = functionBlock('is_writable_organization_member(');
    expect(block).toContain("subscription.provider = 'ecpay'");
    expect(block).toContain('subscription.current_period_end IS NOT NULL');
    expect(block).toContain('subscription.current_period_end > NOW()');
    expect(block).toContain("subscription.provider = 'manual'");
    expect(block).toContain('subscription.current_period_end IS NULL');
    expect(block).toContain('FROM public.saas_self_service_trial_claims AS self_service_claim');
    expect(block).toContain('FROM public.payment_orders AS paid_order');
    expect(block).toContain("paid_order.status = 'paid'");
    expect(block).toContain('FROM public.billing_events AS manual_payment_event');
    expect(block).toContain("manual_payment_event.event_type = 'manual.payment_marked'");
    expect(block).toContain("manual_payment_event.status = 'processed'");
    expect(block).toContain("subscription.provider NOT IN ('ecpay', 'manual')");
    expect(block).toContain("subscription.status = 'trialing'");
    expect(block).toContain('subscription.trial_end > NOW()');
  });

  it('suspends only expired prepaid subscriptions in subscription-to-organization lock order', () => {
    const block = functionBlock('suspend_expired_paid_organization(');
    const subscriptionLock = block.indexOf('FROM public.subscriptions');
    const periodLock = block.indexOf('FROM public.subscription_periods');
    const organizationLock = block.indexOf('FROM public.organizations');

    expect(subscriptionLock).toBeGreaterThanOrEqual(0);
    expect(periodLock).toBeGreaterThan(subscriptionLock);
    expect(organizationLock).toBeGreaterThan(periodLock);
    expect(block).toContain("subscription_record.provider NOT IN ('ecpay', 'manual')");
    expect(block).toContain("subscription_record.status <> 'active'");
    expect(block).toContain('subscription_record.current_period_end > effective_at');
    expect(block).toContain("period.status = 'active'");
    expect(block).toContain('period.period_start <= effective_at');
    expect(block).toContain('period.period_end > effective_at');
    expect(block).toContain('FOR UPDATE;');
    expect(block).toContain('current_period_start = covering_period_start');
    expect(block).toContain('current_period_end = covering_period_end');
    expect(block).toContain("'reason', 'active_paid_period_aggregate_repaired'");
    expect(block).toContain("'aggregate_repaired', true");
    expect(block).not.toContain("'reason', 'active_paid_period_remains'");
    expect(block).toContain("SET status = 'expired'");
    expect(block).toContain('AND period_end <= effective_at');
    expect(block).toContain("status = 'suspended'");
    expect(block).toContain("suspension_source = 'billing'");
    expect(block).toContain("org_record.status <> 'active'");
    expect(block).toContain("'reason', 'organization_not_active'");
    expect(block).toContain("'lifecycle.prepaid_period_expired_suspended'");
    expect(block).toContain("'source', 'cron.saas.paid_period_expiry'");
    expect(block.match(/INSERT INTO public\.audit_logs/g)).toHaveLength(1);
    expect(block).not.toContain('cancel_at_period_end');
    expect(source).not.toContain('DROP POLICY');
  });

  it('keeps the expiry RPC service-role only and maps its audit to billing suspension', () => {
    const expiryBlock = functionBlock('suspend_expired_paid_organization(');
    expect(expiryBlock).toContain("IF auth.role() IS DISTINCT FROM 'service_role' THEN");
    expect(expiryBlock).toContain("USING ERRCODE = '42501'");
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)'
    );
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)\n  FROM anon;'
    );
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)\n  FROM authenticated;'
    );
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)'
    );
    expect(source).toContain('TO service_role;');
    expect(source).not.toContain(
      'GRANT EXECUTE ON FUNCTION public.suspend_expired_paid_organization(UUID, TIMESTAMPTZ)\n  TO authenticated;'
    );

    const block = functionBlock('sync_organization_suspension_source_from_audit()');
    expect(block).toContain("NEW.action = 'lifecycle.prepaid_period_expired_suspended'");
    expect(block).toContain("SET suspension_source = 'billing'");
    expect(source).toContain(
      'DROP TRIGGER IF EXISTS trg_sync_organization_suspension_source ON public.audit_logs'
    );
    expect(source).toContain(
      'EXECUTE FUNCTION public.sync_organization_suspension_source_from_audit()'
    );
  });
});
