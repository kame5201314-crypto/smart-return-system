import type { ReactNode } from 'react';

import { OnboardingProgressBanner } from '@/components/saas/onboarding-progress-banner';
import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';
import { TenantPreviewBanner } from '@/components/saas/tenant-preview-banner';

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <TenantPreviewBanner />
      <OnboardingProgressBanner />
      {children}
      <PlatformAdminModeIndicator />
    </>
  );
}
