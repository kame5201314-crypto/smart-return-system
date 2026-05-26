'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface TenantPreviewExitButtonProps {
  exitPath: string;
}

export function TenantPreviewExitButton({ exitPath }: TenantPreviewExitButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleExit() {
    try {
      setSubmitting(true);
      const response = await fetch('/api/internal/saas/tenant-preview', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string }; message?: string }
          | null;
        const message =
          payload?.error?.message || payload?.message || '無法結束租戶查看，請稍後再試。';
        toast.error(message);
        return;
      }

      router.push(exitPath);
      router.refresh();
    } catch {
      toast.error('結束查看時發生錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      disabled={submitting}
      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-orange-900 shadow-sm transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-3.5" aria-hidden="true" />
      )}
      結束查看
    </button>
  );
}
