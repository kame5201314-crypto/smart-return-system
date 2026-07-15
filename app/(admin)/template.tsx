import type { ReactNode } from 'react';

import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';
import { TenantPreviewBanner } from '@/components/saas/tenant-preview-banner';
import { WorkspaceAccessBanner } from '@/components/saas/workspace-access-banner';
import { WorkspaceAccessProvider } from '@/components/saas/workspace-access-provider';
import { getOrgContext } from '@/lib/saas/org-context';
import {
  buildWorkspaceActionAccess,
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
  const access = await loadWorkspaceActionAccess();

  return (
    <>
      <TenantPreviewBanner />
      <WorkspaceAccessBanner />
      <WorkspaceAccessProvider access={access}>{children}</WorkspaceAccessProvider>
      <PlatformAdminModeIndicator />
    </>
  );
}
