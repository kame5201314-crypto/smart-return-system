import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser, signOut } from '@/lib/actions/auth';
import { loadPlatformAdminDashboardView } from '@/lib/saas/platform-admin-live-data';
import type {
  PlatformAdminDashboardView,
  PlatformAtRiskAlertCategory,
  PlatformAtRiskAlertSeverity,
} from '@/lib/saas/ui-backend-contracts';
import {
  PLATFORM_ALERT_SEVERITY_LABEL,
  PLATFORM_ALERT_TYPE_ACTION,
  PLATFORM_ALERT_TYPE_MESSAGE,
} from '@/components/internal/platform-labels';

const ALERT_CATEGORY_LABEL: Record<PlatformAtRiskAlertCategory, string> = {
  billing: '帳務',
  trial: '試用',
  quota: '額度',
  team: '團隊',
};

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

function severityVariant(
  severity: PlatformAtRiskAlertSeverity
): 'destructive' | 'secondary' | 'outline' {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'secondary';
  return 'outline';
}

function DashboardContent({ data }: { data: PlatformAdminDashboardView }) {
  const summary = data.organizations;
  const atRisk = data.atRisk;
  const totalOrganizations = summary.totalOrganizations.toLocaleString('zh-TW');
  const activeOrTrialing = summary.activeOrTrialingOrganizations.toLocaleString('zh-TW');
  const trialing = summary.trialingOrganizations.toLocaleString('zh-TW');
  const needsAttention = atRisk.summary.affectedOrganizations.toLocaleString('zh-TW');

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>租戶總覽</CardTitle>
          <CardDescription>
            目前共有 {totalOrganizations} 個租戶，其中 {activeOrTrialing} 個使用中或試用中。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-neutral-50 p-4">
              <p className="text-sm text-muted-foreground">全部租戶</p>
              <p className="mt-1 text-3xl font-semibold text-gray-950">{totalOrganizations}</p>
            </div>
            <div className="rounded-md border bg-neutral-50 p-4">
              <p className="text-sm text-muted-foreground">試用中</p>
              <p className="mt-1 text-3xl font-semibold text-gray-950">{trialing}</p>
            </div>
            <div className={`rounded-md border p-4 ${atRisk.summary.affectedOrganizations > 0 ? 'border-amber-300 bg-amber-50' : 'bg-neutral-50'}`}>
              <p className={atRisk.summary.affectedOrganizations > 0 ? 'text-sm text-amber-800' : 'text-sm text-muted-foreground'}>
                需關注租戶
              </p>
              <p className={`mt-1 text-3xl font-semibold ${atRisk.summary.affectedOrganizations > 0 ? 'text-amber-900' : 'text-gray-950'}`}>
                {needsAttention}
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/internal/orgs">
                查看所有租戶
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {atRisk.topAlerts.length > 0 ? (
        <Card className="rounded-lg border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="size-5 text-amber-600" />
              需立即關注（{atRisk.summary.totalAlerts}）
            </CardTitle>
            <CardDescription className="text-amber-900">
              {atRisk.summary.criticalAlerts} 項嚴重 · {atRisk.summary.warningAlerts} 項警告 · 共影響 {atRisk.summary.affectedOrganizations} 個租戶
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {atRisk.topAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex flex-col items-start justify-between gap-3 rounded-md border border-amber-200 bg-white p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/internal/orgs/${alert.orgId}`}
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        {alert.orgName}
                      </Link>
                      <Badge variant={severityVariant(alert.severity)} className="text-xs">
                        {PLATFORM_ALERT_SEVERITY_LABEL[alert.severity]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {ALERT_CATEGORY_LABEL[alert.category]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-amber-900">
                      {PLATFORM_ALERT_TYPE_MESSAGE[alert.type] ?? alert.message}
                    </p>
                    {alert.metric ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        使用 {alert.metric.used.toLocaleString('zh-TW')} / {alert.metric.limit.toLocaleString('zh-TW')}（{alert.metric.percent}%）
                      </p>
                    ) : null}
                    {PLATFORM_ALERT_TYPE_ACTION[alert.type] ? (
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        建議動作：{PLATFORM_ALERT_TYPE_ACTION[alert.type]}
                      </p>
                    ) : null}
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/internal/orgs/${alert.orgId}`}>
                      跟進
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-950">
              <ShieldCheck className="size-5 text-emerald-700" />
              目前無待辦
            </CardTitle>
            <CardDescription className="text-emerald-900">
              沒有試用到期、付款異常、額度爆量或席次滿額的租戶。
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </>
  );
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
          <ShieldCheck className="size-5 text-amber-600" />
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
            <Link href="/analytics">返回退貨工作台</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              <LogOut className="size-4" />
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
          <h1 className="text-2xl font-bold text-gray-950">平台總覽</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            查看 SaaS 訂閱、用量與金流概況。
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
          <h1 className="text-2xl font-bold text-gray-950">平台總覽</h1>
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
            <h1 className="text-2xl font-bold text-gray-950">平台總覽</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              SaaS 訂閱、用量與金流概況。
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">平台總覽</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SaaS 訂閱、用量與金流概況。更新於 {formatDateTime(result.data.generatedAt)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/internal/orgs">
            查看所有租戶
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <DashboardContent data={result.data} />
    </div>
  );
}
