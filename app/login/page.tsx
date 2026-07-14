import { Suspense } from 'react';

import { LoginPageContent } from '@/components/auth/login-page-content';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

export default function LoginPage() {
  const featureFlags = resolveSaaSFeatureFlags({ orgPlan: 'basic' });

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
          <div className="text-sm text-neutral-500">載入中...</div>
        </div>
      }
    >
      <LoginPageContent googleAuthEnabled={featureFlags.google_auth} />
    </Suspense>
  );
}
