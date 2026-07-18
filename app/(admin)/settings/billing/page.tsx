import Link from 'next/link';
import { AlertTriangle, CalendarClock, CreditCard, Headphones } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/saas/page-header';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { loadBillingSettingsView } from '@/lib/saas/settings-live-data';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

type BillingStatus = BillingSettingsView['org']['status'];

const STATUS_LABEL: Record<BillingStatus, string> = {
  trialing: '試用中',
  active: '使用中',
  past_due: '待補款',
  suspended: '已暫停',
  cancelled: '已取消',
};

function formatDate(value: string | null): string {
  if (!value) return '尚未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未設定';
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
}

function describeDaysUntil(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return '今天到期';
  if (days === 1) return '明天到期';
  return `還剩 ${days} 天`;
}

function statusVariant(status: BillingStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  return 'destructive';
}

function BillingContent({ data }: { data: BillingSettingsView }) {
  const planName = SAAS_PLAN_DEFINITIONS[data.org.plan].name;
  const periodEnd = data.subscription?.currentPeriodEnd ?? null;
  const isTrialing = data.org.status === 'trialing';
  const trialDaysLeft = isTrialing ? describeDaysUntil(daysUntil(periodEnd)) : null;
  const cancelAtPeriodEnd = data.subscription?.cancelAtPeriodEnd ?? false;
  const periodTitle = isTrialing ? '試用期限' : '目前週期';
  const periodDetail = isTrialing
    ? `${formatDate(periodEnd)}${trialDaysLeft ? ` · ${trialDaysLeft}` : ''}`
    : periodEnd
      ? `至 ${formatDate(periodEnd)}`
      : '尚未設定';

  return (
    <Card className="w-full max-w-3xl rounded-xl">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">目前方案</p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-950">{planName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{data.org.name}</p>
            </div>
          </div>
          <Badge variant={statusVariant(data.org.status)} className="w-fit">
            {STATUS_LABEL[data.org.status]}
          </Badge>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-gray-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-gray-950">{periodTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{periodDetail}</p>
          </div>
        </div>

        {cancelAtPeriodEnd ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>訂閱將於 {formatDate(periodEnd)} 到期後結束；若需繼續使用，請聯絡客服。</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Headphones className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-950">升級、續約或帳務問題</p>
              <p className="mt-1 text-sm text-muted-foreground">目前由客服專人協助處理。</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button asChild>
              <Link href="/contact">聯絡客服</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings/usage">查看用量</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function BillingSettingsPage() {
  const result = await loadBillingSettingsView();

  return (
    <div className="space-y-6">
      <PageHeader title="帳務與訂閱" description="查看目前方案、狀態與使用期限。" />

      {result.state === 'ready' ? (
        <BillingContent data={result.data} />
      ) : result.state === 'gated' ? (
        <SettingsStateCard variant="gated" gated={result.gated} />
      ) : result.state === 'empty' ? (
        <SettingsStateCard variant="empty" message={result.message} />
      ) : (
        <SettingsStateCard variant="error" message={result.message} />
      )}
    </div>
  );
}
