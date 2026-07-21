import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/049_saas_custom_plan_offers.sql'),
  'utf8'
);

function functionBlock(name: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n$$;', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 4);
}

describe('SaaS custom plan offers migration', () => {
  it('stores only one-month Basic offers inside the supported ECPay amount range', () => {
    expect(source).toContain('CREATE TABLE IF NOT EXISTS public.custom_plan_offers');
    expect(source).toContain('amount_twd BETWEEN 5 AND 199999');
    expect(source).toContain("POSITION('#' IN title) = 0");
    expect(source).toContain("CHECK (plan = 'basic')");
    expect(source).toContain('CHECK (billing_period_months = 1)');
    expect(source).toContain("status IN ('active', 'paid', 'cancelled', 'expired')");
    expect(source).toContain('payment_order_id UUID REFERENCES public.payment_orders(id)');
    expect(source).toContain('created_by UUID REFERENCES auth.users(id)');
    expect(source).toContain('cancelled_by UUID REFERENCES auth.users(id)');
  });

  it('allows only active owner/admin reads and exposes only merchant-safe columns', () => {
    expect(source).toContain('ALTER TABLE public.custom_plan_offers ENABLE ROW LEVEL SECURITY');
    expect(source).toContain(
      'public.is_active_custom_plan_offer_billing_admin(org_id)'
    );
    const readerBlock = functionBlock('is_active_custom_plan_offer_billing_admin');
    expect(readerBlock).toContain("member.role IN ('owner', 'admin')");
    expect(readerBlock).toContain("member.status = 'active'");
    expect(source).toContain(
      'REVOKE ALL ON TABLE public.custom_plan_offers FROM PUBLIC, anon, authenticated;'
    );
    expect(source).not.toContain(
      'GRANT SELECT ON TABLE public.custom_plan_offers TO authenticated;'
    );
    const safeGrantStart = source.indexOf('GRANT SELECT (');
    const safeGrantEnd = source.indexOf(
      ') ON TABLE public.custom_plan_offers TO authenticated;',
      safeGrantStart
    );
    const safeGrant = source.slice(safeGrantStart, safeGrantEnd);
    expect(safeGrantStart).toBeGreaterThan(-1);
    expect(safeGrantEnd).toBeGreaterThan(safeGrantStart);
    expect(safeGrant).toContain('amount_twd');
    expect(safeGrant).toContain('payment_order_id');
    expect(safeGrant).not.toContain('created_by');
    expect(safeGrant).not.toContain('cancelled_by');
    expect(safeGrant).not.toContain('cancellation_reason');
    expect(source).not.toContain('GRANT INSERT ON TABLE public.custom_plan_offers TO authenticated');

    for (const name of [
      'create_custom_plan_offer',
      'cancel_custom_plan_offer',
      'create_custom_plan_payment_order',
    ]) {
      const block = functionBlock(name);
      expect(block).toContain("COALESCE(auth.role(), '') <> 'service_role'");
    }
  });

  it('creates and cancels offers with actor-aware audit logs', () => {
    const actorValidatorBlock = functionBlock(
      'validate_custom_plan_offer_actor_metadata'
    );
    const createBlock = functionBlock('create_custom_plan_offer');
    const cancelBlock = functionBlock('cancel_custom_plan_offer');

    expect(actorValidatorBlock).toContain('actor_kind IS NULL');
    expect(actorValidatorBlock).toContain('actor_fingerprint_sha256 IS NULL');
    expect(actorValidatorBlock).toContain('platform_role IS NULL');
    expect(actorValidatorBlock).toContain("actor_kind IS DISTINCT FROM 'legacy_admin'");
    expect(createBlock).toContain("'custom_plan.offer_created'");
    expect(createBlock).toContain("POSITION('#' IN normalized_title) > 0");
    expect(createBlock).toContain('p_actor_user_id');
    expect(createBlock).toContain("INTERVAL '1 hour'");
    expect(createBlock).toContain("INTERVAL '90 days'");
    expect(cancelBlock).toContain("offer_record.status <> 'active'");
    expect(cancelBlock).toContain("payment_order.metadata ->> 'custom_offer_id'");
    expect(cancelBlock).not.toContain('payment_order.status IN');
    const paymentGuard = cancelBlock.slice(
      cancelBlock.indexOf('IF EXISTS ('),
      cancelBlock.indexOf("RAISE EXCEPTION 'custom plan offer cannot be cancelled")
    );
    expect(paymentGuard).not.toContain('FOR UPDATE');
    expect(cancelBlock).toContain("'custom_plan.offer_cancelled'");
  });

  it('derives checkout price from the locked offer and never accepts a client amount', () => {
    const block = functionBlock('create_custom_plan_payment_order');
    const signature = source.slice(
      source.indexOf('CREATE OR REPLACE FUNCTION public.create_custom_plan_payment_order'),
      source.indexOf('RETURNS JSONB', source.indexOf(
        'CREATE OR REPLACE FUNCTION public.create_custom_plan_payment_order'
      ))
    );

    expect(signature).not.toContain('p_amount_twd');
    expect(block).toContain('offer_record.amount_twd');
    expect(block).toContain("member.role IN ('owner', 'admin')");
    expect(block).toContain("COALESCE(member.status, 'active') = 'active'");
    expect(block).toContain('platform-suspended organizations require operator review');
    expect(block).toContain('custom offer checkout cannot downgrade the current plan');
    expect(block).toContain("'pricing_kind', 'custom_offer'");
    expect(block).toContain("'custom_offer_id', offer_record.id");
    expect(block).toContain("'custom_offer_title', offer_record.title");
    expect(block).toContain("'billing_period_months', offer_record.billing_period_months");
  });

  it('serializes idempotency, permanently closes used offers, and applies durable limits', () => {
    const block = functionBlock('create_custom_plan_payment_order');
    const lock = block.indexOf('PERFORM pg_advisory_xact_lock(');
    const exact = block.indexOf('idempotency_key = normalized_idempotency_key');
    const reusable = block.indexOf('INTO reusable_order');
    const subscription = block.indexOf('FROM public.subscriptions');
    const organization = block.indexOf('FROM public.organizations', subscription);
    const offer = block.indexOf('FROM public.custom_plan_offers', organization);

    expect(lock).toBeGreaterThan(-1);
    expect(exact).toBeGreaterThan(lock);
    expect(reusable).toBeGreaterThan(exact);
    expect(subscription).toBeGreaterThan(reusable);
    expect(organization).toBeGreaterThan(subscription);
    expect(offer).toBeGreaterThan(organization);
    const associatedOrderLookup = block.slice(reusable, subscription);
    expect(associatedOrderLookup).not.toContain("status = 'pending'");
    expect(associatedOrderLookup).not.toContain('provider = normalized_provider');
    expect(block).toContain("selected_order.status = 'pending'");
    expect(block).toContain("'error_code', 'offer_checkout_closed'");
    expect(block).toContain("'custom_plan.offer_checkout_closed'");
    expect(block).toContain("INTERVAL '15 minutes'");
    expect(block).toContain("INTERVAL '1 hour'");
    expect(block).toContain('OFFSET 4');
    expect(block).toContain('OFFSET 9');
    expect(block).toContain("'error_code', 'checkout_rate_limited'");
  });

  it('permits only one lifetime order and honors a verified late settlement', () => {
    const uniqueIndexStart = source.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_custom_offer_single_checkout'
    );
    const uniqueIndexEnd = source.indexOf(';', uniqueIndexStart);
    const uniqueIndex = source.slice(uniqueIndexStart, uniqueIndexEnd);
    expect(uniqueIndexStart).toBeGreaterThan(-1);
    expect(uniqueIndex).toContain("metadata ->> 'pricing_kind' = 'custom_offer'");
    expect(uniqueIndex).not.toContain('status IN');
    const block = functionBlock('settle_custom_plan_offer_from_payment_order');
    expect(block).toContain("NEW.status = 'paid'");
    expect(block).toContain("OLD.metadata ->> 'pricing_kind' = 'custom_offer'");
    expect(block).toContain('offer_record.amount_twd <> NEW.amount_twd');
    expect(block).toContain('OLD.created_at > offer_record.expires_at');
    expect(block).not.toContain('offer_record.expires_at <= effective_paid_at');
    expect(block).toContain("status = 'paid'");
    expect(block).toContain("'custom_plan.offer_paid'");
    expect(source).toContain(
      'BEFORE UPDATE OF status ON public.payment_orders'
    );
  });
});
