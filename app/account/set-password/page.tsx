import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';

import { GoogleAccountPasswordForm } from '@/components/auth/google-account-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '設定登入密碼 | AI退貨管理系統',
  description: '為已驗證的 AI退貨管理系統 Google 帳號設定信箱登入密碼。',
};

export const dynamic = 'force-dynamic';

export default async function SetAccountPasswordPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  const user = data.user;

  if (error || !user) {
    redirect('/auth/google?next=%2Faccount%2Fset-password');
  }

  if (isExplicitPlatformAdminPrincipal({
    userId: user.id,
    userEmail: user.email,
  })) {
    redirect('/internal');
  }

  const hasGoogleIdentity = Boolean(
    user.identities?.some((identity) => identity.provider === 'google') ||
    user.app_metadata?.provider === 'google' ||
    user.app_metadata?.providers?.includes('google')
  );
  if (!user.email || !user.email_confirmed_at || !hasGoogleIdentity) {
    redirect('/login?error=google_password_setup_required');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <Card className="w-full max-w-lg border-neutral-200 bg-white shadow-sm">
        <CardHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>設定信箱登入密碼</CardTitle>
          <CardDescription className="leading-6">
            Google 身分已驗證。設定完成後會登出，你之後可直接用此信箱與新密碼登入。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-5 break-all rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
            {user.email}
          </p>
          <GoogleAccountPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
