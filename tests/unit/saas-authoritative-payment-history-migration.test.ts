import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/054_saas_authoritative_payment_history.sql'),
  'utf8'
);
const functionBody = source.match(
  /CREATE OR REPLACE FUNCTION public\.list_customer_payment_history[\s\S]*?AS \$\$([\s\S]*?)\$\$;/
)?.[1] ?? '';

describe('SaaS authoritative customer payment history migration', () => {
  it('preflights malformed and implausibly future manual payment events', () => {
    expect(source).toContain("event.processed_at > transaction_timestamp() + INTERVAL '5 minutes'");
    expect(source).toContain(
      'public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)'
    );
    expect(source).toContain('audit them before applying migration 054');
  });

  it('adds a partial index matching the manual history predicate and order', () => {
    expect(source).toContain('idx_billing_events_manual_payment_history');
    expect(source).toContain(
      'ON public.billing_events(org_id, processed_at DESC, created_at DESC, id)'
    );
    expect(source).toContain("WHERE provider = 'manual'");
    expect(source).toContain("event_type = 'manual.payment_marked'");
    expect(source).toContain("status = 'processed'");
  });

  it('pairs provider orders with their exact purchased period before limiting', () => {
    expect(functionBody).toContain('FROM public.payment_orders AS payment_order');
    expect(functionBody).toContain('LEFT JOIN public.subscription_periods AS period');
    expect(functionBody).toContain('period.payment_order_id = payment_order.id');
    expect(functionBody).toContain('period.org_id = payment_order.org_id');
    expect(functionBody).toContain('period.org_id = p_org_id');
    expect(functionBody).toContain('period.subscription_id = payment_order.subscription_id');
    expect(functionBody).toContain("'period_start', period.period_start");
    expect(functionBody).toContain("'period_end', period.period_end");
  });

  it('globally orders both sources with a deterministic tie break before one limit', () => {
    expect(functionBody.match(/UNION ALL/g)).toHaveLength(2);
    expect(functionBody).toContain(
      'ORDER BY combined.sort_at DESC, combined.created_at DESC, combined.tie_key ASC'
    );
    expect(functionBody).toContain('LIMIT bounded_limit');
    expect(functionBody).toContain(
      'ORDER BY payment.sort_at DESC, payment.created_at DESC, payment.tie_key ASC'
    );
    expect(functionBody).toContain('LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100)');
  });

  it('resolves the current entitlement outside the bounded history', () => {
    const historyLimitPosition = functionBody.indexOf('LIMIT bounded_limit');
    const currentEntitlementPosition = functionBody.indexOf('INTO current_entitlement_period');
    expect(historyLimitPosition).toBeGreaterThan(-1);
    expect(currentEntitlementPosition).toBeGreaterThan(historyLimitPosition);
    expect(functionBody).toContain("period.status = 'active'");
    expect(functionBody).toContain("payment_order.status = 'paid'");
    expect(functionBody).toContain('period.period_start <= transaction_timestamp()');
    expect(functionBody).toContain('period.period_end > transaction_timestamp()');
    expect(functionBody).toContain(
      "(event.payload ->> 'period_start')::TIMESTAMPTZ <= transaction_timestamp()"
    );
    expect(functionBody).toContain(
      "(event.payload ->> 'period_end')::TIMESTAMPTZ > transaction_timestamp()"
    );
    expect(functionBody).toContain("'history', history");
    expect(functionBody).toContain("'current_entitlement_period', current_entitlement_period");
  });

  it('allows only service role or active authenticated owners and admins', () => {
    expect(functionBody).toContain("caller_role NOT IN ('authenticated', 'service_role')");
    expect(functionBody).toContain('member.org_id = p_org_id');
    expect(functionBody).toContain('member.user_id = caller_user_id');
    expect(functionBody).toContain("member.role IN ('owner', 'admin')");
    expect(functionBody).toContain("COALESCE(member.status, 'active') = 'active'");
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.list_customer_payment_history(UUID, INTEGER)'
    );
    expect(source).toContain('TO authenticated, service_role;');
  });

  it('returns scrubbed customer fields without metadata, payload, reason, or provider identifiers', () => {
    expect(functionBody).toContain("'amount_twd', payment_order.amount_twd");
    expect(functionBody).toContain("'amount_twd', event.payload -> 'amount_twd'");
    expect(functionBody).not.toMatch(/'metadata'\s*,/);
    expect(functionBody).not.toMatch(/'payload'\s*,/);
    expect(functionBody).not.toMatch(/'reason'\s*,/);
    expect(functionBody).not.toMatch(/'merchant_trade_no'\s*,/);
    expect(functionBody).not.toMatch(/'trade_no'\s*,/);
  });
});
