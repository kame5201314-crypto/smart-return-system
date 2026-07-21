import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CircleDollarSign,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PLATFORM_ALERT_SEVERITY_LABEL,
  PLATFORM_ALERT_TYPE_MESSAGE,
} from '@/components/internal/platform-labels';
import type {
  PlatformAdminDashboardView,
  PlatformAtRiskAlert,
  PlatformAtRiskAlertCategory,
  PlatformAtRiskAlertSeverity,
  PlatformAtRiskAlertType,
} from '@/lib/saas/ui-backend-contracts';

const ALERT_CATEGORY_LABEL: Record<PlatformAtRiskAlertCategory, string> = {
  billing: '帳務',
  trial: '試用',
  quota: '額度',
  team: '團隊',
};

const ALERT_ACTION_LABEL: Record<PlatformAtRiskAlertType, string> = {
  past_due: '提醒補款',
  suspended: '確認恢復',
  cancelled: '了解取消原因',
  trial_ending: '聯絡轉付費',
  trial_expired: '處理到期',
  returns_80: '查看退貨用量',
  returns_100: '建議升級',
  ai_80: '查看 AI 用量',
  ai_100: '建議升級',
  seats_full: '查看席次',
};

function severityVariant(
  severity: PlatformAtRiskAlertSeverity
): 'destructive' | 'secondary' | 'outline' {
  if (severity === 'critical') return 'destructive';
  if (severity === 'warning') return 'secondary';
  return 'outline';
}

