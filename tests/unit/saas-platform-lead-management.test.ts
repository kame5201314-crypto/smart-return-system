/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import type { PlatformAdminContext } from '@/lib/saas/platform-admin';
import {
  PlatformLeadManagementError,
  updatePlatformLead,
  type PlatformLeadRecord,
  type PlatformLeadRepository,
} from '@/lib/saas/platform-lead-management';

const lead: PlatformLeadRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  companyName: '測試商店',
  contactName: '王小明',
  email: 'owner@example.com',
  lineId: null,
  phone: null,
  preferredContactChannel: 'email',
  requestedPlan: 'growth',
  monthlyReturnBand: '101_300',
  message: '想測試蝦皮匯入',
  status: 'new',
  orgId: null,
  metadata: {},
  contactedAt: null,
  followUpAt: null,
  processedAt: null,
  createdAt: '2026-07-14T00:00:00.000Z',
};

function context(enabled = true): PlatformAdminContext {
  return {
    userId: '22222222-2222-4222-8222-222222222222',
    userEmail: 'owner@example.com',
    isPlatformAdmin: true,
    platformRole: 'owner',
    permissions: getPlatformAdminPermissions('owner'),
    featureFlags: resolveSaaSFeatureFlags({
      env: {
        ENABLE_MULTI_TENANT_ADMIN: 'true',
        ENABLE_PUBLIC_LEAD_CAPTURE: enabled ? 'true' : 'false',
      },
      orgPlan: 'enterprise',
    }),
  };
}

function repository(current: PlatformLeadRecord = lead): PlatformLeadRepository {
  return {
    listLeads: vi.fn(async () => [current]),
    getLead: vi.fn(async () => current),
    updateLead: vi.fn(async ({ values }) => ({
      ...current,
      status:
        values.status === 'approved' || values.status === 'rejected' || values.status === 'converted'
          ? values.status
          : 'contacted',
      contactedAt: typeof values.contacted_at === 'string' ? values.contacted_at : current.contactedAt,
      processedAt: typeof values.processed_at === 'string' ? values.processed_at : current.processedAt,
    })),
    insertAuditLog: vi.fn(async () => undefined),
  };
}

describe('platform lead management', () => {
  it('keeps lead access disabled without the independent feature flag', async () => {
    const repo = repository();
    await expect(
      updatePlatformLead({ leadId: lead.id, action: 'mark_contacted' }, context(false), repo)
    ).rejects.toMatchObject({ code: 'feature_disabled', status: 403 });
    expect(repo.getLead).not.toHaveBeenCalled();
  });

  it('marks a new lead contacted and writes an audit event', async () => {
    const repo = repository();
    const result = await updatePlatformLead(
      { leadId: lead.id, action: 'mark_contacted' },
      context(),
      repo,
      new Date('2026-07-14T08:00:00.000Z')
    );

    expect(result.status).toBe('contacted');
    expect(repo.updateLead).toHaveBeenCalledWith({
      id: lead.id,
      values: { contacted_at: '2026-07-14T08:00:00.000Z' },
    });
    expect(repo.insertAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'platform.lead.mark_contacted',
      targetId: lead.id,
    }));
  });

  it('allows conversion only after approval', async () => {
    await expect(
      updatePlatformLead({ leadId: lead.id, action: 'convert' }, context(), repository())
    ).rejects.toBeInstanceOf(PlatformLeadManagementError);

    const approved = { ...lead, status: 'approved' as const };
    const repo = repository(approved);
    await expect(
      updatePlatformLead({ leadId: lead.id, action: 'convert' }, context(), repo)
    ).resolves.toMatchObject({ status: 'converted' });
  });
});
