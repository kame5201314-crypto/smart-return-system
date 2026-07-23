'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CircleDollarSign, Loader2, Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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

type CustomPlanOfferStatus = 'active' | 'paid' | 'cancelled' | 'expired';

interface CustomPlanOfferDto {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  amountTwd: number;
  billingPeriodMonths: number;
  status: CustomPlanOfferStatus;
  expiresAt: string;
  paymentOrderId: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

interface CustomPlanOfferApiResponse {
  success?: boolean;
  data?: {
    offers?: CustomPlanOfferDto[];
    offer?: CustomPlanOfferDto;
  };
  error?: string;
  code?: string;
}

interface CustomPlanOfferControlsProps {
  orgId: string;
  orgName: string;
  canManageBillingOperations: boolean;
}

const MIN_OFFER_LIFETIME_MS = 61 * 60 * 1000;
const MAX_OFFER_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<CustomPlanOfferStatus, string> = {
  active: '待客戶付款',
  paid: '已付款',
  cancelled: '已取消',
  expired: '已到期',
};

function statusClass(status: CustomPlanOfferStatus): string {
  if (status === 'active') return 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50';
  if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50';
  return 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-50';
}

function statusLabel(offer: CustomPlanOfferDto): string {
  return offer.status === 'expired' && offer.paymentOrderId
    ? '付款已關閉'
    : STATUS_LABEL[offer.status];
}

function formatTwd(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function defaultExpiryLocal(now = new Date()): string {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);
  expiresAt.setMinutes(0, 0, 0);
  const offset = expiresAt.getTimezoneOffset() * 60_000;
  return new Date(expiresAt.getTime() - offset).toISOString().slice(0, 16);
}

function resolveApiError(payload: CustomPlanOfferApiResponse | null): string {
  if (payload?.code === 'permission_denied') return '權限不足，無法管理客製報價。';
  if (payload?.code === 'feature_disabled') return 'AI退貨管理系統目前未啟用此功能。';
  if (payload?.code === 'invalid_request') return '請檢查報價名稱、金額、付款期限與取消原因。';
  if (payload?.code === 'offer_not_found') return '找不到這筆客製報價，請重新載入。';
  if (payload?.code === 'offer_unavailable') return '這筆報價已付款、取消或到期，無法再操作。';
  if (payload?.code === 'offer_conflict') return '這筆報價已有付款流程，請先確認付款狀態。';
  return '客製報價操作失敗，請稍後再試。';
}

export function CustomPlanOfferControls({
  orgId,
  orgName,
  canManageBillingOperations,
}: CustomPlanOfferControlsProps) {
  const [offers, setOffers] = useState<CustomPlanOfferDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('朋友專屬優惠');
  const [description, setDescription] = useState('指定帳號優惠價 NT$100；付款後提供一個月 AI 退貨管理系統使用權。');
  const [amountTwd, setAmountTwd] = useState('100');
  const [expiresAt, setExpiresAt] = useState(() => defaultExpiryLocal());
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [cancelOffer, setCancelOffer] = useState<CustomPlanOfferDto | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/internal/saas/custom-plan-offers?orgId=${encodeURIComponent(orgId)}`,
        { method: 'GET', cache: 'no-store' }
      );
      const payload = await response.json().catch(() => null) as CustomPlanOfferApiResponse | null;
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.data?.offers)) {
        setLoadError(resolveApiError(payload));
        return;
      }
      setOffers(payload.data.offers);
    } catch {
      setLoadError('客製報價載入失敗，請重新整理後再試。');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (canManageBillingOperations) {
      void loadOffers();
    }
  }, [canManageBillingOperations, loadOffers]);

  if (!canManageBillingOperations) {
    return null;
  }

  function resetCreateForm() {
    setTitle('朋友專屬優惠');
    setDescription('指定帳號優惠價 NT$100；付款後提供一個月 AI 退貨管理系統使用權。');
    setAmountTwd('100');
    setExpiresAt(defaultExpiryLocal());
    setTermsConfirmed(false);
  }

  async function submitCreate() {
    const amount = Number(amountTwd);
    if (title.trim().length < 2) {
      toast.error('報價名稱至少需要 2 個字。');
      return;
    }
    if (!Number.isInteger(amount) || amount < 5 || amount > 199_999) {
      toast.error('報價金額需為 NT$5 至 NT$199,999 的整數。');
      return;
    }
    const parsedExpiry = new Date(expiresAt);
    if (!expiresAt || Number.isNaN(parsedExpiry.getTime())) {
      toast.error('請設定有效的報價付款期限。');
      return;
    }
    const offerLifetimeMs = parsedExpiry.getTime() - Date.now();
    if (offerLifetimeMs < MIN_OFFER_LIFETIME_MS) {
      toast.error('報價付款期限至少需設定為 1 小時 1 分鐘後。');
      return;
    }
    if (offerLifetimeMs > MAX_OFFER_LIFETIME_MS) {
      toast.error('報價付款期限最長只能設定在 90 天內。');
      return;
    }
    if (!termsConfirmed) {
      toast.error('請先確認此報價的付款與使用期間。');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/internal/saas/custom-plan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          title: title.trim(),
          description: description.trim() || null,
          amountTwd: amount,
          expiresAt: parsedExpiry.toISOString(),
        }),
      });
      const payload = await response.json().catch(() => null) as CustomPlanOfferApiResponse | null;
      if (!response.ok || payload?.success !== true) {
        toast.error(resolveApiError(payload));
        return;
      }

      toast.success('客製報價已建立，客戶可在帳務頁查看並付款。');
      setCreateOpen(false);
      resetCreateForm();
      await loadOffers();
    } catch {
      toast.error('客製報價建立失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCancel() {
    if (!cancelOffer) return;
    const reason = cancelReason.trim();
    if (reason.length < 4) {
      toast.error('請填寫至少 4 個字的取消原因。');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/internal/saas/custom-plan-offers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: cancelOffer.id, reason }),
      });
      const payload = await response.json().catch(() => null) as CustomPlanOfferApiResponse | null;
      if (!response.ok || payload?.success !== true) {
        toast.error(resolveApiError(payload));
        return;
      }

      toast.success('客製報價已取消。');
      setCancelOffer(null);
      setCancelReason('');
      await loadOffers();
    } catch {
      toast.error('客製報價取消失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm" aria-labelledby="custom-plan-offers-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h3 id="custom-plan-offers-title" className="flex items-center gap-2 text-lg font-semibold">
            <CircleDollarSign className="size-5 text-emerald-700" aria-hidden="true" />
            指定帳號優惠
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            僅「{orgName}」的 Owner／Admin 可在帳務頁看到。每次付款取得一個月使用期，不會自動續扣。
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={submitting}
          className="shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
          建立客製報價
        </Button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 rounded-md border bg-neutral-50 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          正在載入客製報價…
        </div>
      ) : loadError ? (
        <div className="mt-5 flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadOffers()}>
            重新載入
          </Button>
        </div>
      ) : offers.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed bg-neutral-50 p-5 text-sm text-muted-foreground">
          尚未建立客製報價。建立後，只有此租戶的 Owner／Admin 能在帳務頁查看與付款。
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {offers.map((offer) => (
            <article key={offer.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium">{offer.title}</h4>
                  <p className="mt-1 text-2xl font-semibold">{formatTwd(offer.amountTwd)}</p>
                  <p className="text-xs text-muted-foreground">一次預付 1 個月 · 不自動續扣</p>
                </div>
                <Badge variant="outline" className={statusClass(offer.status)}>
                  {statusLabel(offer)}
                </Badge>
              </div>
              {offer.description ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {offer.description}
                </p>
              ) : null}
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden="true" />
                付款期限：{formatDateTime(offer.expiresAt)}
              </div>
              {offer.status === 'active' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 text-red-700 hover:text-red-800"
                  onClick={() => {
                    setCancelReason('');
                    setCancelOffer(offer);
                  }}
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  取消報價
                </Button>
              ) : null}
              {offer.status === 'cancelled' && offer.cancellationReason ? (
                <p className="mt-3 text-xs text-muted-foreground">取消原因：{offer.cancellationReason}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (submitting) return;
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-xl" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>設定指定帳號優惠</DialogTitle>
            <DialogDescription>
              優惠只會顯示給「{orgName}」。金額由後端保存，客戶端無法自行修改；本次付款提供一個月使用期。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="custom-offer-title">報價名稱</Label>
              <Input
                id="custom-offer-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-offer-description">方案說明（選填）</Label>
              <Textarea
                id="custom-offer-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={4}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">{description.length} / 500</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="custom-offer-amount">一次付款金額（NT$）</Label>
                <Input
                  id="custom-offer-amount"
                  type="number"
                  min={5}
                  max={199999}
                  step={1}
                  value={amountTwd}
                  onChange={(event) => setAmountTwd(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-offer-expires-at">付款期限</Label>
                <Input
                  id="custom-offer-expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">付款期限需設定在 1 小時 1 分鐘後至 90 天內。</p>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              <input
                type="checkbox"
                checked={termsConfirmed}
                onChange={(event) => setTermsConfirmed(event.target.checked)}
                disabled={submitting}
                className="mt-1 size-4"
              />
              <span>
                我已確認：此報價是一次預付一個月，不會自動續扣；付款後依基本版權限開通一個月。
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              返回檢查
            </Button>
            <Button type="button" onClick={submitCreate} disabled={submitting || !termsConfirmed}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              確認建立報價
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelOffer !== null}
        onOpenChange={(open) => {
          if (submitting) return;
          if (!open) {
            setCancelOffer(null);
            setCancelReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!submitting}>
          <DialogHeader>
            <DialogTitle>確認取消客製報價</DialogTitle>
            <DialogDescription>
              取消後客戶不能再付款，且此操作會保留在紀錄中。已付款的報價不可取消。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-neutral-50 p-3 text-sm">
            <p className="font-medium">{cancelOffer?.title}</p>
            <p className="mt-1 text-muted-foreground">
              {cancelOffer ? formatTwd(cancelOffer.amountTwd) : '—'} · 一次預付 1 個月
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-offer-cancel-reason">取消原因</Label>
            <Textarea
              id="custom-offer-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="例：客戶需求調整，等待重新報價。"
              maxLength={500}
              rows={4}
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOffer(null)} disabled={submitting}>
              保留報價
            </Button>
            <Button type="button" variant="destructive" onClick={submitCancel} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              確認取消報價
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
