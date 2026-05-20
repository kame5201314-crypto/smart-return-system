import { AlertTriangle, CheckCircle2, CircleEllipsis, FileClock, RotateCw, ShieldCheck } from 'lucide-react';

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

const eventRows = [
  {
    id: 'evt_ecpay_001',
    provider: 'ecpay',
    type: 'period_paid',
    org: '朝露選品',
    status: 'processed',
    receivedAt: '2026-05-20 12:30',
    idempotencyKey: 'ecpay:trade-20260520-001',
  },
  {
    id: 'evt_ecpay_002',
    provider: 'ecpay',
    type: 'invoice_issued',
    org: '島嶼生活',
    status: 'pending',
    receivedAt: '2026-05-20 12:36',
    idempotencyKey: 'ecpay:invoice-20260520-002',
  },
  {
    id: 'evt_stripe_001',
    provider: 'stripe',
    type: 'checkout.session.completed',
    org: '巷口小店',
    status: 'ignored',
    receivedAt: '2026-05-20 12:40',
    idempotencyKey: 'stripe:evt_demo_001',
  },
] as const;

const guardRows = [
  ['signature verification', 'required', 'ECPay HashKey/HashIV、Stripe/TapPay webhook secret'],
  ['idempotency', 'required', 'billing_events.provider_event_id 唯一鍵'],
  ['replay window', 'required', '拒絕過期或重複 payload'],
  ['manual retry', 'disabled', 'Stage 2 測試金鑰通過後再開啟'],
] as const;

const summaryItems = [
  { label: 'Processed', value: '1', helper: '已處理事件', icon: CheckCircle2 },
  { label: 'Pending', value: '1', helper: '等待 worker 或人工確認', icon: CircleEllipsis },
  { label: 'Ignored', value: '1', helper: '非啟用 provider 或測試事件', icon: AlertTriangle },
] as const;

function statusBadge(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'processed') return 'default';
  if (status === 'pending') return 'secondary';
  return 'outline';
}

export default function InternalBillingEventsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Billing Events</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            金流 webhook 與電子發票事件的營運檢查骨架。正式重送功能目前關閉。
          </p>
        </div>
        <Button disabled variant="outline">
          <RotateCw className="size-4" />
          重送事件
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
          <Card key={item.label} className="rounded-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardDescription>{item.label}</CardDescription>
                <Icon className="size-4 text-emerald-700" />
              </div>
              <CardTitle className="text-2xl">{item.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{item.helper}</p>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileClock className="size-5 text-emerald-700" />
            Event Ledger
          </CardTitle>
          <CardDescription>
            Stage 2 會由 ECPay 定期定額 webhook 寫入 billing_events，Stripe / TapPay 保留欄位但不先啟用。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Idempotency Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventRows.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-muted-foreground">{event.receivedAt}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.provider}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{event.type}</TableCell>
                  <TableCell className="font-medium">{event.org}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge(event.status)}>{event.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {event.idempotencyKey}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-cyan-700" />
            Webhook Guard Checklist
          </CardTitle>
          <CardDescription>正式接金流前，這些 guard 必須先在 route 與測試中固定下來。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guard</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guardRows.map(([guard, status, rule]) => (
                <TableRow key={guard}>
                  <TableCell className="font-medium">{guard}</TableCell>
                  <TableCell>
                    <Badge variant={status === 'required' ? 'secondary' : 'outline'}>{status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{rule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
