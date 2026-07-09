'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PauseCircle, PlayCircle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type OrgStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type BillingOperation = 'suspend_org' | 'resume_org';

interface OrgBillingOperationControlsProps {
  orgId: string;
  orgName: string;
  status: OrgStatus;
}

interface OperationResponse {
  success?: boolean;
  error?: string;
  code?: string;
}

const OPERATION_COPY: Record<BillingOperation, {
  title: string;
  description: string;
  buttonLabel: string;
  confirmLabel: string;
  successMessage: string;
  placeholder: string;
}> = {
  suspend_org: {
    title: '暫停租戶',
    description: '暫停後，此租戶將無法新增退貨、執行 AI 分析或匯出資料，但仍可查看既有資料。',
    buttonLabel: '暫停租戶',
    confirmLabel: '確認暫停',
    successMessage: '已暫停租戶',
    placeholder: '例：試用到期未續約，先暫停服務並等待客戶回覆。',
  },
  resume_org: {
    title: '恢復租戶',
    description: '恢復後，此租戶會回到使用中狀態，可重新新增退貨、執行 AI 分析與匯出資料。',
    buttonLabel: '恢復租戶',
    confirmLabel: '確認恢復',
    successMessage: '已恢復租戶',
    placeholder: '例：已確認續約或補款，恢復服務。',
  },
};

function resolveErrorMessage(payload: OperationResponse | null): string {
  if (!payload) return '操作失敗，請稍後再試。';
  if (payload.code === 'permission_denied') return '權限不足，無法執行此操作。';
  if (payload.code === 'invalid_request') return payload.error || '請確認原因與請求內容。';
  return payload.error || '操作失敗，請稍後再試。';
}

export function OrgBillingOperationControls({
  orgId,
  orgName,
  status,
}: OrgBillingOperationControlsProps) {
  const router = useRouter();
  const [operation, setOperation] = useState<BillingOperation | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentOperation: BillingOperation | null =
    status === 'cancelled' ? null : status === 'suspended' ? 'resume_org' : 'suspend_org';
  const copy = operation ? OPERATION_COPY[operation] : null;

  async function submitOperation() {
    if (!operation || !copy) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 4) {
      toast.error('請填寫清楚的操作原因，至少 4 個字。');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/internal/saas/billing/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          orgId,
          reason: normalizedReason,
          metadata: {
            source: 'internal_org_detail',
            orgName,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as OperationResponse | null;

      if (!response.ok || payload?.success !== true) {
        toast.error(resolveErrorMessage(payload));
        return;
      }

      toast.success(copy.successMessage);
      setOperation(null);
      setReason('');
      router.refresh();
    } catch {
      toast.error('操作失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentOperation) {
    return (
      <p className="text-xs text-muted-foreground">
        此租戶已取消；恢復前請先確認資料保留與帳務處理方式。
      </p>
    );
  }

  const currentCopy = OPERATION_COPY[currentOperation];

  return (
    <>
      <Button
        type="button"
        variant={currentOperation === 'suspend_org' ? 'destructive' : 'default'}
        onClick={() => {
          setReason('');
          setOperation(currentOperation);
        }}
      >
        {currentOperation === 'suspend_org' ? (
          <PauseCircle className="size-4" aria-hidden="true" />
        ) : (
          <PlayCircle className="size-4" aria-hidden="true" />
        )}
        {currentCopy.buttonLabel}
      </Button>

      <Dialog
        open={operation !== null}
        onOpenChange={(open) => {
          if (submitting) return;
          if (!open) {
            setOperation(null);
            setReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="billing-operation-reason">操作原因</Label>
            <Textarea
              id="billing-operation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy?.placeholder}
              disabled={submitting}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              原因會寫入 audit log，供後續追蹤與客戶溝通使用。
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOperation(null);
                setReason('');
              }}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant={operation === 'suspend_org' ? 'destructive' : 'default'}
              onClick={submitOperation}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
              {copy?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
