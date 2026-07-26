'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface StartTenantPreviewButtonProps {
  orgId: string;
  orgName: string;
}

interface PreviewStartSuccess {
  success: true;
  data: {
    orgId: string;
    orgName: string;
    orgSlug: string | null;
    adminUserId: string;
    platformRole: string;
    previewPath: string;
    expiresAt: string;
    auditLogId: string | null;
  };
}

interface PreviewStartFailure {
  success?: false;
  error?: { message?: string };
  message?: string;
}

type PreviewStartPayload = PreviewStartSuccess | PreviewStartFailure;

export function StartTenantPreviewButton({
  orgId,
  orgName,
}: StartTenantPreviewButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleStart() {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/internal/saas/orgs/${orgId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as PreviewStartPayload | null;

      if (!response.ok || !payload || payload.success !== true) {
        const failure = (payload ?? {}) as PreviewStartFailure;
        const message =
          failure.error?.message || failure.message || '無法以租戶身分查看，請稍後再試。';
        toast.error(message);
        return;
      }

      toast.success(`已切換至「${payload.data.orgName}」唯讀檢視`);
      router.push(payload.data.previewPath);
      router.refresh();
    } catch {
      toast.error('啟動租戶查看時發生錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleStart}
      disabled={submitting}
      variant="default"
      title={`以「${orgName}」身分唯讀查看 1 小時，不會修改客戶資料`}
    >
      {submitting ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Eye className="size-4" aria-hidden="true" />
      )}
      以此租戶身分查看
    </Button>
  );
}
