'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardPenLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PlatformOrgNoteType } from '@/lib/saas/platform-org-notes';

export function OrgOperationsNoteForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [noteType, setNoteType] = useState<PlatformOrgNoteType>('contact');
  const [note, setNote] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submitNote() {
    const normalizedNote = note.trim();
    if (normalizedNote.length < 4) {
      toast.error('紀錄內容至少需要 4 個字。');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/internal/saas/orgs/${orgId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType,
          note: normalizedNote,
          followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!response.ok || payload?.success !== true) {
        toast.error(payload?.error || '營運紀錄儲存失敗。');
        return;
      }

      toast.success('營運紀錄已儲存。');
      setOpen(false);
      setNoteType('contact');
      setNote('');
      setFollowUpAt('');
      router.refresh();
    } catch {
      toast.error('營運紀錄儲存失敗。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        title="記錄聯絡內容與下次跟進時間"
      >
        <ClipboardPenLine className="size-4" aria-hidden="true" />
        新增營運紀錄
      </Button>
      <Dialog open={open} onOpenChange={(value) => { if (!submitting) setOpen(value); }}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>新增營運紀錄</DialogTitle>
            <DialogDescription>
              記錄與「{orgName}」的聯絡內容、內部備註或下次跟進時間。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-note-type">紀錄類型</Label>
              <select
                id="org-note-type"
                value={noteType}
                onChange={(event) => setNoteType(event.target.value as PlatformOrgNoteType)}
                disabled={submitting}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="contact">客戶聯絡</option>
                <option value="follow_up">後續跟進</option>
                <option value="internal">內部備註</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-note-content">紀錄內容</Label>
              <Textarea
                id="org-note-content"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="例：已電話聯絡，客戶希望下週確認成長版方案。"
                maxLength={1000}
                rows={5}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">{note.length} / 1000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-note-follow-up">下次跟進時間（選填）</Label>
              <Input
                id="org-note-follow-up"
                type="datetime-local"
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="button" onClick={submitNote} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              儲存紀錄
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
