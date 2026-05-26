import type { ReactNode } from 'react';

import { OnboardingProgressBanner } from '@/components/saas/onboarding-progress-banner';
import { PlatformAdminModeIndicator } from '@/components/saas/platform-admin-mode-indicator';

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      <OnboardingProgressBanner />
      {children}
      <PlatformAdminModeIndicator />
    </>
  );
}
