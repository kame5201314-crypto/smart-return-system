'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  MailCheck,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InviteAcceptanceView } from '@/lib/saas/invite-acceptance-live-data';

const ROLE_LABEL: Record<string, string> = {
  owner: '擁有者',
  admin: '管理員',
  staff: '作業人員',
  viewer: '檢視者',
};

function formatDate(value: string | null): string {
  if (!value) return '未設定';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未設定';

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function NoticeCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className={`flex size-14 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          {children ? <div className="mt-1 text-sm text-muted-foreground">{children}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function InviteAcceptPanel({ data, token }: { data: InviteAcceptanceView; token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const { invite, organization, viewer } = data;
  const orgName = organization?.name ?? '此組織';
  const roleCode = invite.role ?? 'viewer';
  const roleLabel = ROLE_LABEL[roleCode] ?? roleCode;
  const loginHref = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  if (invite.inviteStatus === 'expired') {
    return (
      <NoticeCard icon={Clock} tone="bg-amber-50 text-amber-600" title="邀請已逾期">
        這個邀請連結已超過有效期限。請聯絡 {orgName} 的 Owner 或 Admin 重新發送邀請。
      </NoticeCard>
    );
  }

  if (invite.inviteStatus === 'revoked') {
    return (
      <NoticeCard icon={AlertCircle} tone="bg-red-50 text-red-600" title="邀請已撤銷">
        這個邀請已被撤銷。請聯絡 {orgName} 的 Owner 或 Admin 確認團隊權限。
      </NoticeCard>
    );
  }

  if (accepted) {
    return (
      <NoticeCard icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" title={`已加入 ${orgName}`}>
        系統正在帶你前往後台。
      </NoticeCard>
    );
  }

  async function handleAccept() {
    setSubmitting(true);

    try {
      const response = await fetch('/api/saas/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        toast.error(payload.error || '接受邀請失敗。');
        return;
      }

      setAccepted(true);
      toast.success('已接受邀請。');
      setTimeout(() => {
        router.push('/analytics');
        router.refresh();
      }, 1200);
    } catch {
      toast.error('接受邀請失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="size-5 text-emerald-700" />
          加入 {orgName}
        </CardTitle>
        <CardDescription>請確認邀請資訊。接受後會以此角色加入團隊。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">組織</div>
            <div className="mt-1 font-medium">{orgName}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">角色</div>
            <div className="mt-1">
              <Badge variant="outline">{roleLabel}</Badge>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">邀請 Email</div>
            <div className="mt-1 font-medium">{invite.email}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">有效期限</div>
            <div className="mt-1 font-medium">{formatDate(invite.expiresAt)}</div>
          </div>
        </div>

        {viewer.state === 'can_accept' ? (
          <Button onClick={handleAccept} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
            接受邀請
          </Button>
        ) : null}

        {viewer.state === 'needs_login' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              請先使用邀請 Email（{invite.email}）登入，登入後即可接受邀請。
            </p>
            <Button asChild className="w-full sm:w-auto">
              <Link href={loginHref}>
                <LogIn className="mr-2 size-4" />
                前往登入
              </Link>
            </Button>
          </div>
        ) : null}

        {viewer.state === 'email_mismatch' ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>
              這個邀請指定給 <span className="font-medium">{invite.email}</span>，目前登入帳號是{' '}
              <span className="font-medium">{viewer.userEmail ?? '未知帳號'}</span>。
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={loginHref}>改用邀請 Email 登入</Link>
            </Button>
          </div>
        ) : null}

        {viewer.state === 'already_member' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">你已經是 {orgName} 的成員。</p>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/analytics">前往後台</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
