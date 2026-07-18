import type { ReactNode } from 'react';

import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';
import { TenantPreviewBanner } from '@/components/saas/tenant-preview-banner';
import { WorkspaceAccessBanner } from '@/components/saas/workspace-access-banner';
import { WorkspaceAccessProvider } from '@/components/saas/workspace-access-provider';
import { requireRouteAuth } from '@/lib/auth/route-auth';
import { getOrgContext } from '@/lib/saas/org-context';
import { loadPlatformTenantPreviewMode } from '@/lib/saas/platform-tenant-preview';
import {
  buildWorkspaceActionAccess,
  enforceWorkspaceReadOnly,
  type WorkspaceActionAccess,
} from '@/lib/saas/workspace-action-access';
import { resolveWorkspaceActionAccess } from '@/lib/saas/workspace-action-access-fallback';

async function loadWorkspaceActionAccess(): Promise<WorkspaceActionAccess> {
  return resolveWorkspaceActionAccess({
    loadTenantAccess: async () => {
      const context = await getOrgContext();
      return buildWorkspaceActionAccess(context.orgStatus);
    },
    verifyPlatformAdmin: async () => {
      const auth = await requireRouteAuth({ requireAdmin: true });
      return auth.ok && auth.isAdmin;
    },
  });
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
