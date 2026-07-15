import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CreditCard,
  FileText,
  Headphones,
  ReceiptText,
  Sparkles,
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

const PROVIDER_LABEL: Record<NonNullable<NonNullable<BillingSettingsView['subscription']>['provider']>, string> = {
  manual: '專人協助',
  ecpay: '綠界 ECPay',
  stripe: 'Stripe',
  tappay: 'TapPay',
};

const INVOICE_LABEL: Record<NonNullable<BillingSettingsView['invoiceSummary']['latestInvoiceStatus']>, string> = {
  draft: '草稿',
  issued: '已開立',
  paid: '已付款',
  failed: '失敗',
  void: '作廢',
};

const billingTimeline: ReadonlyArray<readonly [BillingStatus, string]> = [
  ['trialing', '提供 3 天試用，期間享有方案完整功能。'],
  ['active', '訂閱已生效，可使用方案內所有功能。'],
  ['past_due', '扣款失敗，提供 7 天寬限期可補繳。'],
  ['suspended', '可查看歷史資料與帳單，暫無法新增或匯出資料。'],
  ['cancelled', '訂閱已結束，可隨時重新訂閱。'],
];

const BETA_SUPPORT_NOTE = 'Beta 期間，方案升級與付款設定由專人協助，請聯絡客服。';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function describeDaysUntil(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return '今天到期';
  if (days === 1) return '明天到期';
  return `還剩 ${days} 天`;
}

function BillingContent({ data }: { data: BillingSettingsView }) {
  const planName = SAAS_PLAN_DEFINITIONS[data.org.plan].name;
  const periodEnd = data.subscription?.currentPeriodEnd ?? null;
  const periodLabel = periodEnd
    ? `至 ${formatDate(periodEnd)}${data.subscription?.cancelAtPeriodEnd ? '（到期後取消）' : ''}`
    : '—';
  const providerLabel = data.subscription?.provider
    ? PROVIDER_LABEL[data.subscription.provider]
    : '專人協助';
  const isTrialing = data.org.status === 'trialing';
  const cancelAtPeriodEnd = data.subscription?.cancelAtPeriodEnd ?? false;
  const trialDaysLeft = isTrialing ? daysUntil(periodEnd) : null;
  const invoiceLabel = data.invoiceSummary.latestInvoiceStatus
    ? INVOICE_LABEL[data.invoiceSummary.latestInvoiceStatus]
    : '尚無';

  const summaryRows = [
    ['方案', planName],
    ['狀態', STATUS_LABEL[data.org.status]],
    ['本期', periodLabel],
  ] as const;

  const invoiceRows = [
    ['帳務 Email', data.invoiceSummary.billingEmail || '—'],
    ['統一編號', data.invoiceSummary.taxId || '—'],
    ['最新發票', invoiceLabel],
    ['付款方式', providerLabel],
  ] as const;

  return (
    <>
      {isTrialing && trialDaysLeft !== null ? (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-4 text-cyan-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">
                  試用中 · {describeDaysUntil(trialDaysLeft)}
                </p>
                <p className="mt-1 text-sm text-cyan-900">
                  試用至 {formatDate(periodEnd)}；到期前可聯絡客服升級正式方案。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button asChild size="sm" variant="outline" className="bg-white">
                <Link href="/contact">聯絡客服</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/pricing" target="_blank">查看方案</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelAtPeriodEnd ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">訂閱已設定為到期後取消</p>
                <p className="mt-1 text-sm text-amber-900">
                  將於 {formatDate(periodEnd)} 結束服務。若需保留服務，請聯絡客服。
                </p>
              </div>
            </div>
            <div className="flex shrink-0">
              <Button asChild size="sm" variant="outline" className="bg-white">
                <Link href="/contact">聯絡客服</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-emerald-700" />
              目前訂閱
            </CardTitle>
            <CardDescription>{data.org.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {summaryRows.map(([label, value]) => (
                <div key={label} className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-2 text-xl font-semibold text-gray-950">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Headphones className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="space-y-2 text-sm text-amber-900">
                  <p className="font-medium">{BETA_SUPPORT_NOTE}</p>
                  <p className="text-amber-800">
                    需要升級方案、調整付款資訊或取消續訂，請聯絡客服協助處理。
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline" className="bg-white">
                      <Link href="/contact">聯絡客服</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/pricing" target="_blank">
                        查看方案
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-cyan-700" />
              付款與週期
            </CardTitle>
            <CardDescription>升降級於下個帳單週期生效。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>付款成功：訂閱進入「使用中」。</p>
            <p>扣款失敗：進入「待補款」。</p>
            <p>連續 7 天未補繳：暫停服務。</p>
            <p>連續 30 天未補繳：訂閱取消。</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-emerald-700" />
              發票資料
            </CardTitle>
            <CardDescription>用於開立電子發票的相關資訊。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {invoiceRows.map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-muted-foreground">{value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-cyan-700" />
              訂閱狀態說明
            </CardTitle>
            <CardDescription>各訂閱狀態下可使用的功能範圍。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>狀態</TableHead>
                  <TableHead>說明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingTimeline.map(([status, detail]) => (
                  <TableRow key={status}>
                    <TableCell>
                      <Badge variant={status === data.org.status ? 'default' : 'outline'}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default async function BillingSettingsPage() {
  const result = await loadBillingSettingsView();

  return (
    <div className="space-y-6">
      <PageHeader
        title="帳務與訂閱"
        description={`查看目前方案、訂閱狀態與電子發票資訊。${BETA_SUPPORT_NOTE}`}
        actions={
          <>
            <Button asChild>
              <Link href="/contact">聯絡客服</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing" target="_blank">
                查看方案
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        }
      />

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
