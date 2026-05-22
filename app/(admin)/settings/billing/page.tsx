import Link from 'next/link';
import { ArrowRight, CalendarClock, CreditCard, FileText, ReceiptText } from 'lucide-react';

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
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { loadBillingSettingsView } from '@/lib/saas/settings-live-data';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

const STATUS_LABEL: Record<BillingSettingsView['org']['status'], string> = {
  trialing: '試用中',
  active: '使用中',
  past_due: '待補款',
  suspended: '已暫停',
  cancelled: '已取消',
};

const PROVIDER_LABEL: Record<NonNullable<NonNullable<BillingSettingsView['subscription']>['provider']>, string> = {
  manual: '手動',
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

const billingTimeline = [
  ['trialing', '14 天試用，未付款到期後進入 suspended。'],
  ['active', '付款成功後可完整使用方案內功能。'],
  ['past_due', '續扣失敗後保留 7 天寬限，可登入與付款。'],
  ['suspended', '可看資料與帳單，不可新增資料、AI 或匯出。'],
  ['cancelled', '30 天未補繳或主動取消後進入取消狀態。'],
] as const;

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function BillingContent({ data }: { data: BillingSettingsView }) {
  const planName = SAAS_PLAN_DEFINITIONS[data.org.plan].name;
  const periodLabel = data.subscription?.currentPeriodEnd
    ? `至 ${formatDate(data.subscription.currentPeriodEnd)}${data.subscription.cancelAtPeriodEnd ? '（到期後取消）' : ''}`
    : '—';
  const providerLabel = data.subscription?.provider
    ? PROVIDER_LABEL[data.subscription.provider]
    : '—';
  const invoiceLabel = data.invoiceSummary.latestInvoiceStatus
    ? INVOICE_LABEL[data.invoiceSummary.latestInvoiceStatus]
    : '尚無';

  const summaryRows = [
    ['方案', planName, 'organizations.plan'],
    ['狀態', STATUS_LABEL[data.org.status], 'organizations.status'],
    ['本期', periodLabel, 'subscriptions.current_period_end'],
  ] as const;

  const invoiceRows = [
    ['帳務 Email', data.invoiceSummary.billingEmail || '—'],
    ['統一編號', data.invoiceSummary.taxId || '—'],
    ['最新發票', invoiceLabel],
    ['金流商', providerLabel],
  ] as const;

  return (
    <>
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
              {summaryRows.map(([label, value, hint]) => (
                <div key={label} className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-2 text-xl font-semibold text-gray-950">{value}</div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{hint}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-start gap-1">
              <div className="flex flex-wrap gap-2">
                <Button disabled title="Stage 2 接 ECPay 定期定額後開放">更新付款資訊</Button>
                <Button
                  variant="outline"
                  disabled
                  title="Stage 2 接 ECPay 定期定額後開放"
                >
                  取消續訂
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">付款與續訂操作於 Stage 2 接 ECPay 後開放。</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-cyan-700" />
              付款節奏
            </CardTitle>
            <CardDescription>MVP 不做 proration，升降級下期生效。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>付款成功：active</p>
            <p>扣款失敗：past_due</p>
            <p>7 天未補繳：suspended</p>
            <p>30 天未補繳：cancelled</p>
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
            <CardDescription>電子發票欄位來自 organizations 與 invoices。</CardDescription>
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
              訂閱狀態機
            </CardTitle>
            <CardDescription>UI 與 webhook 後續要共同遵守這套狀態。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>狀態</TableHead>
                  <TableHead>可用範圍</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingTimeline.map(([status, detail]) => (
                  <TableRow key={status}>
                    <TableCell>
                      <Badge variant={status === data.org.status ? 'default' : 'outline'}>
                        {status}
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">帳務與訂閱</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            檢視目前方案、訂閱狀態與電子發票欄位；付款流程於 Stage 2 接 ECPay 後開放。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/pricing" target="_blank">
            公開方案
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

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
