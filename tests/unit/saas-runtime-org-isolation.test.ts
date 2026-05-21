import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

describe('SaaS runtime org isolation', () => {
  it('requires org context in P0 return actions and scopes business writes', () => {
    const source = readProjectFile('lib/actions/return.actions.ts');

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getReturnOrgContext()');
    expect(source).toContain('await getWritableReturnOrgContext()');
    expect(source).toContain(".eq('org_id', orgContext.orgId)");
    expect(source).toContain('org_id: orgContext.orgId');
    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain('org_id: orgId');
  });

  it('requires org context and org filters in AI analysis runtime routes', () => {
    const source = readProjectFile('app/api/v1/ai/analyze/route.ts');

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getOrgContext({');
    expect(source).toContain("from '@/lib/saas/ai-quota'");
    expect(source).toContain('await assertAIQuotaAvailable({');
    expect(source).toContain(".eq('org_id', orgContext.orgId)");
    expect(source).toContain('org_id: orgContext.orgId');
    expect(source).toContain('recordAIUsageEvent(untypedSupabase, orgContext.orgId');
  });

  it.each([
    ['returns export', 'app/api/v1/admin/returns/export/route.ts'],
    ['Shopee returns export', 'app/api/v1/admin/shopee-returns/export/route.ts'],
    ['pickup export', 'app/api/v1/admin/pickup/export/route.ts'],
  ])('requires org context and org filters in %s', (_name, path) => {
    const source = readProjectFile(path);

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getOrgContext({');
    expect(source).toContain(".eq('org_id', orgId)");
  });
});
