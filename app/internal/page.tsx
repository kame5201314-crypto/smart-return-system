import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CreditCard,
  LogOut,
  PlayCircle,
  ShieldCheck,
  Timer,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCurrentUser, signOut } from '@/lib/actions/auth';
import { loadPlatformAdminDashboardView } from '@/lib/saas/platform-admin-live-data';
import type {
  PlatformAdminDashboardView,
  PlatformAtRiskAlertCategory,
  PlatformAtRiskAlertSeverity,
  PlatformTrialConversionLifecycle,
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

const BILLING_EVENT_STATUS_LABEL = {
  received: '已收到',
  processed: '已處理',
  failed: '失敗',
  ignored: '已忽略',
} as const;

const LIFECYCLE_LABEL: Record<PlatformTrialConversionLifecycle, string> = {
  trialing: '試用中',
  trial_ending: '試用即將到期',
  trial_expired: '試用已到期',
  converted_active: '已轉付費',
  not_trial: '—',
};

function formatTwd(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

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

function billingEventVariant(
  status: 'received' | 'processed' | 'failed' | 'ignored'
): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'processed') return 'default';
  if (status === 'ignored') return 'secondary';
  return 'outline';
}

function DashboardContent({ data }: { data: PlatformAdminDashboardView }) {
  const summary = data.organizations;
  const atRisk = data.atRisk;
  const trial = data.trialConversion;
  const billing = data.billingEvents;

  const kpis: Array<{
    label: string;
    value: string;
    helper: string;
    icon: typeof CreditCard;
    alert: boolean;
  }> = [
    {
      label: '估算 MRR',
      value: formatTwd(summary.estimatedActiveMrrTwd),
      helper: `試用潛在 ${formatTwd(summary.trialPipelineMrrTwd)}`,
      icon: CreditCard,
      alert: false,
    },
    {
      label: '使用中 / 試用',
      value: summary.activeOrTrialingOrganizations.toLocaleString('zh-TW'),
      helper: `${summary.trialingOrganizations.toLocaleString('zh-TW')} 個試用中`,
      icon: PlayCircle,
      alert: false,
    },
    {
      label: 'At-risk 租戶',
      value: summary.atRiskOrganizations.toLocaleString('zh-TW'),
      helper: `${summary.pausedOrPastDueOrganizations.toLocaleString('zh-TW')} 個停用或逾期`,
      icon: AlertTriangle,
      alert: summary.atRiskOrganizations > 0,
    },
    {
      label: 'AI 額度用完',
      value: summary.aiLimitReachedOrganizations.toLocaleString('zh-TW'),
      helper: '需客服或升級介入',
      icon: Bot,
      alert: summary.aiLimitReachedOrganizations > 0,
    },
  ];

  const billingCells: Array<{
    label: string;
    value: number;
    dot: string;
  }> = [
    { label: '已收到', value: billing.summary.receivedEvents, dot: 'bg-gray-400' },
    { label: '已處理', value: billing.summary.processedEvents, dot: 'bg-emerald-500' },
    { label: '失敗', value: billing.summary.failedEvents, dot: 'bg-red-500' },
    { label: '已忽略', value: billing.summary.ignoredEvents, dot: 'bg-amber-400' },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={`rounded-lg ${item.alert ? 'border-amber-300 bg-amber-50/60' : ''}`}
            >
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className={`text-xs ${item.alert ? 'text-amber-800' : 'text-muted-foreground'}`}>
                    {item.label}
                  </p>
                  <p className={`mt-1 truncate text-2xl font-semibold ${item.alert ? 'text-amber-900' : 'text-gray-950'}`}>
                    {item.value}
                  </p>
                  <p className={`mt-1 text-xs ${item.alert ? 'text-amber-800' : 'text-muted-foreground'}`}>
                    {item.helper}
                  </p>
                </div>
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${item.alert ? 'text-amber-600' : 'text-emerald-700'}`}
                  aria-hidden="true"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

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
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="size-5 text-cyan-700" />
              試用追蹤
            </CardTitle>
            <CardDescription>
              即將到期 {trial.summary.trialEndingSoonOrganizations} 個 · 已過期 {trial.summary.expiredTrialOrganizations} 個 · 轉換率 {trial.summary.conversionRatePercent}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trial.followUpOrganizations.length > 0 ? (
              <ul className="space-y-2">
                {trial.followUpOrganizations.map((org) => {
                  const isExpired = org.lifecycleState === 'trial_expired';
                  const isEnding = org.lifecycleState === 'trial_ending';
                  const dayText =
                    org.daysUntilTrialEnd !== null
                      ? org.daysUntilTrialEnd >= 0
                        ? `剩 ${org.daysUntilTrialEnd} 天`
                        : `已過 ${Math.abs(org.daysUntilTrialEnd)} 天`
                      : null;

                  return (
                    <li
                      key={org.orgId}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/internal/orgs/${org.orgId}`}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            {org.orgName}
                          </Link>
                          <Badge
                            variant={isExpired ? 'destructive' : isEnding ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {LIFECYCLE_LABEL[org.lifecycleState]}
                          </Badge>
                          {dayText ? (
                            <span
                              className={`text-xs ${
                                isExpired
                                  ? 'font-medium text-red-600'
                                  : isEnding
                                    ? 'font-medium text-amber-700'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {dayText}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{org.ownerEmail ?? '—'}</p>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="shrink-0">
                        <Link href={`/internal/orgs/${org.orgId}`}>
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                目前沒有需要跟進的試用客戶。
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-emerald-700" />
              金流事件
            </CardTitle>
            <CardDescription>
              共 {billing.summary.totalEvents} 筆事件，其中 {billing.summary.failedEvents} 筆失敗。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3">
            {billing.summary.totalEvents === 0 ? (
              <p className="flex-1 rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                尚未接收任何金流事件；Stage 2 接上 ECPay 後開始累積。
              </p>
            ) : (
              <div className="flex flex-1 flex-wrap content-start gap-x-5 gap-y-2 text-sm">
                {billingCells.map((cell) => (
                  <span key={cell.label} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${cell.dot}`} aria-hidden="true" />
                    <span className="text-muted-foreground">{cell.label}</span>
                    <span className="font-semibold text-gray-950">
                      {cell.value.toLocaleString('zh-TW')}
                    </span>
                  </span>
                ))}
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/internal/billing/events">
                查看所有事件
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {billing.recentEvents.length > 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>最近的金流事件</CardTitle>
            <CardDescription>
              最新 {billing.recentEvents.length} 筆事件。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>時間</TableHead>
                  <TableHead>租戶</TableHead>
                  <TableHead>事件</TableHead>
                  <TableHead>狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {event.orgName ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{event.eventType}</TableCell>
                    <TableCell>
                      <Badge variant={billingEventVariant(event.status)}>
                        {BILLING_EVENT_STATUS_LABEL[event.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
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
