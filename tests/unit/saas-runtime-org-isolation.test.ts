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
    // Tenant is bound by the portal org slug (resolved server-side), not by a
    // cross-tenant global order search.
    expect(source).toContain('resolvePortalOrg(orgSlug)');
    expect(source).toContain('const orgId = portalOrg.orgId');
    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain('org_id: orgId');
    expect(source).toContain('returns/${orgId}/${returnRequest.id}');
    expect(source).not.toContain('.insert({\n          order_number: formData.orderNumber');
    // Customer-submitted images must not persist a permanent public URL into
    // image_url (P0-3). The write path stores a short-lived signed URL and keeps
    // storage_path as the read source-of-truth, so reads re-sign and the bucket
    // can be made private.
    expect(source).toContain('createReturnImageSignedUrl(');
    expect(source).not.toContain('getPublicUrl');
    expect(source).toContain('storage_path: img.storagePath');
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

  it('binds upload sessions to a tenant and rejects unbound tokens', () => {
    const securitySource = readProjectFile('lib/upload/security.ts');
    const signedUrlSource = readProjectFile('app/api/v1/upload/signed-url/route.ts');
    const sessionSource = readProjectFile('app/api/v1/upload/session/route.ts');

    expect(securitySource).toContain('orgId?: string');
    expect(securitySource).toContain("...(input.orgId ? { orgId: input.orgId } : {})");

    // The session route binds the token to a slug-resolved tenant, failing
    // closed for a missing/unknown store.
    expect(sessionSource).toContain('resolvePortalOrg(body.orgSlug)');
    expect(sessionSource).toContain("code: 'INVALID_STORE'");
    expect(sessionSource).toContain('createUploadSessionToken({ draftId, orgId: org.orgId })');

    // The signed-url route requires an org-bound token (no getOrgContext
    // fallback) and only ever writes to an org-scoped staging path.
    expect(signedUrlSource).not.toContain("from '@/lib/saas/org-context'");
    expect(signedUrlSource).toContain('sessionVerification.payload.orgId');
    expect(signedUrlSource).toContain("code: 'MISSING_ORG'");
    expect(signedUrlSource).toContain('staging/${orgId}/${draftId}');
    expect(signedUrlSource).not.toContain('staging/${draftId}');
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
