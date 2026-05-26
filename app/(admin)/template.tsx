import type { ReactNode } from 'react';

import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PlatformAdminModeIndicator />
    </>
  );
}
