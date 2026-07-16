import { Suspense } from 'react';

import { LoginPageContent } from '@/components/auth/login-page-content';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { resolveAuthCaptchaAvailability } from '@/lib/auth/verified-signup';
import { resolvePasswordRecoveryAvailability } from '@/lib/auth/password-recovery';

export default function LoginPage() {
  const featureFlags = resolveSaaSFeatureFlags({ orgPlan: 'basic' });
  const captcha = resolveAuthCaptchaAvailability();
  const passwordRecovery = resolvePasswordRecoveryAvailability();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
          <div className="text-sm text-neutral-500">載入中...</div>
        </div>
      }
    >
      <LoginPageContent
        googleAuthEnabled={featureFlags.google_auth}
        passwordRecoveryEnabled={passwordRecovery.emailEnabled || passwordRecovery.phoneEnabled}
        captchaRequired={captcha.required}
        captchaReady={captcha.ready}
        turnstileSiteKey={captcha.turnstileSiteKey}
      />
    </Suspense>
  );
}
