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
  it('requires paid and settled manual-review orders to have plausible paid_at timestamps', () => {
    expect(source).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_payment_order_paid_at_integrity()'
    );
    expect(source).toContain("IF TG_OP = 'UPDATE'");
    expect(source).toContain('original_created_at := OLD.created_at');
    expect(source).toContain('NEW.created_at IS DISTINCT FROM OLD.created_at');
    expect(source).toContain(
      'OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at'
    );
    expect(source).toContain("IF NEW.status <> 'paid'");
    expect(source).toContain(
      "NEW.status = 'manual_review' AND NEW.paid_at IS NOT NULL"
    );
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
    expect(source).toContain('IF NEW.processed_at IS NULL');
    expect(source).toContain('NEW.processed_at > accepted_future_limit');
    expect(source).toContain("NOT (NEW.payload ? 'effective_at')");
    expect(source).toContain(
      "NULLIF(BTRIM(NEW.payload ->> 'effective_at'), '')::TIMESTAMPTZ"
    );
    expect(source).toContain('payload_effective_at > accepted_future_limit');
    expect(source).toContain(
      'BEFORE INSERT OR UPDATE OF event_type, processed_at, payload'
    );
  });

  it('preflights existing paid and settled manual-review rows instead of accepting anomalies', () => {
    expect(source).toContain('DO $$');
    expect(source).toContain("payment_order.status = 'paid'");
    expect(source).toContain("payment_order.status = 'manual_review'");
    expect(source).toContain('payment_order.paid_at IS NOT NULL');
    expect(source).toContain('payment_order.paid_at IS NULL');
    expect(source).toContain(
      'existing settled payment orders contain invalid timestamps'
    );
  });

  it('does not block legitimate future-start trial or manual renewals', () => {
    expect(source).not.toContain('enforce_paid_subscription_activation_timestamp');
    expect(source).not.toContain('trg_enforce_paid_subscription_activation_timestamp');
  });

  it('keeps both trigger functions unavailable to public callers', () => {
    expect(source.match(/REVOKE ALL ON FUNCTION public\./g)).toHaveLength(2);
    expect(source.match(/TO service_role;/g)).toHaveLength(2);
  });
});
