'use client';

import { useState, type FormEvent } from 'react';
import { Check, Copy, Loader2, MailPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translateTeamReason } from '@/components/saas/team-reason-text';

type InviteRole = 'admin' | 'staff' | 'viewer';

interface InviteSuccess {
  email: string;
  role: string;
  expiresAt: string;
  link: string;
}

interface TeamInviteFormProps {
  canInvite: boolean;
  disabledReason?: string;
}

const ROLE_LABEL: Record<InviteRole, string> = {
  admin: '管理員',
  staff: '作業成員',
  viewer: '檢視者',
};

export function TeamInviteForm({ canInvite, disabledReason }: TeamInviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('staff');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  const disabled = !canInvite || submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error('請輸入 Email');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/saas/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: { email: string; role: string; token: string; expiresAt: string };
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        toast.error(payload.error || '建立邀請失敗');
        return;
      }

      const link = `${window.location.origin}/invite/${payload.data.token}`;
      setResult({
        email: payload.data.email,
        role: payload.data.role,
        expiresAt: payload.data.expiresAt,
        link,
      });
      setEmail('');
      toast.success('邀請已建立');
    } catch {
      toast.error('建立邀請失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      toast.success('已複製邀請連結');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('複製失敗，請手動選取連結複製');
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label htmlFor="invite-role">角色</Label>
          <Select value={role} onValueChange={(value) => setRole(value as InviteRole)} disabled={disabled}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as InviteRole[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {ROLE_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={disabled}
          title={!canInvite ? translateTeamReason(disabledReason) : undefined}
        >
          {submitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <MailPlus className="mr-2 size-4" />
          )}
          建立邀請
        </Button>
      </form>

      {!canInvite && disabledReason ? (
        <p className="text-xs text-muted-foreground">{translateTeamReason(disabledReason)}</p>
      ) : null}

      {result ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            已為 {result.email}（{ROLE_LABEL[result.role as InviteRole] ?? result.role}）建立邀請，連結有效至{' '}
            {new Date(result.expiresAt).toLocaleDateString('zh-TW')}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            請複製下方邀請連結傳送給對方：
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-3 py-2 text-xs">{result.link}</code>
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span className="ml-1">{copied ? '已複製' : '複製'}</span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
