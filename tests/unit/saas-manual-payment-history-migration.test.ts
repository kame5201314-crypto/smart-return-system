import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/053_saas_manual_payment_history.sql'),
  'utf8'
);
const functionBody = source.match(
  /CREATE OR REPLACE FUNCTION public\.list_customer_manual_payment_history[\s\S]*?AS \$\$([\s\S]*?)\$\$;/
)?.[1] ?? '';

describe('SaaS manual payment history migration', () => {
  it('uses an empty-search-path SECURITY DEFINER read model with a bounded limit', () => {
    expect(source).toContain('RETURNS JSONB');
    expect(source).toContain('STABLE');
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain("SET search_path = ''");
    expect(source).toContain(
      'LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100)'
    );
  });

  it('validates immutable manual payment payloads and idempotency keys before writes', () => {
    expect(source).toContain('public.is_valid_manual_payment_event_payload');
    expect(source).toContain("jsonb_typeof(p_payload -> 'amount_twd') IS DISTINCT FROM 'number'");
    expect(source).toContain('period_end_at > period_start_at');
    expect(source).toContain('effective_at = p_processed_at');
    expect(source).toContain('processed manual payment events are immutable');
    expect(source).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(source).toContain('manual payment idempotency key already belongs to different input');
    expect(source).toContain('malformed manual payment events exist');
    expect(source).toContain('trg_enforce_manual_payment_event_payload_integrity');
  });

  it('allows only service role or active authenticated owners and admins', () => {
    expect(functionBody).toContain("caller_role NOT IN ('authenticated', 'service_role')");
    expect(functionBody).toContain("caller_role = 'authenticated'");
    expect(functionBody).toContain('caller_user_id UUID := auth.uid()');
    expect(functionBody).toContain('member.org_id = p_org_id');
    expect(functionBody).toContain('member.user_id = caller_user_id');
    expect(functionBody).toContain("member.role IN ('owner', 'admin')");
    expect(functionBody).toContain("COALESCE(member.status, 'active') = 'active'");
    expect(functionBody).toContain("ERRCODE = '42501'");
  });

  it('returns only processed manual payments for the requested organization', () => {
    expect(functionBody).toContain('event.org_id = p_org_id');
    expect(functionBody).toContain("event.provider = 'manual'");
    expect(functionBody).toContain("event.event_type = 'manual.payment_marked'");
    expect(functionBody).toContain("event.status = 'processed'");
    expect(functionBody).toContain('event.processed_at IS NOT NULL');
    expect(functionBody).toContain(
      'public.is_valid_manual_payment_event_payload(event.payload, event.processed_at)'
    );
    expect(functionBody).toContain(
      'ORDER BY event.processed_at DESC, event.created_at DESC'
    );
  });

  it('scrubs internal payload, metadata and reason fields from the returned object', () => {
    expect(functionBody).toContain("'plan', NULL");
    expect(functionBody).toContain("'provider', 'manual'");
    expect(functionBody).toContain("'amount_twd', event.payload -> 'amount_twd'");
    expect(functionBody).not.toMatch(/'payload'\s*,/);
    expect(functionBody).not.toMatch(/'metadata'\s*,/);
    expect(functionBody).not.toMatch(/'reason'\s*,/);
  });

  it('revokes public and anonymous access and grants only authenticated and service role', () => {
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.list_customer_manual_payment_history(UUID, INTEGER) FROM PUBLIC;'
    );
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.list_customer_manual_payment_history(UUID, INTEGER) FROM anon;'
    );
    expect(source).toContain('TO authenticated, service_role;');
  });
});
