import { ArrowLeft, Building2, LogOut, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SelfServiceTrialForm } from '@/components/auth/self-service-trial-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signOut } from '@/lib/actions/auth';
import {
  createGoogleOAuthMembershipRepository,
  normalizeGoogleTrialPlan,
} from '@/lib/auth/google-oauth';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { requireRouteAuth } from '@/lib/auth/route-auth';
import {
  resolveVerifiedSignupAvailability,
  selectEnabledVerifiedSignupProvider,
} from '@/lib/auth/verified-signup';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SignupCompletePageProps {
  searchParams?: Promise<{ plan?: string | string[] }>;
}

function metadataText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function SignupCompletePage({ searchParams }: SignupCompletePageProps) {
  const params = await searchParams;
  const auth = await requireRouteAuth();
  if (!auth.ok || !auth.userId) {
    redirect('/login?next=/signup/complete');
  }

  if (isExplicitPlatformAdminPrincipal({
    userId: auth.userId,
    userEmail: auth.userEmail,
  })) {
    redirect('/internal');
  }

  const client = await createClient();
  const { data: currentAuth } = await client.auth.getUser();
  const repository = createGoogleOAuthMembershipRepository(
    client as unknown as Parameters<typeof createGoogleOAuthMembershipRepository>[0]
  );
  const memberships = await repository.listMemberships(auth.userId);
  if (memberships.some((membership) => membership.status !== 'disabled')) {
    redirect('/analytics');
  }

  const membershipDisabled = memberships.length > 0;
  const featureFlags = resolveSaaSFeatureFlags({ orgPlan: 'basic' });
  const verifiedSignup = resolveVerifiedSignupAvailability();
  const currentUser = currentAuth.user;
  const hasGoogleIdentity = Boolean(
    currentUser?.identities?.some((identity) => identity.provider === 'google')
  );
  const hasEmailIdentity = Boolean(
    currentUser?.identities?.some((identity) => identity.provider === 'email')
  );
  const hasPhoneIdentity = Boolean(
    currentUser?.identities?.some((identity) => identity.provider === 'phone')
  );
  const identityProvider = selectEnabledVerifiedSignupProvider({
    signupChannel: currentUser?.user_metadata?.signup_channel,
    hasGoogleIdentity,
    hasEmailIdentity,
    hasPhoneIdentity,
    emailVerified: Boolean(currentUser?.email && currentUser.email_confirmed_at),
    phoneVerified: Boolean(currentUser?.phone && currentUser.phone_confirmed_at),
    googleEnabled: featureFlags.google_auth && featureFlags.google_trial_signup,
    emailEnabled: verifiedSignup.emailEnabled,
    phoneEnabled: verifiedSignup.phoneEnabled,
  });
  const selfServiceEnabled = Boolean(identityProvider);
  const identityLabel = currentUser?.email || currentUser?.phone || '已驗證帳號';
  const verifiedEmail = currentUser?.email && currentUser.email_confirmed_at
    ? currentUser.email
    : null;
  const verifiedPhone = currentUser?.phone && currentUser.phone_confirmed_at
    ? currentUser.phone
    : null;
  const initialContactName = metadataText(
    currentUser?.user_metadata?.full_name
      ?? currentUser?.user_metadata?.name
      ?? currentUser?.user_metadata?.display_name
  );
  const initialReferralCode = metadataText(currentUser?.user_metadata?.referral_code);
  const planParam = Array.isArray(params?.plan) ? params?.plan[0] : params?.plan;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <Card className="w-full max-w-2xl border-neutral-200 bg-white shadow-sm">
        <CardHeader className="space-y-2 sm:px-8 sm:pt-8">
          <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            {membershipDisabled ? (
              <ShieldAlert className="size-5" aria-hidden="true" />
            ) : (
              <Building2 className="size-5" aria-hidden="true" />
            )}
          </div>
          {!membershipDisabled && selfServiceEnabled ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              帳號設定 · 最後一步
            </p>
          ) : null}
          <CardTitle className="text-2xl">
            {membershipDisabled
              ? '這個商家工作區已停用'
              : selfServiceEnabled
                ? '帳號註冊成功'
                : '帳號驗證完成'}
          </CardTitle>
          <CardDescription className="leading-6">
            {membershipDisabled
              ? '你的帳號目前沒有可使用的商家工作區。請聯絡原商家管理員或 Smart Return 客服確認權限。'
              : selfServiceEnabled
                ? '信箱或手機驗證已完成。請補齊聯絡與營運資料，完成後會建立 3 天免費試用工作區。'
                : '這個帳號尚未加入商家工作區。現階段可先送出試用申請，我們會協助開通。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="sm:px-8 sm:pb-8">
          {!membershipDisabled && identityProvider ? (
            <SelfServiceTrialForm
              identityLabel={identityLabel}
              identityProvider={identityProvider}
              verifiedEmail={verifiedEmail}
              verifiedPhone={verifiedPhone}
              initialContactName={initialContactName}
              initialReferralCode={initialReferralCode}
              initialPlan={normalizeGoogleTrialPlan(planParam)}
            />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              {!membershipDisabled && (
                <Button asChild className="sm:flex-1">
                  <Link href="/signup">申請 3 天免費試用</Link>
                </Button>
              )}
              <form action={signOut} className="sm:flex-1">
                <Button type="submit" variant="outline" className="w-full">
                  <LogOut className="size-4" aria-hidden="true" />
                  登出並切換帳號
                </Button>
              </form>
            </div>
          )}
        </CardContent>
        <div className="border-t border-neutral-200 px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回首頁
          </Link>
        </div>
      </Card>
    </main>
  );
}
