/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminClientMock, getOrgContextMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  getOrgContextMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
  createUntypedAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

vi.mock('@/lib/saas/org-context', () => ({ getOrgContext: getOrgContextMock }));

import { deleteImage } from '@/lib/actions/upload';

function buildAdminMock(row: { storage_path: string | null; image_url: string | null } | null) {
  const single = vi.fn(async () => ({ data: row, error: null }));
  const selectEqOrg = vi.fn(() => ({ single }));
  const selectEqId = vi.fn(() => ({ eq: selectEqOrg }));
  const select = vi.fn(() => ({ eq: selectEqId }));

  const deleteEqId = vi.fn(async () => ({ error: null }));
  const deleteEqOrg = vi.fn(() => ({ eq: deleteEqId }));
  const del = vi.fn(() => ({ eq: deleteEqOrg }));

  const fromTable = vi.fn(() => ({ select, delete: del }));

  const remove = vi.fn(async () => ({ data: [], error: null }));
  const storageFrom = vi.fn(() => ({ remove }));

  return {
    client: { from: fromTable, storage: { from: storageFrom } },
    remove,
    single,
  };
}

describe('deleteImage (derives storage path from the org-scoped DB row)', () => {
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

  it('removes only the path read from the org-scoped DB row', async () => {
    const mock = buildAdminMock({ storage_path: 'orgs/org-1/returns/r1/real.jpg', image_url: null });
    createAdminClientMock.mockReturnValue(mock.client);

    const result = await deleteImage('img-1');

    expect(result.success).toBe(true);
    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith(['orgs/org-1/returns/r1/real.jpg']);
  });

  it('fails closed when the image row is not found in the caller org', async () => {
    const mock = buildAdminMock(null);
    createAdminClientMock.mockReturnValue(mock.client);

    const result = await deleteImage('img-x');

    expect(result.success).toBe(false);
    expect(mock.remove).not.toHaveBeenCalled();
  });
});
