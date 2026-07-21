import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/052_saas_billing_timestamp_integrity.sql'
  ),
  'utf8'
);

describe('SaaS billing timestamp integrity migration', () => {
  it('requires every paid payment order to have a plausible paid_at timestamp', () => {
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_payment_order_paid_at_integrity()'
    );
    expect(source).toContain("IF NEW.status <> 'paid'");
    expect(source).toContain("IF TG_OP = 'UPDATE'");
    expect(source).toContain('original_created_at := OLD.created_at');
    expect(source).toContain('IF NEW.paid_at IS NULL');
    expect(source).toContain(
      "NEW.paid_at < original_created_at - INTERVAL '5 minutes'"
    );
    expect(source).toContain(
      "transaction_timestamp() + INTERVAL '5 minutes'"
    );
    expect(source).toContain('NEW.paid_at > accepted_future_limit');
    expect(source).toContain(
      'BEFORE INSERT OR UPDATE OF status, paid_at, created_at'
    );
  });

  it('rejects future manual-payment processing and effective timestamps', () => {
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_manual_payment_event_timestamp_integrity()'
    );
    expect(source).toContain("NEW.event_type <> 'manual.payment_marked'");
    expect(source).toContain('NEW.processed_at > accepted_future_limit');
    expect(source).toContain("NEW.payload ? 'effective_at'");
    expect(source).toContain(
      "NULLIF(BTRIM(NEW.payload ->> 'effective_at'), '')::TIMESTAMPTZ"
    );
    expect(source).toContain('payload_effective_at > accepted_future_limit');
    expect(source).toContain(
      'BEFORE INSERT OR UPDATE OF event_type, processed_at, payload'
    );
  });

  it('allows a future paid renewal only when an active period covers database now', () => {
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_paid_subscription_activation_timestamp()'
    );
    expect(source).toContain("NEW.provider IN ('ecpay', 'manual')");
    expect(source).toContain(
      'NEW.current_period_start > transaction_timestamp()'
    );
    expect(source).toContain(
      'period.period_start <= transaction_timestamp()'
    );
    expect(source).toContain('period.period_end > transaction_timestamp()');
    expect(source).toContain('IF covering_period_start IS NULL');
    expect(source).toContain('NEW.current_period_start := covering_period_start');
    expect(source).toContain(
      'BEFORE INSERT OR UPDATE OF status, provider, current_period_start, current_period_end'
    );
  });

  it('keeps all trigger functions unavailable to public callers', () => {
    expect(source.match(/REVOKE ALL ON FUNCTION public\./g)).toHaveLength(3);
    expect(source.match(/TO service_role;/g)).toHaveLength(3);
  });
});
