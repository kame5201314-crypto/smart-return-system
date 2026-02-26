import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

import { updateShopeeReturnStatus } from '@/lib/actions/shopee-returns.actions';

function buildMockClient() {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockReturnValue({ update: updateMock });

  return {
    client: { from: fromMock },
    fromMock,
    updateMock,
    eqMock,
  };
}

describe('shopee status separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updating inbound status does not mutate scan fields', async () => {
    const mock = buildMockClient();
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await updateShopeeReturnStatus('row-1', { is_inbound: true });

    expect(result.success).toBe(true);
    expect(mock.updateMock).toHaveBeenCalledTimes(1);

    const payload = mock.updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.is_inbound).toBe(true);
    expect(payload).toHaveProperty('inbound_at');
    expect(payload).not.toHaveProperty('is_scanned');
    expect(payload).not.toHaveProperty('scanned_at');
  });

  it('updating scan status does not mutate inbound fields', async () => {
    const mock = buildMockClient();
    createUntypedAdminClientMock.mockReturnValue(mock.client);

    const result = await updateShopeeReturnStatus('row-2', { is_scanned: true });

    expect(result.success).toBe(true);
    expect(mock.updateMock).toHaveBeenCalledTimes(1);

    const payload = mock.updateMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.is_scanned).toBe(true);
    expect(payload).toHaveProperty('scanned_at');
    expect(payload).not.toHaveProperty('is_inbound');
    expect(payload).not.toHaveProperty('inbound_at');
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
