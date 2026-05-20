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

const billingTimeline = [
  ['trialing', '14 天試用，未付款到期後進入 suspended。'],
  ['active', '付款成功後可完整使用方案內功能。'],
  ['past_due', '續扣失敗後保留 7 天寬限，可登入與付款。'],
  ['suspended', '可看資料與帳單，不可新增資料、AI 或匯出。'],
  ['cancelled', '30 天未補繳或主動取消後進入取消狀態。'],
] as const;

const invoiceRows = [
  ['公司抬頭', 'Beta 期由平台管理員手動確認'],
  ['統一編號', 'organizations.tax_id'],
  ['載具 / Email', 'organizations.invoice_carrier / billing_email'],
  ['發票供應商', 'ECPay e-invoice'],
] as const;

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">帳務與訂閱</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stage 2 才會接 ECPay 定期定額與電子發票；Beta 期先保留 UI 與資料模型。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/pricing" target="_blank">
            公開方案
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-emerald-700" />
              目前訂閱
            </CardTitle>
            <CardDescription>資料來源預計為 organizations + subscriptions。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['方案', 'Growth', '待接 org.plan'],
                ['狀態', 'trialing', '待接 organizations.status'],
                ['週期', '14 天試用', '待接 subscriptions.trial_end'],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-md border p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-2 text-xl font-semibold text-gray-950">{value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
                </div>
              ))}
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
            <CardDescription>電子發票欄位已在 024 migration 草案保留。</CardDescription>
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
                      <Badge variant="outline">{status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
