import type { ReactNode } from 'react';

import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';
import { TenantPreviewBanner } from '@/components/saas/tenant-preview-banner';
import { WorkspaceAccessBanner } from '@/components/saas/workspace-access-banner';
import { WorkspaceAccessProvider } from '@/components/saas/workspace-access-provider';
import { getOrgContext } from '@/lib/saas/org-context';
import { loadPlatformTenantPreviewMode } from '@/lib/saas/platform-tenant-preview';
import {
  buildWorkspaceActionAccess,
  enforceWorkspaceReadOnly,
  UNRESTRICTED_WORKSPACE_ACTION_ACCESS,
  type WorkspaceActionAccess,
} from '@/lib/saas/workspace-action-access';

async function loadWorkspaceActionAccess(): Promise<WorkspaceActionAccess> {
  try {
    const context = await getOrgContext();
    return buildWorkspaceActionAccess(context.orgStatus);
  } catch {
    return UNRESTRICTED_WORKSPACE_ACTION_ACCESS;
  }
}

export default async function AdminTemplate({ children }: { children: ReactNode }) {
  const [baseAccess, previewMode] = await Promise.all([
    loadWorkspaceActionAccess(),
    loadPlatformTenantPreviewMode(),
  ]);
  const access =
    previewMode.state === 'ready' ? enforceWorkspaceReadOnly(baseAccess) : baseAccess;

  return (
    <>
      <TenantPreviewBanner mode={previewMode} />
      <WorkspaceAccessBanner />
      <WorkspaceAccessProvider access={access}>{children}</WorkspaceAccessProvider>
      <PlatformAdminModeIndicator />
    </>
  );
}
