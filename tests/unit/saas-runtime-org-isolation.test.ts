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
    expect(source).toContain('exportable: true');
    expect(source).toContain(".eq('org_id', orgId)");
  });

  it('requires org context and org filters in P1 Shopee returns actions', () => {
    const source = readProjectFile('lib/actions/shopee-returns.actions.ts');

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getShopeeReadOrgContext()');
    expect(source).toContain('await getShopeeWritableOrgContext()');
    expect(source).toContain(".eq('org_id', orgContext.orgId)");
    expect(source).toContain('org_id: orgContext.orgId');
    expect(source).toContain('orgId: orgContext.orgId');
    expect(source).not.toContain("orgId: 'unknown'");
  });

  it('requires org context and org filters in P1 pickup actions', () => {
    const source = readProjectFile('lib/actions/pickup.actions.ts');

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getPickupReadOrgContext()');
    expect(source).toContain('await getPickupWritableOrgContext()');
    expect(source).toContain(".eq('org_id', orgContext.orgId)");
    expect(source).toContain('org_id: orgContext.orgId');
    expect(source).toContain('orgId: orgContext.orgId');
  });

  it('scopes customer return portal writes and lookups by derived organization', () => {
    const source = readProjectFile('lib/actions/customer-return.actions.ts');

    expect(source).toContain(".select('id, org_id, customer_id, metadata')");
    expect(source).toContain(".eq('order_number', formData.orderNumber)");
    expect(source).toContain(".eq('customer_phone', formData.phone)");
    expect(source).toContain("const orgId = orderOrgIds[0] as string");
    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain('org_id: orgId');
    expect(source).toContain('returns/${orgId}/${returnRequest.id}');
    expect(source).not.toContain('.insert({\n          order_number: formData.orderNumber');
  });

  it('requires org context and org filters in upload image actions', () => {
    const source = readProjectFile('lib/actions/upload.ts');

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getUploadReadOrgContext()');
    expect(source).toContain('await getUploadWritableOrgContext()');
    // Upload paths are org-scoped via the shared storage helper (org id is
    // threaded into the path builder, which prefixes objects with orgs/{orgId}/).
    expect(source).toContain('buildReturnImageStoragePath({');
    expect(source).toContain('orgId: orgContext.orgId');
    expect(source).toContain(".eq('org_id', orgContext.orgId)");
    expect(source).toContain('org_id: orgContext.orgId');
  });

  it('supports org-scoped upload sessions in signed-url route', () => {
    const securitySource = readProjectFile('lib/upload/security.ts');
    const routeSource = readProjectFile('app/api/v1/upload/signed-url/route.ts');

    expect(securitySource).toContain('orgId?: string');
    expect(securitySource).toContain("...(input.orgId ? { orgId: input.orgId } : {})");
    expect(routeSource).toContain("from '@/lib/saas/org-context'");
    expect(routeSource).toContain('sessionVerification.payload.orgId');
    expect(routeSource).toContain('staging/${orgId}/${draftId}');
  });

  it('requires org context and org-scoped storage paths in backup actions', () => {
    const source = readProjectFile('lib/actions/backup.actions.ts');

    expect(source).toContain("from '@/lib/saas/org-context'");
    expect(source).toContain('await getBackupReadOrgId()');
    expect(source).toContain('await getBackupWritableOrgId()');
    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain('org_id: orgId');
    expect(source).toContain('backups/${orgId}/');
    expect(source).toContain('Backup belongs to another workspace');
  });

  it('keeps backup cron tenant-scoped instead of platform-wide', () => {
    const source = readProjectFile('app/api/cron/backup/route.ts');

    expect(source).toContain('process.env.SAAS_BACKUP_ORG_ID');
    expect(source).toContain('SAAS_BACKUP_ORG_ID is not configured');
    expect(source).toContain('orgId: backupOrgId');
    expect(source).toContain("source: 'cron'");
    expect(source).not.toContain("createBackup(\n      ['return_management', 'shopee_returns'],\n      'auto'\n    )");
  });

  it.each([
    ['Shopee scan daily report', 'app/api/cron/shopee-scan-daily-report/route.ts'],
    ['Shopee scan smoke', 'app/api/cron/shopee-scan-smoke/route.ts'],
    ['scan retention', 'app/api/cron/scan-retention/route.ts'],
    ['AI report reconciliation', 'app/api/cron/reconcile-ai-reports/route.ts'],
  ])('gates %s maintenance cron before platform-wide service-role work', (_name, path) => {
    const source = readProjectFile(path);

    expect(source).toContain("from '@/lib/maintenance/cron-policy'");
    expect(source).toContain('isPlatformMaintenanceCronEnabled()');
    expect(source).toContain('buildPlatformMaintenanceCronSkip(');
  });
});
