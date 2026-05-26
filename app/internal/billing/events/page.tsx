import { AlertTriangle, CheckCircle2, CircleEllipsis, FileClock, RotateCw, ShieldCheck, XCircle } from 'lucide-react';

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
import { loadPlatformBillingEventsView } from '@/lib/saas/platform-admin-live-data';
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import type { PlatformBillingEventsView } from '@/lib/saas/ui-backend-contracts';

type EventStatus = PlatformBillingEventsView['events'][number]['status'];

const guardRows = [
  ['signature verification', 'required', 'ECPay HashKey/HashIV、Stripe/TapPay webhook secret'],
  ['idempotency', 'required', 'billing_events.provider_event_id 唯一鍵'],
  ['replay window', 'required', '拒絕過期或重複 payload'],
  ['manual retry', 'disabled', 'Stage 2 測試金鑰通過後再開啟'],
] as const;

function statusBadge(status: EventStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'processed') return 'default';
  if (status === 'received') return 'secondary';
  if (status === 'failed') return 'destructive';
  return 'outline';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function EventsContent({ data }: { data: PlatformBillingEventsView }) {
  const counts = data.events.reduce(
    (acc, event) => {
      acc[event.status] += 1;
      return acc;
    },
    { received: 0, processed: 0, failed: 0, ignored: 0 } as Record<EventStatus, number>
  );

  const summaryItems = [
    { label: 'Processed', value: counts.processed, helper: '已處理事件', icon: CheckCircle2 },
    { label: 'Received', value: counts.received, helper: '已接收待處理', icon: CircleEllipsis },
    { label: 'Failed', value: counts.failed, helper: '處理失敗', icon: XCircle },
    { label: 'Ignored', value: counts.ignored, helper: '非啟用 provider 或重複事件', icon: AlertTriangle },
  ] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>{item.label}</CardDescription>
                  <Icon className="size-4 text-emerald-700" />
                </div>
                <CardTitle className="text-2xl">{item.value.toLocaleString('zh-TW')}</CardTitle>
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
          <CardDescription>來自 billing_events，依接收時間排序。</CardDescription>
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
                <TableHead>Provider Event Id</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.provider}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{event.eventType}</TableCell>
                  <TableCell className="font-medium">{event.orgName ?? event.orgId}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadge(event.status)}>{event.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {event.providerEventId ?? '—'}
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
    </>
  );
}

export default async function InternalBillingEventsPage() {
  const result = await loadPlatformBillingEventsView();
  redirectUnauthenticatedPlatformAdminResult(result, '/internal/billing/events');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Billing Events</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            金流 webhook 與電子發票事件的營運檢查；資料來自 billing_events。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button disabled variant="outline" title="Stage 2 webhook 重送功能上線後開啟">
            <RotateCw className="size-4" />
            重送事件
          </Button>
          <p className="text-xs text-muted-foreground">需 ECPay 測試金鑰與 idempotency 通過後啟用。</p>
        </div>
      </div>

      {result.state === 'ready' ? (
        <EventsContent data={result.data} />
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
