import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/saas/check-migration-plan.mjs');
const orgMemberVisibilityMigrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/038_saas_org_member_visibility.sql'
);
const saasProjectRef = 'auyznbwtjvemyamujmgt';

function runMigrationPlan(env: Record<string, string> = {}, args: string[] = ['--strict']) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_MODE: 'saas',
      SAAS_SUPABASE_PROJECT_ID: saasProjectRef,
      SUPABASE_PROJECT_ID_EXPECTED: saasProjectRef,
      NEXT_PUBLIC_SUPABASE_URL: `https://${saasProjectRef}.supabase.co`,
      INTERNAL_SUPABASE_PROJECT_ID: 'fdzfnenizyppxglypden',
      SUPABASE_DB_PASSWORD: 'test-password',
      SAAS_MIGRATION_PLAN_SKIP_GIT_CHECK: '1',
      ...env,
    },
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

describe('SaaS migration plan check', () => {
  it('passes for the expected SaaS Supabase project and full migration chain', () => {
    const result = runMigrationPlan();

    expect(result.status).toBe(0);
    expect(result.output).toContain('SAAS_SUPABASE_PROJECT_ID - auyznbwtjvemyamujmgt');
    expect(result.output).toContain(
      'Migration chain end - 043_saas_google_trial_claims_service_role_read.sql'
    );
    expect(result.output).toContain('No migrations were applied by this check.');
  });

  it('rejects forbidden internal Supabase project refs', () => {
    const result = runMigrationPlan({
      SAAS_SUPABASE_PROJECT_ID: 'fdzfnenizyppxglypden',
      SUPABASE_PROJECT_ID_EXPECTED: 'fdzfnenizyppxglypden',
      NEXT_PUBLIC_SUPABASE_URL: 'https://fdzfnenizyppxglypden.supabase.co',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('forbidden Supabase project ref: fdzfnenizyppxglypden');
  });

  it('requires SUPABASE_DB_PASSWORD in strict mode', () => {
    const result = runMigrationPlan({
      SUPABASE_DB_PASSWORD: '',
    });

    expect(result.status).toBe(1);
    expect(result.output).toContain('SUPABASE_DB_PASSWORD');
    expect(result.output).toContain('required before running supabase db push');
  });

  it('keeps the team member visibility migration helper-backed to avoid recursive RLS', () => {
    const source = fs.readFileSync(orgMemberVisibilityMigrationPath, 'utf8');

    expect(source).toContain('CREATE OR REPLACE FUNCTION public.is_organization_member');
    expect(source).toContain('SECURITY DEFINER');
    expect(source).toContain('DROP POLICY IF EXISTS "members_select_org_memberships"');
    expect(source).toContain('CREATE POLICY "members_select_org_memberships"');
    expect(source).toContain('USING (public.is_organization_member(org_id))');
    expect(source).not.toContain(
      'USING (org_id IN (SELECT org_id FROM public.organization_members'
    );
  });
});
