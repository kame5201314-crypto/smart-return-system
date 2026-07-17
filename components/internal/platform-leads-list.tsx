'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  CircleCheck,
  ClipboardCheck,
  Inbox,
  Loader2,
  PhoneCall,
  Store,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/saas/confirm-dialog';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type {
  PlatformLeadAction,
  PlatformLeadRecord,
  PlatformLeadStatus,
} from '@/lib/saas/platform-lead-management';

const STATUS_LABEL: Record<PlatformLeadStatus, string> = {
  new: '新申請',
  contacted: '已聯絡',
  approved: '有意願',
  rejected: '已婉拒',
  converted: '已開通',
};

const STATUS_ORDER: PlatformLeadStatus[] = [
  'new',
  'contacted',
  'approved',
  'converted',
  'rejected',
];

const LIFECYCLE_STEPS = [
  { label: '收到申請', description: '行銷頁送出的試用資料會出現在這裡。' },
  { label: '聯絡確認', description: '確認需求、退貨量與偏好的聯絡方式。' },
  { label: '人工開通', description: '確認有意願後，由營運人員建立租戶。' },
  { label: '追蹤試用', description: '開通後到租戶管理查看用量與到期狀態。' },
] as const;

const RETURN_BAND_LABEL = {
  under_30: '每月少於 30 筆',
  '30_100': '每月 30–100 筆',
  '101_300': '每月 101–300 筆',
  '301_800': '每月 301–800 筆',
  over_800: '每月超過 800 筆',
} as const;

const ACTION_COPY: Record<PlatformLeadAction, { label: string; title: string; description: string }> = {
  mark_contacted: {
    label: '標記已聯絡',
    title: '確認已聯絡這位申請人？',
    description: '名單會移到「已聯絡」，方便追蹤後續回覆。',
  },
  approve: {
    label: '確認有意願',
    title: '確認客戶有試用意願？',
    description: '這不會自動建立帳號或租戶，仍需由你人工開通。',
  },
  reject: {
    label: '婉拒',
    title: '將這筆申請標記為已婉拒？',
    description: '操作會保留在紀錄中，不會刪除名單。',
  },
  convert: {
    label: '標記已開通',
    title: '確認已完成人工開通？',
    description: '這只會更新名單進度，不會建立帳號、租戶或訂閱。',
  },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function contactText(lead: PlatformLeadRecord): string {
  if (lead.preferredContactChannel === 'line' && lead.lineId) return `LINE：${lead.lineId}`;
  if (lead.preferredContactChannel === 'phone' && lead.phone) return `電話：${lead.phone}`;
  return `Email：${lead.email ?? '未提供'}`;
}

function availableActions(status: PlatformLeadStatus): PlatformLeadAction[] {
  if (status === 'new') return ['mark_contacted', 'approve', 'reject'];
  if (status === 'contacted') return ['approve', 'reject'];
  if (status === 'approved') return ['convert', 'reject'];
  return [];
}

export function PlatformLeadsEmptyState() {
  return (
    <Card className="rounded-lg" role="status">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Inbox className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">目前沒有新的試用申請</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              客戶從行銷頁送出申請後，名單會自動顯示在這裡。系統不會自動建立帳號、租戶或訂閱，仍由營運人員確認後開通。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
            <Button asChild variant="outline">
              <Link href="/">
                查看行銷頁
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/internal/orgs">
                前往租戶管理
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-7 border-t pt-6">
          <h4 className="text-sm font-semibold">試用申請處理流程</h4>
          <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {LIFECYCLE_STEPS.map((step, index) => (
              <li key={step.label} className="rounded-md border bg-neutral-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlatformLeadsList({ leads }: { leads: PlatformLeadRecord[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | PlatformLeadStatus>('all');
  const [pending, setPending] = useState<{ lead: PlatformLeadRecord; action: PlatformLeadAction } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const statusCounts = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, leads.filter((lead) => lead.status === status).length])
  ) as Record<PlatformLeadStatus, number>;
  const visibleLeads = statusFilter === 'all'
    ? leads
    : leads.filter((lead) => lead.status === statusFilter);

  async function confirmAction() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/internal/saas/leads/${pending.lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pending.action }),
      });
      const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || payload?.success !== true) {
        toast.error(payload?.error || '名單更新失敗，請稍後再試。');
        return;
      }
      toast.success('名單進度已更新。');
      setPending(null);
      router.refresh();
    } catch {
      toast.error('名單更新失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-emerald-700" aria-hidden="true" />
                <h3 className="font-semibold">申請進度</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                依客戶生命週期篩選名單；開通租戶前仍需人工確認。
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/internal/orgs">
                <Store className="size-4" aria-hidden="true" />
                租戶管理
              </Link>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="試用申請狀態篩選">
            <Button
              type="button"
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              aria-pressed={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              全部 {leads.length}
            </Button>
            {STATUS_ORDER.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {STATUS_LABEL[status]} {statusCounts[status]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {visibleLeads.map((lead) => (
        <Card key={lead.id} className="rounded-lg">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{lead.companyName}</h3>
                <Badge variant={lead.status === 'rejected' ? 'outline' : 'secondary'}>
                  {STATUS_LABEL[lead.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {SAAS_PLAN_DEFINITIONS[lead.requestedPlan].name}
                </span>
              </div>
              <p className="text-sm">
                {lead.contactName} · {contactText(lead)}
              </p>
              <p className="text-xs text-muted-foreground">
                {lead.monthlyReturnBand ? RETURN_BAND_LABEL[lead.monthlyReturnBand] : '未填退貨量'}
                {' · '}申請於 {formatDate(lead.createdAt)}
              </p>
              {lead.message ? <p className="text-sm text-muted-foreground">需求：{lead.message}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {availableActions(lead.status).map((action) => {
                const Icon = action === 'mark_contacted' ? PhoneCall : action === 'approve' ? Check : action === 'reject' ? X : CircleCheck;
                return (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={action === 'reject' ? 'outline' : 'default'}
                    aria-label={`${ACTION_COPY[action].label}：${lead.companyName}`}
                    onClick={() => setPending({ lead, action })}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {ACTION_COPY[action].label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {visibleLeads.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white px-5 py-8 text-center" role="status">
          <p className="text-sm font-medium">這個階段目前沒有申請</p>
          <p className="mt-1 text-xs text-muted-foreground">可切換其他狀態繼續查看。</p>
        </div>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending ? ACTION_COPY[pending.action].title : ''}
        description={pending ? ACTION_COPY[pending.action].description : undefined}
        confirmLabel={pending ? ACTION_COPY[pending.action].label : '確認'}
        destructive={pending?.action === 'reject'}
        pending={submitting}
        onConfirm={confirmAction}
      />
      {submitting ? <span className="sr-only"><Loader2 className="animate-spin" />更新中</span> : null}
    </div>
  );
}
