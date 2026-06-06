import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock, getOrgContextMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
  getOrgContextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

vi.mock('@/lib/saas/org-context', () => ({
  getOrgContext: getOrgContextMock,
}));

import { updateShopeeReturnStatus } from '@/lib/actions/shopee-returns.actions';

function buildMockClient() {
  const updateSecondEqMock = vi.fn().mockResolvedValue({ error: null });
  const updateEqMock = vi.fn().mockReturnValue({ eq: updateSecondEqMock });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

  const selectSingleMock = vi.fn().mockResolvedValue({
    data: {
      is_scanned: false,
      scanned_at: null,
      is_inbound: false,
      inbound_at: null,
    },
    error: null,
  });
  const selectSecondEqMock = vi.fn().mockReturnValue({ single: selectSingleMock });
  const selectEqMock = vi.fn().mockReturnValue({ eq: selectSecondEqMock });
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock });

  const fromMock = vi.fn().mockReturnValue({
    select: selectMock,
    update: updateMock,
  });

  return {
    client: { from: fromMock },
    fromMock,
    selectMock,
    selectEqMock,
    selectSecondEqMock,
    selectSingleMock,
    updateMock,
    updateEqMock,
    updateSecondEqMock,
  };
}

describe('shopee status separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgContextMock.mockResolvedValue({
      userId: 'user-1',
      orgId: 'org-1',
      orgName: 'Test Org',
      orgSlug: 'test-org',
      orgStatus: 'trialing',
      role: 'owner',
      plan: 'growth',
      planDefinition: {},
      featureFlags: {},
      isPlatformAdmin: false,
    });
  });

  it('updating inbound status does not mutate scan fields', async () => {
    const mock = buildMockClient();
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await updateShopeeReturnStatus('row-1', { is_inbound: true });

    expect(result.success).toBe(true);
    expect(mock.selectMock).toHaveBeenCalledTimes(2);
    expect(mock.updateMock).toHaveBeenCalledTimes(2);

    const inboundPayload = mock.updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inboundPayload.is_inbound).toBe(true);
    expect(inboundPayload).toHaveProperty('inbound_at');
    expect(inboundPayload).not.toHaveProperty('is_scanned');
    expect(inboundPayload).not.toHaveProperty('scanned_at');

    const restoreScanPayload = mock.updateMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(restoreScanPayload.is_scanned).toBe(false);
    expect(restoreScanPayload.scanned_at).toBeNull();
  });

  it('updating scan status does not mutate inbound fields', async () => {
    const mock = buildMockClient();
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await updateShopeeReturnStatus('row-2', { is_scanned: true });

    expect(result.success).toBe(true);
    expect(mock.selectMock).toHaveBeenCalledTimes(2);
    expect(mock.updateMock).toHaveBeenCalledTimes(2);

    const scanPayload = mock.updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(scanPayload.is_scanned).toBe(true);
    expect(scanPayload).toHaveProperty('scanned_at');
    expect(scanPayload).not.toHaveProperty('is_inbound');
    expect(scanPayload).not.toHaveProperty('inbound_at');

    const restoreInboundPayload = mock.updateMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(restoreInboundPayload.is_inbound).toBe(false);
    expect(restoreInboundPayload.inbound_at).toBeNull();
  });

  it('rejects mixed scan and inbound updates in one request', async () => {
    const mock = buildMockClient();
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await updateShopeeReturnStatus('row-3', {
      is_scanned: true,
      is_inbound: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('分開操作');
    expect(mock.updateMock).not.toHaveBeenCalled();
  });
});
