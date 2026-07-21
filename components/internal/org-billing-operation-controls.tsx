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
    title: '停權租戶',
    description: '停權後，租戶會立即轉為唯讀，客戶仍可登入查看既有資料。',
    buttonLabel: '停權租戶',
    confirmLabel: '確認停權',
    successMessage: '租戶已停權（唯讀）',
    placeholder: '例：試用到期未續約，先停權並等待客戶回覆。',
  },
  resume_org: {
    title: '恢復使用權限',
    description: '恢復後，此租戶會回到使用中狀態，可重新新增退貨、執行 AI 分析與匯出資料。',
    buttonLabel: '恢復使用權限',
    confirmLabel: '確認恢復',
    successMessage: '已恢復租戶使用權限',
    placeholder: '例：已確認續約或補款，恢復服務。',
  },
};

export function resolveMinimumManualPaymentEndDate(now = new Date()): string {
  const taipeiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.UTC(
    taipeiNow.getUTCFullYear(),
    taipeiNow.getUTCMonth(),
    taipeiNow.getUTCDate() + 1
  ));
  return tomorrow.toISOString().slice(0, 10);
}

export function toTaipeiBillingBoundary(date: string): string {
  return `${date}T00:00:00+08:00`;
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
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountTwd, setAmountTwd] = useState(suggestedAmountTwd ? String(suggestedAmountTwd) : '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState<string | null>(null);
  const [paymentEffectiveAt, setPaymentEffectiveAt] = useState<string | null>(null);

  if (!canManageBillingOperations) {
    return null;
  }

  const currentOperation: BillingOperation | null =
    status === 'cancelled' ? null : status === 'suspended' ? 'resume_org' : 'suspend_org';
  const copy = operation ? OPERATION_COPY[operation] : null;

  function openManualPaymentDialog() {
    setPaymentIdempotencyKey(`internal-manual-payment-${orgId}-${crypto.randomUUID()}`);
    setPaymentEffectiveAt(new Date().toISOString());
    setPaymentOpen(true);
  }

  function closeManualPaymentDialog() {
    setPaymentOpen(false);
    setPaymentIdempotencyKey(null);
    setPaymentEffectiveAt(null);
  }

  async function submitOperation() {
    if (!operation || !copy) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 4) {
      setReasonError('請填寫清楚的操作原因，至少 4 個字。');
      return;
    }
    setReasonError(null);

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
      setReasonError(null);
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
      const effectiveAt = paymentEffectiveAt ?? new Date().toISOString();
      if (!paymentIdempotencyKey) {
        setPaymentIdempotencyKey(idempotencyKey);
      }
      if (!paymentEffectiveAt) {
        setPaymentEffectiveAt(effectiveAt);
      }
      const response = await fetch('/api/internal/saas/billing/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'mark_manual_payment',
          orgId,
          amountTwd: amount,
          paidAt: effectiveAt,
          periodStart: periodStart ? toTaipeiBillingBoundary(periodStart) : null,
          periodEnd: toTaipeiBillingBoundary(periodEnd),
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
      <div className="rounded-md border bg-neutral-50 p-3">
        <p className="text-xs font-medium text-muted-foreground">存取權限</p>
        <p className="mt-2 text-sm font-medium">租戶已取消</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          恢復前請先確認資料保留與帳務處理方式。
        </p>
      </div>
    );
  }

  const currentCopy = OPERATION_COPY[currentOperation];

  return (
    <>
      <div className="rounded-md border bg-neutral-50 p-3">
        <p className="text-xs font-medium text-muted-foreground">帳務續約</p>
        <Button type="button" variant="outline" className="mt-2 w-full bg-white" onClick={openManualPaymentDialog}>
          <Banknote className="size-4" aria-hidden="true" />
          記錄人工付款
        </Button>
      </div>
      <div className={currentOperation === 'suspend_org' ? 'rounded-md border border-red-200 bg-red-50 p-3' : 'rounded-md border border-emerald-200 bg-emerald-50 p-3'}>
        <p className={currentOperation === 'suspend_org' ? 'text-xs font-medium text-red-800' : 'text-xs font-medium text-emerald-800'}>
          存取權限
        </p>
        <Button
          type="button"
          className="mt-2 w-full"
          variant={currentOperation === 'suspend_org' ? 'destructive' : 'default'}
          onClick={() => {
            setReason('');
            setReasonError(null);
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

      <Dialog
        open={operation !== null}
        onOpenChange={(open) => {
          if (submitting) return;
          if (!open) {
            setOperation(null);
            setReason('');
            setReasonError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <div className={operation === 'suspend_org'
            ? 'rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900'
            : 'rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900'}>
            <p className="font-medium">{operation === 'suspend_org' ? '停權後的影響' : '恢復後的影響'}</p>
            {operation === 'suspend_org' ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                <li>客戶仍可登入並查看既有資料。</li>
                <li>禁止新增、匯入、匯出與 AI 分析。</li>
                <li>既有客戶資料不會刪除。</li>
              </ul>
            ) : (
              <p className="mt-2 text-xs leading-5">
                客戶可重新新增與匯入退貨資料、匯出資料，並在方案額度內使用 AI 分析。
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-operation-reason">操作原因</Label>
            <Textarea
              id="billing-operation-reason"
              value={reason}
              onChange={(event) => {
                const nextReason = event.target.value;
                setReason(nextReason);
                if (nextReason.trim().length >= 4) setReasonError(null);
              }}
              placeholder={copy?.placeholder}
              disabled={submitting}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? 'billing-operation-reason-error' : 'billing-operation-reason-help'}
              rows={4}
            />
            {reasonError ? (
              <p id="billing-operation-reason-error" className="text-xs font-medium text-red-700" role="alert">
                {reasonError}
              </p>
            ) : (
              <p id="billing-operation-reason-help" className="text-xs text-muted-foreground">
                原因會寫入操作紀錄，供後續追蹤與客戶溝通使用。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOperation(null);
                setReason('');
                setReasonError(null);
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
