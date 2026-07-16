import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, LogIn, PackageCheck } from 'lucide-react';

import { VerifiedSignupForm } from '@/components/auth/verified-signup-form';
import { LeadCaptureForm } from '@/components/marketing/lead-capture-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { resolveSignupMethodLabel } from '@/lib/auth/signup-presentation';
import { resolveVerifiedSignupAvailability } from '@/lib/auth/verified-signup';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';
import { resolveSaaSPublicSignupState } from '@/lib/saas/public-signup';

export const metadata: Metadata = {
  title: '註冊新帳號 | Smart Return',
  description:
    '註冊 Smart Return 帳號並開始 3 天免費試用。不需信用卡，也不會自動扣款。',
};

interface SignupPageProps {
  searchParams?: Promise<{ plan?: string | string[] }>;
}

function resolveInitialPlan(value: string | string[] | undefined): SaaSPlanCode {
  const plan = Array.isArray(value) ? value[0] : value;
  return plan === 'growth' || plan === 'enterprise' ? plan : 'basic';
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const signupState = resolveSaaSPublicSignupState();
  const featureFlags = resolveSaaSFeatureFlags({ orgPlan: 'basic' });
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@smart-return.tw';
  const lineOaId = process.env.NEXT_PUBLIC_LINE_OA_ID;
  const initialPlan = resolveInitialPlan(params?.plan);
  const googleTrialEnabled = featureFlags.google_auth && featureFlags.google_trial_signup;
  const verifiedSignup = resolveVerifiedSignupAvailability();
  const verifiedSignupEnabled = verifiedSignup.emailEnabled || verifiedSignup.phoneEnabled;
  const selfServiceEnabled = googleTrialEnabled || verifiedSignupEnabled;
  const signupMethodLabel = resolveSignupMethodLabel({
    googleEnabled: googleTrialEnabled,
    emailEnabled: verifiedSignup.emailEnabled,
    phoneEnabled: verifiedSignup.phoneEnabled,
  });
  const googleTrialPlan = initialPlan === 'growth' ? 'growth' : 'basic';

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 py-10 sm:py-14">
      <div className="w-full max-w-md">
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

        <Card className="border bg-white shadow-lg" data-testid="signup-card">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              <h1>建立帳號</h1>
            </CardTitle>
            <CardDescription className="leading-6">
              {selfServiceEnabled
                ? `使用 ${signupMethodLabel} 完成註冊，立即開始 3 天免費試用。`
                : signupState.description}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {googleTrialEnabled ? (
              <>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/auth/google?plan=${googleTrialPlan}`}>
                    <LogIn className="size-4" aria-hidden="true" />
                    使用 Google 註冊或登入
                  </Link>
                </Button>
                <p className="mt-2 text-center text-xs leading-5 text-neutral-500">
                  3 天免費、不需信用卡、不會自動扣款
                </p>
              </>
            ) : null}

            {googleTrialEnabled && verifiedSignupEnabled ? (
              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs text-neutral-400">或使用手機／信箱驗證碼</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>
            ) : null}

            {verifiedSignupEnabled ? (
              <VerifiedSignupForm
                emailEnabled={verifiedSignup.emailEnabled}
                phoneEnabled={verifiedSignup.phoneEnabled}
                initialPlan={initialPlan}
                turnstileSiteKey={verifiedSignup.turnstileSiteKey}
              />
            ) : null}

            {selfServiceEnabled ? (
              <>
                <p className="mt-6 text-center text-sm text-neutral-600">
                  已有帳號？
                  <Link
                    href="/login"
                    className="ml-1 font-medium text-emerald-700 underline-offset-2 hover:underline"
                  >
                    返回登入
                  </Link>
                </p>

                <details
                  className="mt-5 border-t border-neutral-200 pt-5"
                  data-testid="signup-support-details"
                >
                  <summary className="cursor-pointer text-center text-sm font-medium text-neutral-600 hover:text-neutral-950">
                    需要專人協助？
                  </summary>
                  <div className="mt-5 rounded-lg bg-neutral-50 p-4">
                    <p className="mb-4 text-sm leading-6 text-neutral-600">
                      若需要資料匯入或流程評估，留下資訊後將由專人聯絡。
                    </p>
                    <LeadCaptureForm
                      variant="signup"
                      contactEmail={contactEmail}
                      initialPlan={initialPlan}
                      leadCaptureEnabled={featureFlags.public_lead_capture}
                      lineOaId={lineOaId}
                    />
                  </div>
                </details>
              </>
            ) : (
              <LeadCaptureForm
                variant="signup"
                contactEmail={contactEmail}
                initialPlan={initialPlan}
                leadCaptureEnabled={featureFlags.public_lead_capture}
                lineOaId={lineOaId}
              />
            )}
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
