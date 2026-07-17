import { Suspense } from 'react';

import { LoginPageContent } from '@/components/auth/login-page-content';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import {
  resolveAuthCaptchaAvailability,
  resolveVerifiedSignupAvailability,
} from '@/lib/auth/verified-signup';
import { resolvePasswordRecoveryAvailability } from '@/lib/auth/password-recovery';

// Authentication rollout flags are runtime Vercel settings. Rendering this
// page dynamically prevents a build-time snapshot from hiding an enabled
// Google login entry in Production.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const featureFlags = resolveSaaSFeatureFlags({ orgPlan: 'basic' });
  const captcha = resolveAuthCaptchaAvailability();
  const passwordRecovery = resolvePasswordRecoveryAvailability();
  const verifiedSignup = resolveVerifiedSignupAvailability();
  const googleAuthVisible = featureFlags.google_auth && featureFlags.google_auth_ui;
  const googleSignupEnabled = googleAuthVisible && featureFlags.google_trial_signup;
  const accountRegistrationEnabled = googleSignupEnabled
    || verifiedSignup.emailEnabled
    || verifiedSignup.phoneEnabled;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
          <div className="text-sm text-neutral-500">載入中...</div>
        </div>
      }
    >
      <LoginPageContent
        googleAuthEnabled={googleAuthVisible}
        googleSignupEnabled={googleSignupEnabled}
        accountRegistrationEnabled={accountRegistrationEnabled}
        passwordRecoveryEnabled={passwordRecovery.emailEnabled || passwordRecovery.phoneEnabled}
        captchaRequired={captcha.required}
        captchaReady={captcha.ready}
        turnstileSiteKey={captcha.turnstileSiteKey}
      />
    </Suspense>
  );
}
