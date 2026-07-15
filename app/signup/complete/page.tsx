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
  const selfServiceEnabled = Boolean(selectEnabledVerifiedSignupProvider({
    signupChannel: currentUser?.user_metadata?.signup_channel,
    hasGoogleIdentity,
    hasEmailIdentity,
    hasPhoneIdentity,
    emailVerified: Boolean(currentUser?.email && currentUser.email_confirmed_at),
    phoneVerified: Boolean(currentUser?.phone && currentUser.phone_confirmed_at),
    googleEnabled: featureFlags.google_auth && featureFlags.google_trial_signup,
    emailEnabled: verifiedSignup.emailEnabled,
    phoneEnabled: verifiedSignup.phoneEnabled,
  }));
  const identityLabel = currentUser?.email || currentUser?.phone || '已驗證帳號';
  const planParam = Array.isArray(params?.plan) ? params?.plan[0] : params?.plan;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <Card className="w-full max-w-2xl border-neutral-200 bg-white shadow-sm">
        <CardHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            {membershipDisabled ? (
              <ShieldAlert className="size-5" aria-hidden="true" />
            ) : (
              <Building2 className="size-5" aria-hidden="true" />
            )}
          </div>
          <CardTitle>
            {membershipDisabled
              ? '這個商家工作區已停用'
              : selfServiceEnabled
                ? '設定你的試用工作區'
                : '帳號驗證完成'}
          </CardTitle>
          <CardDescription className="leading-6">
            {membershipDisabled
              ? '你的帳號目前沒有可使用的商家工作區。請聯絡原商家管理員或 Smart Return 客服確認權限。'
              : selfServiceEnabled
                ? '確認品牌名稱與方案後，即可建立 3 天免費試用。試用不需信用卡，也不會自動扣款。'
                : '這個帳號尚未加入商家工作區。現階段可先送出試用申請，我們會協助開通。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!membershipDisabled && selfServiceEnabled ? (
            <SelfServiceTrialForm
              identityLabel={identityLabel}
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
