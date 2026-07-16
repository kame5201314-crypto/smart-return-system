import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, KeyRound, LifeBuoy } from 'lucide-react';

import { PasswordRecoveryForm } from '@/components/auth/password-recovery-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resolvePasswordRecoveryAvailability } from '@/lib/auth/password-recovery';

export const metadata: Metadata = {
  title: '復原帳號 | Smart Return',
  description: '使用已驗證的電子信箱或手機號碼復原 Smart Return 帳號。',
};

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const recovery = resolvePasswordRecoveryAvailability();
  const enabled = recovery.emailEnabled || recovery.phoneEnabled;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <Card className="border-neutral-200 bg-white shadow-sm">
          <CardHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>復原帳號</CardTitle>
            <CardDescription className="leading-6">
              {enabled
                ? '輸入已驗證的電子信箱或手機號碼，我們會傳送一次性驗證碼。'
                : '帳號復原目前尚未開放，請聯絡 Smart Return 客服協助處理。'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enabled ? (
              <PasswordRecoveryForm
                emailEnabled={recovery.emailEnabled}
                phoneEnabled={recovery.phoneEnabled}
                turnstileSiteKey={recovery.turnstileSiteKey}
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <LifeBuoy className="mb-2 size-5 text-amber-700" aria-hidden="true" />
                  為保護帳號安全，我們會先確認你的身分，再協助重新設定密碼。
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/contact">聯絡客服</Link>
                </Button>
                <p className="text-center text-sm text-neutral-600">
                  想起密碼了？
                  <Link href="/login" className="ml-1 font-medium text-emerald-700 hover:underline">
                    返回登入
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回首頁
          </Link>
        </p>
      </div>
    </main>
  );
}
