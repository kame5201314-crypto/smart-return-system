'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Inbox, UserCog, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import type { TeamSettingsView } from '@/lib/saas/ui-backend-contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type Member = TeamSettingsView['members'][number];
type AssignableRole = 'admin' | 'staff' | 'viewer';

const ROLE_LABEL: Record<Member['role'], string> = {
  owner: '擁有者',
  admin: '管理員',
  staff: '作業成員',
  viewer: '檢視者',
};

const STATUS_LABEL: Record<Member['status'], string> = {
  active: '已加入',
  invited: '邀請中',
  disabled: '已停用',
};

const ASSIGNABLE_ROLES: ReadonlyArray<{ value: AssignableRole; label: string }> = [
  { value: 'admin', label: '管理員' },
  { value: 'staff', label: '作業成員' },
  { value: 'viewer', label: '檢視者' },
];

const ERROR_MESSAGE: Record<string, string> = {
  role_forbidden: '權限不足，無法調整此成員。',
  self_demotion: '無法調整自己的角色。',
  self_disable: '無法停用自己。',
  last_owner: '組織必須至少保留一位擁有者。',
  seat_limit: '已達方案席次上限。',
  not_found: '找不到該成員，請重新整理後再試。',
  invalid_state: '此成員目前無法執行該操作。',
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

interface PendingAction {
  type: 'role' | 'disable';
  member: Member;
  nextRole?: AssignableRole;
}

export function TeamMembersTable({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Inbox className="size-6" aria-hidden="true" />
        尚無成員資料。
      </div>
    );
  }

  async function runAction() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const { member, type, nextRole } = pending;
      const url =
        type === 'role'
          ? `/api/saas/team/members/${member.id}`
          : `/api/saas/team/members/${member.id}/disable`;
      const init: RequestInit =
        type === 'role'
          ? {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: nextRole }),
            }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            };

      const response = await fetch(url, init);
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        code?: string;
      };

      if (!response.ok || !payload.success) {
        toast.error(resolveErrorMessage(payload.code, payload.error));
        return;
      }

      toast.success(type === 'role' ? '已更新成員角色' : '已停用成員');
      setPending(null);
      router.refresh();
    } catch {
      toast.error('操作失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  const confirmTitle =
    pending?.type === 'disable' ? '停用成員' : '變更成員角色';
  const confirmDescription = pending
    ? pending.type === 'disable'
      ? `確定停用「${pending.member.email}」嗎？停用後該成員將無法登入與存取，可日後重新邀請。`
      : `確定將「${pending.member.email}」的角色變更為「${
          pending.nextRole ? ROLE_LABEL[pending.nextRole] : ''
        }」嗎？`
    : undefined;

  return (
    <>
      <Table className="min-w-[680px]">
        <TableHeader>
            <TableRow>
              <TableHead>成員</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>加入時間</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const rowBusy = submitting && pending?.member.id === member.id;
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.displayName
                      ? `${member.displayName}（${member.email}）`
                      : member.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{ROLE_LABEL[member.role]}</Badge>
                      {member.actions.canChangeRole ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={rowBusy}
                              aria-label={`變更 ${member.email} 的角色`}
                            >
                              <UserCog className="size-4" aria-hidden="true" />
                              <span className="hidden sm:inline">變更角色</span>
                              <ChevronDown className="size-3.5" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>設為角色</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {ASSIGNABLE_ROLES.map((role) => (
                              <DropdownMenuItem
                                key={role.value}
                                disabled={member.role === role.value}
                                onSelect={() => {
                                  if (member.role === role.value) return;
                                  setPending({ type: 'role', member, nextRole: role.value });
                                }}
                              >
                                {role.label}
                                {member.role === role.value ? (
                                  <span className="ml-auto text-xs text-muted-foreground">目前</span>
                                ) : null}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : member.actions.disabledReason ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title={translateTeamReason(member.actions.disabledReason)}
                        >
                          不可調整
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {STATUS_LABEL[member.status]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(member.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.actions.canDisable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={rowBusy}
                        onClick={() => setPending({ type: 'disable', member })}
                      >
                        <UserMinus className="size-4" aria-hidden="true" />
                        停用
                      </Button>
                    ) : (
                      <span
                        className="text-xs text-muted-foreground"
                        title={translateTeamReason(member.actions.disabledReason)}
                      >
                        —
                      </span>
                    )}
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
        destructive={pending?.type === 'disable'}
        confirmLabel={pending?.type === 'disable' ? '停用' : '變更角色'}
        pending={submitting}
        onConfirm={runAction}
      />
    </>
  );
}
