import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/048_saas_checkout_order_hardening.sql'),
  'utf8'
);

function functionBlock(name: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n$$;', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 4);
}

describe('SaaS checkout order hardening migration', () => {
  it('uses the existing payment ledger and indexes only reusable pending orders', () => {
    expect(source).not.toContain('CREATE TABLE');
    expect(source).toContain('idx_payment_orders_pending_checkout_reuse');
    expect(source).toContain("WHERE status = 'pending';");
    expect(source).toContain('expires_at DESC');
  });

  it('serializes checkout per organization before expiring or selecting orders', () => {
    const block = functionBlock('create_self_service_payment_order');
    const lock = block.indexOf('PERFORM pg_advisory_xact_lock(');
    const expire = block.indexOf('UPDATE public.payment_orders');
    const exactLookup = block.indexOf('idempotency_key = normalized_idempotency_key');

    expect(lock).toBeGreaterThan(-1);
    expect(block).toContain("'self_service_checkout:' || p_org_id::text");
    expect(expire).toBeGreaterThan(lock);
    expect(exactLookup).toBeGreaterThan(expire);
    expect(block.slice(expire, exactLookup)).toContain("status = 'expired'");
    expect(block.slice(expire, exactLookup)).toContain('expires_at <= checkout_now');
  });

  it('reuses only a matching unexpired pending order and keeps the settlement lock order', () => {
    const block = functionBlock('create_self_service_payment_order');
    const reusableLookup = block.indexOf('INTO reusable_order');
    const subscriptionLock = block.indexOf('FROM public.subscriptions');
    const organizationLock = block.indexOf('FROM public.organizations');

    expect(reusableLookup).toBeGreaterThan(-1);
    expect(block.slice(reusableLookup, subscriptionLock)).toContain(
      "AND status = 'pending'"
    );
    expect(block.slice(reusableLookup, subscriptionLock)).toContain(
      'AND expires_at > checkout_now'
    );
    expect(block.slice(reusableLookup, subscriptionLock)).toContain(
      'AND merchant_id = normalized_merchant_id'
    );
    expect(block.slice(reusableLookup, subscriptionLock)).toContain('FOR UPDATE');
    expect(subscriptionLock).toBeGreaterThan(reusableLookup);
    expect(organizationLock).toBeGreaterThan(subscriptionLock);
    expect(block.slice(subscriptionLock, organizationLock)).toContain('FOR UPDATE');
    expect(block.slice(organizationLock)).toContain('FOR UPDATE');
    expect(block).toContain("ELSE 'reused_pending'");
  });

  it('enforces actor and organization rolling limits only before a new insert', () => {
    const block = functionBlock('create_self_service_payment_order');
    const selectedReturn = block.indexOf('IF selected_order.id IS NOT NULL THEN');
    const actorWindow = block.indexOf('INTO actor_limit_created_at');
    const orgWindow = block.indexOf('INTO org_limit_created_at');
    const insert = block.indexOf('INSERT INTO public.payment_orders');

    expect(actorWindow).toBeGreaterThan(selectedReturn);
    expect(orgWindow).toBeGreaterThan(actorWindow);
    expect(insert).toBeGreaterThan(orgWindow);
    expect(block.slice(actorWindow, orgWindow)).toContain('created_by = p_actor_user_id');
    expect(block.slice(actorWindow, orgWindow)).toContain("INTERVAL '15 minutes'");
    expect(block.slice(actorWindow, orgWindow)).toContain('OFFSET 4');
    expect(block.slice(orgWindow, insert)).toContain("INTERVAL '1 hour'");
    expect(block.slice(orgWindow, insert)).toContain('OFFSET 9');
    expect(block.slice(orgWindow, insert)).toContain(
      "'error_code', 'checkout_rate_limited'"
    );
    expect(block.slice(orgWindow, insert)).toContain(
      "'retry_after_seconds', retry_after_seconds"
    );
  });

  it('keeps the replaced RPC service-role only', () => {
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.create_self_service_payment_order('
    );
    expect(source).toContain('FROM PUBLIC, anon, authenticated;');
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.create_self_service_payment_order('
    );
    expect(source).toContain('TO service_role;');
  });
});
