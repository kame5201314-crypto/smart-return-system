import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { KeyRound } from 'lucide-react';

import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PASSWORD_RECOVERY_SESSION_COOKIE,
  verifyPasswordRecoverySessionToken,
} from '@/lib/auth/password-recovery-session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '設定新密碼 | AI退貨管理系統',
  description: '為 AI退貨管理系統 帳號設定新的登入密碼。',
};

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  const cookieStore = await cookies();
  const proof = await verifyPasswordRecoverySessionToken(
    cookieStore.get(PASSWORD_RECOVERY_SESSION_COOKIE)?.value
  );
  if (error || !data.user || !proof || proof.sub !== data.user.id) {
    redirect('/forgot-password');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <Card className="w-full max-w-lg border-neutral-200 bg-white shadow-sm">
        <CardHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>設定新密碼</CardTitle>
          <CardDescription className="leading-6">
            身分驗證已完成。更新後會登出所有裝置，請使用新密碼重新登入。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
