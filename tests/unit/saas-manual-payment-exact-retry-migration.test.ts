import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/055_saas_manual_payment_exact_retry.sql'),
  'utf8'
);
const functionBody = source.match(
  /CREATE OR REPLACE FUNCTION public\.perform_platform_billing_operation_v2[\s\S]*?AS \$\$([\s\S]*?)\$\$;/
)?.[1] ?? '';

describe('SaaS manual payment exact-retry migration', () => {
  it('uses a fixed definer boundary and exposes only the v2 RPC to service role', () => {
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain("SET search_path = ''");
    expect(source).toContain('REVOKE EXECUTE ON FUNCTION public.perform_platform_billing_operation(');
    expect(source).toContain(') FROM service_role;');
    expect(source).toContain('REVOKE ALL ON FUNCTION public.perform_platform_billing_operation_v2(');
    expect(source).toContain(') FROM PUBLIC, anon, authenticated;');
    expect(source).toContain('GRANT EXECUTE ON FUNCTION public.perform_platform_billing_operation_v2(');
    expect(source).toContain(') TO service_role;');
  });

  it('requires an explicit key, timestamp, amount, and valid paid period', () => {
    expect(functionBody).toContain('normalized_idempotency_key IS NULL');
    expect(functionBody).toContain('p_effective_at IS NULL');
    expect(functionBody).toContain("p_effective_at > transaction_timestamp() + INTERVAL '5 minutes'");
    expect(functionBody).toContain('p_amount_twd IS NULL OR p_amount_twd <= 0');
    expect(functionBody).toContain(
      'p_period_end IS NULL OR p_period_end <= COALESCE(p_period_start, p_effective_at)'
    );
    expect(functionBody).toContain(
      'public.is_valid_manual_payment_event_payload(expected_payload, p_effective_at)'
    );
  });

  it('reconstructs every immutable event payload field before comparing a retry', () => {
    for (const field of [
      'operation',
      'amount_twd',
      'period_start',
      'period_end',
      'effective_at',
      'invoice_id',
      'reason',
      'metadata',
    ]) {
      expect(functionBody).toContain(`'${field}'`);
    }
    expect(functionBody).toContain('existing_event.payload');
    expect(functionBody).toContain('expected_payload');
    expect(functionBody).toContain('existing_event.processed_at');
    expect(functionBody).toContain("ERRCODE = '23505'");
    expect(functionBody).toContain(
      'manual payment idempotency key already belongs to different input'
    );
  });

  it('locks in billing-writer order before reading the idempotency event', () => {
    const subscriptionLock = functionBody.indexOf('FROM public.subscriptions AS subscription');
    const organizationLock = functionBody.indexOf('FROM public.organizations AS organization');
    const advisoryLock = functionBody.indexOf('pg_catalog.pg_advisory_xact_lock');
    const eventLock = functionBody.indexOf('FROM public.billing_events AS event');
    expect(subscriptionLock).toBeGreaterThan(-1);
    expect(organizationLock).toBeGreaterThan(subscriptionLock);
    expect(advisoryLock).toBeGreaterThan(organizationLock);
    expect(eventLock).toBeGreaterThan(advisoryLock);
    expect(functionBody).toContain(
      "pg_catalog.hashtextextended('manual:' || normalized_idempotency_key, 0)"
    );
  });

  it('returns an exact retry before delegating and performs no direct writes', () => {
    const foundBranch = functionBody.indexOf('IF FOUND THEN');
    const replayReturn = functionBody.indexOf("'billing_event_id', existing_event.id", foundBranch);
    const delegate = functionBody.lastIndexOf('RETURN public.perform_platform_billing_operation(');
    expect(foundBranch).toBeGreaterThan(-1);
    expect(replayReturn).toBeGreaterThan(foundBranch);
    expect(delegate).toBeGreaterThan(replayReturn);
    expect(functionBody).not.toMatch(/\bUPDATE\s+public\./);
    expect(functionBody).not.toMatch(/\bINSERT\s+INTO\s+public\./);
  });

  it('delegates non-manual operations without changing their existing semantics', () => {
    const nonManualBranch = functionBody.indexOf(
      "IF p_operation IS DISTINCT FROM 'mark_manual_payment' THEN"
    );
    const firstDelegate = functionBody.indexOf(
      'RETURN public.perform_platform_billing_operation(',
      nonManualBranch
    );
    expect(nonManualBranch).toBeGreaterThan(-1);
    expect(firstDelegate).toBeGreaterThan(nonManualBranch);
  });
});
