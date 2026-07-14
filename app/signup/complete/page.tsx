import { ArrowLeft, Building2, LogOut, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signOut } from '@/lib/actions/auth';
import { createGoogleOAuthMembershipRepository } from '@/lib/auth/google-oauth';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { requireRouteAuth } from '@/lib/auth/route-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SignupCompletePage() {
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
  const repository = createGoogleOAuthMembershipRepository(
    client as unknown as Parameters<typeof createGoogleOAuthMembershipRepository>[0]
  );
  const memberships = await repository.listMemberships(auth.userId);
  if (memberships.some((membership) => membership.status !== 'disabled')) {
    redirect('/analytics');
  }

  const membershipDisabled = memberships.length > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <Card className="w-full max-w-xl border-neutral-200 bg-white shadow-sm">
        <CardHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            {membershipDisabled ? (
              <ShieldAlert className="size-5" aria-hidden="true" />
            ) : (
              <Building2 className="size-5" aria-hidden="true" />
            )}
          </div>
          <CardTitle>
            {membershipDisabled ? '這個商家工作區已停用' : 'Google 登入完成'}
          </CardTitle>
          <CardDescription className="leading-6">
            {membershipDisabled
              ? '你的帳號目前沒有可使用的商家工作區。請聯絡原商家管理員或 Smart Return 客服確認權限。'
              : '這個 Google 帳號尚未加入商家工作區。現階段可先送出試用申請，我們會協助開通。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          {!membershipDisabled && (
            <Button asChild className="sm:flex-1">
              <Link href="/signup">申請 14 天免費試用</Link>
            </Button>
          )}
          <form action={signOut} className="sm:flex-1">
            <Button type="submit" variant="outline" className="w-full">
              <LogOut className="size-4" aria-hidden="true" />
              登出並切換帳號
            </Button>
          </form>
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
