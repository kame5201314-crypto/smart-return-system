'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type OrgStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type BillingOperation = 'suspend_org' | 'resume_org';

interface OrgBillingOperationControlsProps {
  orgId: string;
  orgName: string;
  status: OrgStatus;
  suggestedAmountTwd?: number | null;
  canManageBillingOperations: boolean;
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

export function resolveMinimumManualPaymentEndDate(now = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

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
  suggestedAmountTwd,
  canManageBillingOperations,
}: OrgBillingOperationControlsProps) {
  const router = useRouter();
  const [operation, setOperation] = useState<BillingOperation | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountTwd, setAmountTwd] = useState(suggestedAmountTwd ? String(suggestedAmountTwd) : '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);

  if (!canManageBillingOperations) {
    return null;
  }

  const currentOperation: BillingOperation | null =
    status === 'cancelled' ? null : status === 'suspended' ? 'resume_org' : 'suspend_org';
  const copy = operation ? OPERATION_COPY[operation] : null;

  function openManualPaymentDialog() {
    setPaymentIdempotencyKey(`internal-manual-payment-${orgId}-${crypto.randomUUID()}`);
    setPaymentOpen(true);
  }

  function closeManualPaymentDialog() {
    setPaymentOpen(false);
    setPaymentIdempotencyKey(null);
  }

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

  async function submitManualPayment() {
    const amount = Number(amountTwd);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('請填寫正確的付款金額。');
      return;
    }
    if (!periodEnd) {
      toast.error('請填寫服務到期日。');
      return;
    }
    if (periodStart && periodEnd <= periodStart) {
      toast.error('服務到期日必須晚於開始日。');
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = paymentIdempotencyKey ??
        `internal-manual-payment-${orgId}-${crypto.randomUUID()}`;
      if (!paymentIdempotencyKey) {
        setPaymentIdempotencyKey(idempotencyKey);
      }
      const response = await fetch('/api/internal/saas/billing/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'mark_manual_payment',
          orgId,
          amountTwd: amount,
          periodStart: periodStart ? `${periodStart}T00:00:00.000Z` : null,
          periodEnd: `${periodEnd}T00:00:00.000Z`,
          reason: paymentNote.trim() || null,
          idempotencyKey,
          metadata: {
            source: 'internal_org_detail',
            orgName,
            paymentMethod: 'manual',
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as OperationResponse | null;
      if (!response.ok || payload?.success !== true) {
        toast.error(resolveErrorMessage(payload));
        return;
      }

      toast.success('已記錄人工付款並更新服務期間。');
      closeManualPaymentDialog();
      setPeriodStart('');
      setPeriodEnd('');
      setPaymentNote('');
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border bg-neutral-50 p-3">
          <p className="text-xs font-medium text-muted-foreground">日常帳務</p>
          <Button type="button" variant="outline" className="mt-2 w-full bg-white" onClick={openManualPaymentDialog}>
            <Banknote className="size-4" aria-hidden="true" />
            記錄人工付款
          </Button>
        </div>
        <div className={currentOperation === 'suspend_org' ? 'rounded-md border border-red-200 bg-red-50 p-3' : 'rounded-md border border-emerald-200 bg-emerald-50 p-3'}>
          <p className={currentOperation === 'suspend_org' ? 'text-xs font-medium text-red-800' : 'text-xs font-medium text-emerald-800'}>
            租戶狀態操作
          </p>
          <Button
            type="button"
            className="mt-2 w-full"
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
        </div>
      </div>

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

      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          if (submitting) return;
          if (open) {
            setPaymentOpen(true);
          } else {
            closeManualPaymentDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>記錄人工付款</DialogTitle>
            <DialogDescription>
              僅用於已確認收到的匯款或人工收款。送出後會更新服務期間並留下操作紀錄。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-payment-amount">付款金額（NT$）</Label>
              <Input
                id="manual-payment-amount"
                type="number"
                min={1}
                step={1}
                value={amountTwd}
                onChange={(event) => setAmountTwd(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-payment-period-start">服務開始日（選填）</Label>
              <Input
                id="manual-payment-period-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-payment-period-end">服務到期日</Label>
              <Input
                id="manual-payment-period-end"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                min={resolveMinimumManualPaymentEndDate()}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-payment-note">備註（選填）</Label>
              <Textarea
                id="manual-payment-note"
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder="例：2026 年 7 月銀行轉帳，已人工核對。"
                disabled={submitting}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeManualPaymentDialog} disabled={submitting}>
              取消
            </Button>
            <Button type="button" onClick={submitManualPayment} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
              確認已收款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
