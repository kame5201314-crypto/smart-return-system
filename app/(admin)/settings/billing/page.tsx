import { AlertTriangle, CalendarClock, CreditCard } from 'lucide-react';

import {
  BillingPlanSelector,
  type BillingPaymentQueryState,
} from '@/components/saas/billing-plan-selector';
import { PageHeader } from '@/components/saas/page-header';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SAAS_PLAN_DEFINITIONS, type SaaSPlanCode } from '@/lib/config/saas-plans';
import { loadBillingSettingsView } from '@/lib/saas/settings-live-data';
import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

type BillingStatus = BillingSettingsView['org']['status'];

interface BillingSettingsPageProps {
  searchParams?: Promise<{
    payment?: string | string[];
    plan?: string | string[];
  }>;
}

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

function statusVariant(status: BillingStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  return 'destructive';
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() ? first.trim().toLowerCase() : null;
}

function normalizePaymentState(value: string | string[] | undefined): BillingPaymentQueryState | null {
  const normalized = firstQueryValue(value);
  return normalized === 'success' ||
    normalized === 'pending' ||
    normalized === 'failed' ||
    normalized === 'cancelled'
    ? normalized
    : null;
}

function normalizeRequestedPlan(value: string | string[] | undefined): SaaSPlanCode | null {
  const normalized = firstQueryValue(value);
  return normalized === 'basic' || normalized === 'growth' || normalized === 'enterprise'
    ? normalized
    : null;
}

function BillingSummary({ data }: { data: BillingSettingsView }) {
  const isTrialing = data.org.status === 'trialing';
  const planName = isTrialing ? '試用版' : SAAS_PLAN_DEFINITIONS[data.org.plan].name;
  const periodStart = data.subscription?.currentPeriodStart ?? null;
  const periodEnd = isTrialing
    ? data.subscription?.trialEnd ?? null
    : data.subscription?.currentPeriodEnd ?? null;

  return (
    <Card className="w-full rounded-xl">
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

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-gray-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-950">
                {isTrialing ? '試用開始日' : '本期開始日'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(periodStart)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-gray-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-950">
                {isTrialing ? '試用到期日' : '本期到期日'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(periodEnd)}</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          方案採一個月預付制，不會自動續扣。付款成功後，新的使用期限會顯示於此。
        </p>

        {data.subscription?.cancelAtPeriodEnd ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>目前方案將於 {formatDate(periodEnd)} 到期，屆時不會自動續扣。</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function BillingSettingsPage(
  { searchParams }: BillingSettingsPageProps = {}
) {
  const [result, params] = await Promise.all([
    loadBillingSettingsView(),
    searchParams ?? Promise.resolve({ payment: undefined, plan: undefined }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="帳務與訂閱" description="查看目前方案、使用期限，並直接選擇方案付款。" />

      {result.state === 'ready' ? (
        <>
          <BillingSummary data={result.data} />
          <BillingPlanSelector
            data={result.data}
            paymentState={normalizePaymentState(params.payment)}
            requestedPlan={normalizeRequestedPlan(params.plan)}
          />
        </>
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
