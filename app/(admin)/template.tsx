import type { ReactNode } from 'react';

import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';
import { TenantPreviewBanner } from '@/components/saas/tenant-preview-banner';
import { WorkspaceAccessBanner } from '@/components/saas/workspace-access-banner';

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <TenantPreviewBanner />
      <WorkspaceAccessBanner />
      {children}
      <PlatformAdminModeIndicator />
    </>
  );
}
