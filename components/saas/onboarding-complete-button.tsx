'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface OnboardingCompleteButtonProps {
  disabled?: boolean;
  disabledReason?: string;
}

export function OnboardingCompleteButton({
  disabled,
  disabledReason,
}: OnboardingCompleteButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    try {
      setSubmitting(true);
      const response = await fetch('/api/saas/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: { message?: string };
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.message || payload?.message || '無法完成設定，請稍後再試。';
        toast.error(message);
        return;
      }

      toast.success('設定指引已完成！');
      router.refresh();
    } catch {
      toast.error('完成設定時發生錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleComplete}
      disabled={disabled || submitting}
      title={disabled ? disabledReason : undefined}
      size="sm"
    >
      {submitting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCircle2 className="size-4" />
      )}
      完成設定
    </Button>
  );
}
