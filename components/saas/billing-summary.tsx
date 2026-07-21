import { AlertTriangle, CalendarClock, CreditCard } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import { formatSaaSBillingDate } from '@/lib/saas/billing-date';
import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

type BillingStatus = BillingSettingsView['org']['status'];

const STATUS_LABEL: Record<BillingStatus, string> = {
  trialing: '試用中',
  active: '使用中',
  past_due: '待補款',
  suspended: '已暫停',
  cancelled: '已取消',
};

function statusVariant(status: BillingStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  return 'destructive';
}

function isTrialSubscription(data: BillingSettingsView): boolean {
  return data.org.status === 'trialing' ||
    (data.org.status === 'suspended' && data.org.suspensionSource === 'trial_expired');
}

export function BillingSummary({ data }: { data: BillingSettingsView }) {
  const isTrial = isTrialSubscription(data);
  const isExpiredTrial = data.org.status === 'suspended' && isTrial;
  const planName = isTrial ? '試用版' : SAAS_PLAN_DEFINITIONS[data.org.plan].name;
  const periodStart = data.subscription?.currentPeriodStart ?? null;
  const periodEnd = isTrial
    ? data.subscription?.trialEnd ?? null
    : data.subscription?.currentPeriodEnd ?? null;
  const statusLabel = isExpiredTrial ? '試用已到期' : STATUS_LABEL[data.org.status];
  const summaryCopy = isExpiredTrial
    ? '完成方案付款後，即可恢復新增退貨、資料匯入／匯出與 AI 分析。'
    : isTrial
      ? '試用期間可使用完整退貨工作區；到期後仍可查看歷史資料。'
      : '方案採一個月預付制，不會自動續扣；付款完成後會立即更新使用期限。';

  return (
    <Card className="w-full rounded-2xl border-gray-200 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">目前方案</p>
              <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-950">
                {planName}
              </h2>
            </div>
          </div>
          <Badge
            variant={isExpiredTrial ? 'secondary' : statusVariant(data.org.status)}
            className={
              isExpiredTrial
                ? 'w-fit border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50'
                : 'w-fit'
            }
          >
            {statusLabel}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-gray-600" aria-hidden="true" />
            <div>
              <dt className="text-sm font-medium text-gray-950">
                {isTrial ? '試用開始日' : '本期開始日'}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {formatSaaSBillingDate(periodStart)}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-gray-600" aria-hidden="true" />
            <div>
              <dt className="text-sm font-medium text-gray-950">
                {isTrial ? '試用到期日' : '本期到期日'}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {formatSaaSBillingDate(periodEnd)}
              </dd>
            </div>
          </div>
        </dl>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">{summaryCopy}</p>

        {data.subscription?.cancelAtPeriodEnd ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>目前方案將於 {formatSaaSBillingDate(periodEnd)} 到期，屆時不會自動續扣。</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
