import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, PackageCheck } from 'lucide-react';

import { VerifiedSignupForm } from '@/components/auth/verified-signup-form';
import { GoogleSignInIcon } from '@/components/auth/google-sign-in-icon';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  normalizeEmailIdentifier,
  normalizeTaiwanPhoneIdentifier,
  resolveVerifiedSignupAvailability,
  type VerifiedSignupChannel,
} from '@/lib/auth/verified-signup';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

export const metadata: Metadata = {
  title: '註冊新帳號 | Smart Return',
  description:
    '註冊 Smart Return 帳號並開始 3 天免費試用。不需信用卡，也不會自動扣款。',
};

interface SignupPageProps {
  searchParams?: Promise<{
    plan?: string | string[];
    verify?: string | string[];
    identifier?: string | string[];
  }>;
}

interface InitialVerification {
  channel: VerifiedSignupChannel;
  identifier: string;
}

function resolveInitialPlan(value: string | string[] | undefined): SaaSPlanCode {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan === 'growth' || plan === 'enterprise' ? plan : 'basic';
}

function resolveInitialVerification(
  params: Awaited<SignupPageProps['searchParams']>,
  availability: { emailEnabled: boolean; phoneEnabled: boolean }
): InitialVerification | undefined {
  const verify = Array.isArray(params?.verify) ? params?.verify[0] : params?.verify;
  const identifierValue = Array.isArray(params?.identifier)
    ? params?.identifier[0]
    : params?.identifier;
  if (!identifierValue) return undefined;

  try {
    if (verify === 'email' && availability.emailEnabled) {
      return { channel: 'email', identifier: normalizeEmailIdentifier(identifierValue) };
    }
    if (verify === 'phone' && availability.phoneEnabled) {
      return { channel: 'phone', identifier: normalizeTaiwanPhoneIdentifier(identifierValue) };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const initialPlan = resolveInitialPlan(params?.plan);
  const verifiedSignup = resolveVerifiedSignupAvailability();
  const initialVerification = resolveInitialVerification(params, verifiedSignup);
  const featureFlags = resolveSaaSFeatureFlags({ orgPlan: initialPlan });
  const googleSignupEnabled = featureFlags.google_auth
    && featureFlags.google_auth_ui
    && featureFlags.google_trial_signup;
  const googleSignupHref = `/auth/google?next=%2Fanalytics&plan=${initialPlan}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10 sm:py-14">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-emerald-100 transition-colors hover:bg-emerald-200"
            aria-label="返回首頁"
          >
            <PackageCheck className="size-8 text-emerald-700" aria-hidden="true" />
          </Link>
          <p className="text-2xl font-bold text-neutral-950">Smart Return</p>
          <p className="mt-2 text-neutral-500">建立你的退貨工作區</p>
        </div>

        <Card className="border-neutral-200 bg-white shadow-lg" data-testid="signup-card">
          <CardHeader className="pb-5 sm:px-10 sm:pt-10">
            <CardTitle className="text-3xl font-medium tracking-tight">
              <h1>{initialVerification ? '完成帳號驗證' : '建立帳號'}</h1>
            </CardTitle>
          </CardHeader>

          <CardContent className="sm:px-10 sm:pb-10">
            {googleSignupEnabled && !initialVerification ? (
              <div className="mb-7" data-testid="google-signup-entry">
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full border-neutral-200 bg-white text-base text-neutral-900 shadow-sm hover:bg-neutral-50"
                >
                  <Link href={googleSignupHref}>
                    <GoogleSignInIcon className="size-5" />
                    使用 Google 快速註冊
                  </Link>
                </Button>
                <p className="mt-2 text-center text-sm leading-6 text-neutral-500">
                  使用 Google 驗證後完成商家資料，立即開始 3 天免費試用。
                </p>
                <div className="mt-5 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <span className="text-xs text-neutral-400">或使用手機／信箱與密碼註冊</span>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>
              </div>
            ) : null}
            <VerifiedSignupForm
              emailEnabled={verifiedSignup.emailEnabled}
              phoneEnabled={verifiedSignup.phoneEnabled}
              showEmailWhenUnavailable
              initialVerification={initialVerification}
              initialPlan={initialPlan}
              turnstileSiteKey={verifiedSignup.turnstileSiteKey}
            />
          </CardContent>
        </Card>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回首頁
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} Smart Return. All rights reserved.
        </p>
      </div>
    </main>
  );
}
