import type { ReactNode } from 'react';

import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';
import { TenantPreviewBanner } from '@/components/saas/tenant-preview-banner';

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <TenantPreviewBanner />
      {children}
      <PlatformAdminModeIndicator />
    </>
  );
}
