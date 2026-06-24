'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { TeamSettingsView } from '@/lib/saas/ui-backend-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/saas/confirm-dialog';
import { translateTeamReason } from '@/components/saas/team-reason-text';

type Invite = TeamSettingsView['invites'][number];

const ROLE_LABEL: Record<Invite['role'], string> = {
  admin: '管理員',
  staff: '作業成員',
  viewer: '檢視者',
};

const STATUS_LABEL: Record<Invite['status'], string> = {
  pending: '待接受',
  accepted: '已接受',
  expired: '已過期',
  revoked: '已撤銷',
};

const ERROR_MESSAGE: Record<string, string> = {
  role_forbidden: '權限不足，無法操作此邀請。',
  seat_limit: '已達方案席次上限，無法重新產生邀請。',
  not_found: '找不到該邀請，請重新整理後再試。',
  invalid_state: '此邀請目前無法執行該操作。',
  invalid_request: '請求格式有誤。',
  update_failed: '更新失敗，請稍後再試。',
};

function resolveErrorMessage(code: string | undefined, fallback: string | undefined): string {
  if (code && ERROR_MESSAGE[code]) return ERROR_MESSAGE[code];
  return fallback || '操作失敗，請稍後再試。';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function resendLabel(status: Invite['status']): string {
  return status === 'expired' ? '重新產生連結' : '重送邀請';
}

interface PendingAction {
  type: 'revoke' | 'resend';
  invite: Invite;
}

interface GeneratedLink {
  email: string;
  link: string;
  expiresAt: string;
}

export function TeamInvitesTable({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);

  async function runAction() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const { invite, type } = pending;
      const url =
        type === 'revoke'
          ? `/api/saas/team/invites/${invite.id}/revoke`
          : `/api/saas/team/invites/${invite.id}/resend`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        code?: string;
        data?: { invite?: { token?: string; email?: string; expiresAt?: string } };
      };

      if (!response.ok || !payload.success) {
        toast.error(resolveErrorMessage(payload.code, payload.error));
        return;
      }

      if (type === 'revoke') {
        toast.success('已撤銷邀請');
      } else {
        const token = payload.data?.invite?.token;
        const expiresAt = payload.data?.invite?.expiresAt ?? invite.expiresAt;
        if (token) {
          setGenerated({
            email: invite.email,
            link: `${window.location.origin}/invite/${token}`,
            expiresAt,
          });
          setCopied(false);
        }
        toast.success('已重新產生邀請連結，舊連結已失效');
      }

      setPending(null);
      router.refresh();
    } catch {
      toast.error('操作失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyGenerated() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.link);
      setCopied(true);
      toast.success('已複製邀請連結');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('複製失敗，請手動選取連結複製');
    }
  }

  const confirmTitle = pending?.type === 'revoke' ? '撤銷邀請' : '重新產生邀請連結';
  const confirmDescription = pending
    ? pending.type === 'revoke'
      ? `確定撤銷給「${pending.invite.email}」的邀請嗎？撤銷後該邀請連結將立即失效，對方將無法再加入。`
      : `系統會為「${pending.invite.email}」產生新的邀請連結，舊連結將立即失效。確定要繼續嗎？`
    : undefined;

  return (
    <>
      <Table className="min-w-[640px]">
        <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>到期</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => {
              const rowBusy = submitting && pending?.invite.id === invite.id;
              const hasAction = invite.actions.canResend || invite.actions.canRevoke;
              return (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABEL[invite.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {STATUS_LABEL[invite.status]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invite.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {invite.actions.canResend ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() => setPending({ type: 'resend', invite })}
                        >
                          <RefreshCw className="size-4" aria-hidden="true" />
                          {resendLabel(invite.status)}
                        </Button>
                      ) : null}
                      {invite.actions.canRevoke ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={rowBusy}
                          onClick={() => setPending({ type: 'revoke', invite })}
                        >
                          <XCircle className="size-4" aria-hidden="true" />
                          撤銷
                        </Button>
                      ) : null}
                      {!hasAction ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title={translateTeamReason(invite.actions.disabledReason)}
                        >
                          —
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        destructive={pending?.type === 'revoke'}
        confirmLabel={pending?.type === 'revoke' ? '撤銷' : '重新產生'}
        pending={submitting}
        onConfirm={runAction}
      />

      <Dialog
        open={generated !== null}
        onOpenChange={(next) => {
          if (!next) setGenerated(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新的邀請連結</DialogTitle>
            {generated ? (
              <DialogDescription>
                已為 {generated.email} 產生新連結，有效至{' '}
                {formatDate(generated.expiresAt)}。舊連結已失效，請複製新連結傳送給對方。
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {generated ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-3 py-2 text-xs">
                {generated.link}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyGenerated}>
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                <span className="ml-1">{copied ? '已複製' : '複製'}</span>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
