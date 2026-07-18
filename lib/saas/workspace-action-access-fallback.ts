import {
  enforceWorkspaceReadOnly,
  UNRESTRICTED_WORKSPACE_ACTION_ACCESS,
  type WorkspaceActionAccess,
} from '@/lib/saas/workspace-action-access';

export interface ResolveWorkspaceActionAccessOptions {
  loadTenantAccess: () => Promise<WorkspaceActionAccess>;
  verifyPlatformAdmin: () => Promise<boolean>;
}

export async function resolveWorkspaceActionAccess(
  options: ResolveWorkspaceActionAccessOptions
): Promise<WorkspaceActionAccess> {
  try {
    return await options.loadTenantAccess();
  } catch {
    try {
      if (await options.verifyPlatformAdmin()) {
        return UNRESTRICTED_WORKSPACE_ACTION_ACCESS;
      }
    } catch {
      // Authentication lookup failures must not make tenant actions available.
    }

    return enforceWorkspaceReadOnly(UNRESTRICTED_WORKSPACE_ACTION_ACCESS);
  }
}
