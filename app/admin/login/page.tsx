import { Suspense } from 'react';

import { LoginPageContent } from '@/components/auth/login-page-content';
import { normalizeInternalNextPath } from '@/lib/auth/internal-login-redirect';
import { resolveAuthCaptchaAvailability } from '@/lib/auth/verified-signup';

export const dynamic = 'force-dynamic';

interface AdminLoginPageProps {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = normalizeInternalNextPath(firstParam(params.next));
  const captcha = resolveAuthCaptchaAvailability();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
          <div className="text-sm text-neutral-500">載入中...</div>
        </div>
      }
    >
      <LoginPageContent
        mode="platform-admin"
        requestedPath={nextPath}
        googleAuthEnabled={false}
        captchaRequired={captcha.required}
        captchaReady={captcha.ready}
        turnstileSiteKey={captcha.turnstileSiteKey}
      />
    </Suspense>
  );
}
