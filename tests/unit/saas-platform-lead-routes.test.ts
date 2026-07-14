/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleListPlatformLeads } from '@/app/api/internal/saas/leads/route';
import { handleUpdatePlatformLead } from '@/app/api/internal/saas/leads/[id]/route';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import type { PlatformAdminContext } from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import type { PlatformLeadRecord, PlatformLeadRepository } from '@/lib/saas/platform-lead-management';

const lead: PlatformLeadRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  companyName: '測試商店', contactName: '王小明', email: 'owner@example.com',
  lineId: null, phone: null, preferredContactChannel: 'email', requestedPlan: 'basic',
  monthlyReturnBand: '30_100', message: null, status: 'new', orgId: null, metadata: {},
  contactedAt: null, followUpAt: null, processedAt: null,
  createdAt: '2026-07-14T00:00:00.000Z',
};

function access(enabled: boolean): PlatformAdminContext {
  return {
    userId: '22222222-2222-4222-8222-222222222222',
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

function repo(): PlatformLeadRepository {
  return {
    listLeads: vi.fn(async () => [lead]),
    getLead: vi.fn(async () => lead),
    updateLead: vi.fn(async () => ({
      ...lead,
      status: 'contacted' as const,
      contactedAt: '2026-07-14T08:00:00.000Z',
    })),
    insertAuditLog: vi.fn(async () => undefined),
  };
}

describe('platform lead routes', () => {
  it('does not query leads when the lead flag is closed', async () => {
    const repository = repo();
    const response = await handleListPlatformLeads(
      new NextRequest('http://localhost/api/internal/saas/leads'),
      { requireAccess: async () => access(false), repository }
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'feature_disabled' });
    expect(repository.listLeads).not.toHaveBeenCalled();
  });

  it('lists leads only after platform access and the independent flag pass', async () => {
    const repository = repo();
    const response = await handleListPlatformLeads(
      new NextRequest('http://localhost/api/internal/saas/leads'),
      { requireAccess: async () => access(true), repository }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { leads: [{ id: lead.id }] } });
  });

  it('updates a lead through the platform mutation route', async () => {
    const repository = repo();
    const request = new NextRequest(`http://localhost/api/internal/saas/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark_contacted' }),
    });
    const response = await handleUpdatePlatformLead(
      request,
      { params: Promise.resolve({ id: lead.id }) },
      { requireAccess: async () => access(true), repository }
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { lead: { status: 'contacted' } } });
  });
});
