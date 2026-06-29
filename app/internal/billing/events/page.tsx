import { AlertTriangle, CheckCircle2, CircleEllipsis, FileClock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  received: '已接收',
  processed: '已處理',
  failed: '處理失敗',
  ignored: '已略過',
};

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
    { label: '已處理', value: counts.processed, helper: '完成入帳與狀態更新', icon: CheckCircle2 },
    { label: '已接收', value: counts.received, helper: '等待處理或人工確認', icon: CircleEllipsis },
    { label: '處理失敗', value: counts.failed, helper: '需人工檢查', icon: XCircle },
    { label: '已略過', value: counts.ignored, helper: '非啟用金流商或重複事件', icon: AlertTriangle },
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
                <TableHead>接收時間</TableHead>
                <TableHead>金流商</TableHead>
                <TableHead>事件類型</TableHead>
                <TableHead>租戶</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>事件編號</TableHead>
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
                    <Badge variant={statusBadge(event.status)}>{EVENT_STATUS_LABEL[event.status]}</Badge>
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
          <h2 className="text-2xl font-semibold">金流紀錄</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            金流 webhook 與電子發票事件的接收、處理與失敗紀錄。
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          目前為唯讀檢視；事件重送將於第二階段收費功能開通後提供。
        </p>
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
