import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/045_saas_suspended_org_write_guards.sql'),
  'utf8'
);

const guardedWritePolicies = [
  'customers_staff_insert',
  'orders_staff_insert',
  'orders_staff_update',
  'return_requests_staff_insert',
  'return_requests_staff_update',
  'return_items_staff_insert',
  'return_items_staff_update',
  'return_images_staff_insert',
  'return_images_staff_update',
  'inspection_records_staff_insert',
  'inspection_records_staff_update',
  'shopee_returns_staff_insert',
  'shopee_returns_staff_update',
  'pickup_records_staff_insert',
  'pickup_records_staff_update',
  'shopee_unmatched_scans_staff_insert',
  'shopee_unmatched_scans_staff_update',
] as const;

describe('SaaS suspended organization RLS migration', () => {
  it('fails closed for disabled members and inactive or expired subscriptions', () => {
    expect(source).toContain('CREATE OR REPLACE FUNCTION public.is_writable_organization_member');
    expect(source).toContain("COALESCE(member.status, 'active') = 'active'");
    expect(source).toContain("organization.status = 'active'");
    expect(source).toContain("subscription.status = 'active'");
    expect(source).toContain("organization.status = 'trialing'");
    expect(source).toContain("subscription.status = 'trialing'");
    expect(source).toContain('subscription.trial_end IS NOT NULL');
    expect(source).toContain('subscription.trial_end > NOW()');
    expect(source).not.toMatch(/status\s+IN\s*\([^)]*past_due/i);
    expect(source).not.toMatch(/status\s+IN\s*\([^)]*suspended/i);
    expect(source).not.toMatch(/status\s+IN\s*\([^)]*cancelled/i);
  });

  it.each(guardedWritePolicies)('replaces %s with the central write guard', (policy) => {
    const policyStart = source.indexOf(`CREATE POLICY "${policy}"`);
    expect(policyStart).toBeGreaterThan(-1);

    const nextPolicy = source.indexOf('CREATE POLICY', policyStart + 1);
    const block = source.slice(policyStart, nextPolicy === -1 ? undefined : nextPolicy);
    expect(block).toContain('public.is_writable_organization_member(');
    expect(block).not.toContain('SELECT org_id FROM public.organization_members');
  });

  it('does not replace SELECT policies, preserving suspended tenant read-only access', () => {
    expect(source).not.toContain('DROP POLICY IF EXISTS "customers_members_select"');
    expect(source).not.toContain('DROP POLICY IF EXISTS "return_requests_members_select"');
    expect(source).not.toContain('DROP POLICY IF EXISTS "shopee_returns_members_select"');
  });

  it('keeps execution private to authenticated and service roles', () => {
    expect(source).toContain(
      'REVOKE ALL ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) FROM PUBLIC;'
    );
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) TO authenticated;'
    );
    expect(source).toContain(
      'GRANT EXECUTE ON FUNCTION public.is_writable_organization_member(UUID, TEXT[]) TO service_role;'
    );
  });
});
