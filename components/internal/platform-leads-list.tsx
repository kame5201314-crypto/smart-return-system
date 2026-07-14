'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleCheck, Loader2, PhoneCall, X } from 'lucide-react';
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

export function PlatformLeadsList({ leads }: { leads: PlatformLeadRecord[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ lead: PlatformLeadRecord; action: PlatformLeadAction } | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="space-y-3">
      {leads.map((lead) => (
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
