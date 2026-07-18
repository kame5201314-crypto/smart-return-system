import { describe, expect, it, vi } from 'vitest';
import { resolveWorkspaceActionAccess } from '@/lib/saas/workspace-action-access-fallback';
import {
  buildWorkspaceActionAccess,
  UNRESTRICTED_WORKSPACE_ACTION_ACCESS,
} from '@/lib/saas/workspace-action-access';

describe('workspace action access fallback', () => {
  it('uses tenant access without consulting platform admin auth', async () => {
    const verifyPlatformAdmin = vi.fn().mockResolvedValue(true);
    await expect(resolveWorkspaceActionAccess({
      loadTenantAccess: vi.fn().mockResolvedValue(buildWorkspaceActionAccess('suspended')),
      verifyPlatformAdmin,
    })).resolves.toMatchObject({
      status: 'suspended',
      canCreateData: false,
      canUseAI: false,
      canExport: false,
      isReadOnly: true,
    });
    expect(verifyPlatformAdmin).not.toHaveBeenCalled();
  });

  it('keeps the fallback unrestricted for a verified platform admin', async () => {
    await expect(resolveWorkspaceActionAccess({
      loadTenantAccess: vi.fn().mockRejectedValue(new Error('membership required')),
      verifyPlatformAdmin: vi.fn().mockResolvedValue(true),
    })).resolves.toEqual(UNRESTRICTED_WORKSPACE_ACTION_ACCESS);
  });

  it('fails closed for merchant context or admin verification errors', async () => {
    for (const verifyPlatformAdmin of [
      vi.fn().mockResolvedValue(false),
      vi.fn().mockRejectedValue(new Error('auth unavailable')),
    ]) {
      await expect(resolveWorkspaceActionAccess({
        loadTenantAccess: vi.fn().mockRejectedValue(new Error('lookup failed')),
        verifyPlatformAdmin,
      })).resolves.toEqual({
        status: null,
        canCreateData: false,
        canUseAI: false,
        canExport: false,
        isReadOnly: true,
      });
    }
  });
});