function formatDueLabel(alert: PlatformAtRiskAlert): string | null {
  if (alert.daysUntilDue === null) return null;
  if (alert.daysUntilDue < 0) return `已逾期 ${Math.abs(alert.daysUntilDue)} 天`;
  if (alert.daysUntilDue === 0) return '今天到期';
  return `${alert.daysUntilDue} 天後到期`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function PlatformAdminDashboardContent({ data }: { data: PlatformAdminDashboardView }) {
  const summary = data.organizations;
  const atRisk = data.atRisk;
  const trial = data.trialConversion.summary;
  const billing = data.billingEvents.summary;
  const remainingAlerts = Math.max(0, atRisk.summary.totalAlerts - atRisk.topAlerts.length);

  return (
    <>
      <Card className="rounded-lg py-0">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/internal/orgs"
              aria-label={`查看全部租戶：${summary.totalOrganizations} 個`}
              className="block rounded-md border bg-neutral-50 p-4 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">全部租戶</p>
                <Users className="size-4 text-neutral-500" aria-hidden="true" />
              </div>
              <p className="mt-1 text-3xl font-semibold text-gray-950">
                {summary.totalOrganizations.toLocaleString('zh-TW')}
              </p>
            </Link>
            <Link
              href="/internal/orgs?filter=trialing"
              aria-label={`查看試用中租戶：${summary.trialingOrganizations} 個`}
              className="block rounded-md border bg-neutral-50 p-4 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">試用中</p>
                <CalendarClock className="size-4 text-neutral-500" aria-hidden="true" />
              </div>
              <p className="mt-1 text-3xl font-semibold text-gray-950">
                {summary.trialingOrganizations.toLocaleString('zh-TW')}
              </p>
            </Link>
            <Link
              href="/internal/orgs?filter=attention"
              aria-label={`查看需關注租戶：${summary.attentionOrganizations} 個`}
              className={`block rounded-md border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${summary.attentionOrganizations > 0 ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'bg-neutral-50 hover:bg-neutral-100'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className={summary.attentionOrganizations > 0 ? 'text-sm text-amber-800' : 'text-sm text-muted-foreground'}>
                  需關注租戶
                </p>
                <AlertTriangle className={summary.attentionOrganizations > 0 ? 'size-4 text-amber-700' : 'size-4 text-neutral-500'} aria-hidden="true" />
              </div>
              <p className={`mt-1 text-3xl font-semibold ${summary.attentionOrganizations > 0 ? 'text-amber-950' : 'text-gray-950'}`}>
                {summary.attentionOrganizations.toLocaleString('zh-TW')}
              </p>
            </Link>
            <div className="rounded-md border bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">預估月營收</p>
                <CircleDollarSign className="size-4 text-neutral-500" aria-hidden="true" />
              </div>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {formatCurrency(summary.estimatedActiveMrrTwd)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {atRisk.topAlerts.length > 0 ? (
        <Card className="rounded-lg border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="size-5 text-amber-700" aria-hidden="true" />
              優先待辦（{atRisk.summary.totalAlerts}）
            </CardTitle>
            <CardDescription className="text-amber-900">
              依嚴重程度與到期時間排序；目前影響 {atRisk.summary.affectedOrganizations} 個租戶。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {atRisk.topAlerts.map((alert) => {
                const dueLabel = formatDueLabel(alert);
                const actionLabel = ALERT_ACTION_LABEL[alert.type];
                return (
                  <li key={alert.id}>
                    <Link
                      href={`/internal/orgs/${alert.orgId}`}
                      aria-label={`${actionLabel}：${alert.orgName}`}
                      className="group flex flex-col items-start justify-between gap-4 rounded-md border border-amber-200 bg-white p-4 transition-colors hover:bg-amber-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-emerald-700 group-hover:underline">
                            {alert.orgName}
                          </span>
                          <Badge variant={severityVariant(alert.severity)} className="text-xs">
                            {PLATFORM_ALERT_SEVERITY_LABEL[alert.severity]}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {ALERT_CATEGORY_LABEL[alert.category]}
                          </Badge>
                          {dueLabel ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-xs text-amber-900">
                              {dueLabel}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-amber-950">
                          {PLATFORM_ALERT_TYPE_MESSAGE[alert.type] ?? alert.message}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {alert.ownerEmail ? <span>帳號：{alert.ownerEmail}</span> : null}
                          {alert.metric ? (
                            <span>
                              用量 {alert.metric.used.toLocaleString('zh-TW')} / {alert.metric.limit.toLocaleString('zh-TW')}（{alert.metric.percent}%）
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-neutral-800">
                        {actionLabel}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {remainingAlerts > 0 ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-amber-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-950">另有 {remainingAlerts} 項警示未列出。</p>
                <Button asChild variant="outline" size="sm" className="bg-white">
                  <Link href="/internal/orgs?filter=attention">
                    查看全部受影響租戶
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-950">
              <ShieldCheck className="size-5 text-emerald-700" aria-hidden="true" />
              目前無優先待辦
            </CardTitle>
            <CardDescription className="text-emerald-900">
              沒有試用到期、付款異常、額度爆量或席次滿額的租戶。
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-emerald-700" aria-hidden="true" />
              試用轉換
            </CardTitle>
            <CardDescription>追蹤即將到期、已到期與尚未完成導入的租戶。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-neutral-50 p-3">
                <dt className="text-xs text-muted-foreground">即將到期</dt>
                <dd className="mt-1 text-xl font-semibold">{trial.trialEndingSoonOrganizations}</dd>
              </div>
              <div className="rounded-md border bg-neutral-50 p-3">
                <dt className="text-xs text-muted-foreground">已到期</dt>
                <dd className="mt-1 text-xl font-semibold">{trial.expiredTrialOrganizations}</dd>
              </div>
              <div className="rounded-md border bg-neutral-50 p-3">
                <dt className="text-xs text-muted-foreground">尚未完成導入</dt>
                <dd className="mt-1 text-xl font-semibold">{trial.onboardingIncompleteOrganizations}</dd>
              </div>
              <div className="rounded-md border bg-neutral-50 p-3">
                <dt className="text-xs text-muted-foreground">試用轉換率</dt>
                <dd className="mt-1 text-xl font-semibold">{trial.conversionRatePercent}%</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeDollarSign className="size-5 text-emerald-700" aria-hidden="true" />
              帳務處理
            </CardTitle>
            <CardDescription>快速確認尚待處理與失敗的付款事件。</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-neutral-50 p-3">
                <dt className="text-xs text-muted-foreground">待處理事件</dt>
                <dd className="mt-1 text-xl font-semibold">{billing.receivedEvents}</dd>
              </div>
              <div className={`rounded-md border p-3 ${billing.failedEvents > 0 ? 'border-red-200 bg-red-50' : 'bg-neutral-50'}`}>
                <dt className={billing.failedEvents > 0 ? 'text-xs text-red-700' : 'text-xs text-muted-foreground'}>失敗事件</dt>
                <dd className={billing.failedEvents > 0 ? 'mt-1 text-xl font-semibold text-red-900' : 'mt-1 text-xl font-semibold'}>{billing.failedEvents}</dd>
              </div>
            </dl>
            <div className="mt-4 flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href="/internal/billing/events">
                  查看帳務事件
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
