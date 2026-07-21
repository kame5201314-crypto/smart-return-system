import Link from 'next/link';
import {
  LogOut,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformAdminDashboardContent } from '@/components/internal/platform-admin-dashboard-content';
import { getCurrentUser, signOut } from '@/lib/actions/auth';
import { loadPlatformAdminDashboardView } from '@/lib/saas/platform-admin-live-data';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function GatedView({
  message,
  accessCode,
  currentEmail,
}: {
  message: string;
  accessCode: string;
  currentEmail: string | null;
}) {
  const isAuthIssue = accessCode === 'unauthenticated';
  const title = isAuthIssue ? '需要登入' : '沒有平台管理權限';
  const description = isAuthIssue
    ? '請使用平台管理員帳號登入後再嘗試。'
    : '你目前的帳號沒有平台管理權限。請使用平台管理員帳號登入，或返回工作台。';

  return (
    <Card className="rounded-lg border-amber-200 bg-amber-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-950">
          <ShieldCheck className="size-5 text-amber-600" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription className="text-amber-900">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isAuthIssue && currentEmail ? (
          <p className="mb-3 text-sm text-amber-900">
            目前帳號：<span className="font-mono">{currentEmail}</span>
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 font-mono text-xs text-amber-800">{message}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/analytics">返回 AI退貨管理系統</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              <LogOut className="size-4" aria-hidden="true" />
              登出並切換帳號
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function InternalDashboardPage() {
  const result = await loadPlatformAdminDashboardView();

  if (result.state === 'gated') {
    const currentUser = await getCurrentUser();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">平台營運總覽</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            租戶狀態與需跟進事項。
          </p>
        </div>
        <GatedView
          message={result.gated.message}
          accessCode={result.gated.accessCode}
          currentEmail={currentUser?.email ?? null}
        />
      </div>
    );
  }

  if (result.state === 'error') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">平台營運總覽</h1>
        </div>
        <Card className="rounded-lg border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">無法載入</CardTitle>
            <CardDescription className="text-red-800">{result.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (result.state === 'empty') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-950">平台營運總覽</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              租戶狀態與需跟進事項。
            </p>
          </div>
        </div>
        <Card className="rounded-lg">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            目前還沒有租戶資料。
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">平台營運總覽</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          租戶狀態與需跟進事項 · 更新於 {formatDateTime(result.data.generatedAt)}
        </p>
      </div>
      <PlatformAdminDashboardContent data={result.data} />
    </div>
  );
}
