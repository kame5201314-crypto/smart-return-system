'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  SAAS_PLAN_DEFINITIONS,
  SAAS_SELF_SERVICE_PLAN_CODE,
  type SelfServiceSaaSPlanCode,
} from '@/lib/config/saas-plans';
import {
  formatSaaSBillingDate,
  formatSaaSBillingDateTime,
} from '@/lib/saas/billing-date';
import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

export type BillingPaymentQueryState =
  | 'success'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'review'
  | 'expired'
  | 'refunded';

interface ProviderSubmission {
  action: string;
  fields: Record<string, string>;
}

interface BillingPlanSelectorProps {
  data: BillingSettingsView;
  paymentState: BillingPaymentQueryState | null;
  paymentTradeNo?: string | null;
  requestedPlan?: SelfServiceSaaSPlanCode | null;
}

type PolledPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'manual_review'
  | 'expired'
  | 'cancelled'
  | 'refunded';

const PAYMENT_POLL_INTERVAL_MS = 2_000;
const PAYMENT_POLL_MAX_ATTEMPTS = 15;
const CHECKOUT_REQUEST_TIMEOUT_MS = 10_000;
const CHECKOUT_GENERIC_ERROR_MESSAGE = '目前無法建立付款流程，請稍後再試。';

const PLAN_SUMMARY = '包含退貨管理、蝦皮匯入、基本報表與每月 10 次 AI 分析。';

const PAYMENT_STATE_COPY: Record<
  BillingPaymentQueryState,
  { title: string; message: string; tone: 'success' | 'warning' | 'error' }
> = {
  success: {
    title: '付款結果已送出',
    message: '系統正在確認付款與訂閱狀態；請以本頁的目前方案及付款紀錄為準。',
    tone: 'success',
  },
  pending: {
    title: '付款確認中',
    message: '付款平台仍在處理結果，稍後重新整理即可查看最新訂閱狀態。',
    tone: 'warning',
  },
  failed: {
    title: '付款未完成',
    message: '本次付款沒有成功，方案與使用期限不會變更；你可以重新選擇方案付款。',
    tone: 'error',
  },
  cancelled: {
    title: '已取消付款',
    message: '沒有產生扣款，方案與使用期限維持不變。',
    tone: 'warning',
  },
  review: {
    title: '付款正在確認',
    message: '付款資料已收到，目前需要進一步確認；確認完成前不會啟用或延長方案。',
    tone: 'warning',
  },
  expired: {
    title: '付款已逾時',
    message: '本次付款期限已過，沒有變更方案；請重新選擇方案付款。',
    tone: 'error',
  },
  refunded: {
    title: '款項已退款',
    message: '本次款項已退款，請以目前方案與使用期限為準。',
    tone: 'warning',
  },
};

const PAYMENT_STATUS_LABEL: Record<BillingSettingsView['history'][number]['status'], string> = {
  pending: '待付款',
  paid: '已付款',
  failed: '付款失敗',
  manual_review: '等待人工確認',
  expired: '已逾時',
  cancelled: '已取消',
  refunded: '已退款',
};

const PROVIDER_LABEL: Record<BillingSettingsView['history'][number]['provider'], string> = {
  manual: '人工入帳',
  ecpay: '綠界科技',
  stripe: 'Stripe',
  tappay: 'TapPay',
};

function providerLabel(item: BillingSettingsView['history'][number]): string {
  if (item.provider === 'ecpay' && item.providerMode === 'test') {
    return '綠界測試環境';
  }
  return PROVIDER_LABEL[item.provider];
}

function paymentStatusLabel(item: BillingSettingsView['history'][number]): string {
  const label = PAYMENT_STATUS_LABEL[item.status];
  return item.provider === 'ecpay' && item.providerMode === 'test'
    ? `測試${label}`
    : label;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProviderSubmission(payload: unknown): ProviderSubmission | null {
  if (!isRecord(payload)) return null;
  const nested = [payload.checkout, payload.checkoutForm, payload.form].find(isRecord);
  const source = nested ?? payload;
  const actionValue = source.action ?? source.actionUrl ?? source.paymentUrl ?? source.url;
  const fieldsValue = source.fields ?? source.parameters ?? source.params;
  if (typeof actionValue !== 'string' || !actionValue.trim() || !isRecord(fieldsValue)) {
    return null;
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(fieldsValue)) {
    if (typeof value === 'string' || typeof value === 'number') {
      fields[key] = String(value);
    }
  }

  try {
    const url = new URL(actionValue, window.location.origin);
    const allowedHosts = new Set(['payment-stage.ecpay.com.tw', 'payment.ecpay.com.tw']);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) return null;
    return { action: url.toString(), fields };
  } catch {
    return null;
  }
}

function normalizePolledPaymentStatus(payload: unknown): PolledPaymentStatus | null {
  if (!isRecord(payload) || payload.success !== true || typeof payload.status !== 'string') {
    return null;
  }
  const normalized = payload.status.trim().toLowerCase();
  return [
    'pending',
    'paid',
    'failed',
    'manual_review',
    'expired',
    'cancelled',
    'refunded',
  ].includes(normalized)
    ? (normalized as PolledPaymentStatus)
    : null;
}

function checkoutErrorMessage(payload: unknown, status: number): string {
  const code = isRecord(payload) && typeof payload.code === 'string'
    ? payload.code.trim()
    : '';

  if (status === 429 || code === 'checkout_rate_limited') {
    const retryAfterSeconds = isRecord(payload)
      && typeof payload.retryAfterSeconds === 'number'
      && Number.isFinite(payload.retryAfterSeconds)
      && payload.retryAfterSeconds > 0
      ? Math.ceil(payload.retryAfterSeconds)
      : null;
    return retryAfterSeconds
      ? `付款操作過於頻繁，請在 ${retryAfterSeconds} 秒後再試。`
      : '付款操作過於頻繁，請稍後再試。';
  }

  switch (code) {
    case 'unauthenticated':
      return '登入狀態已失效，請重新登入後再試。';
    case 'membership_required':
    case 'role_forbidden':
      return '目前帳號沒有啟動付款的權限。';
    case 'billing_disabled':
    case 'credentials_missing':
    case 'provider_not_ready':
      return '線上付款目前暫時無法使用，請稍後再試。';
    case 'platform_suspension_requires_review':
      return '此工作區已由平台管理員停權，解除停權前無法線上付款。';
    case 'plan_downgrade_not_supported':
      return '目前不支援線上降級，請改選現有或更高方案。';
    case 'invalid_offer':
    case 'offer_not_found':
      return '找不到這筆專屬報價，請重新整理帳務頁。';
    case 'offer_unavailable':
      return '這筆專屬報價已到期或付款連結已失效，請重新整理帳務頁。';
    case 'offer_conflict':
    case 'order_mismatch':
      return '這筆專屬報價的付款狀態需要確認，請勿重複付款。';
    case 'checkout_order_not_pending':
      return '此付款訂單已失效，請重新建立付款流程。';
    default:
      return CHECKOUT_GENERIC_ERROR_MESSAGE;
  }
}

function formatAmount(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

function PaymentStateNotice({ state }: { state: BillingPaymentQueryState }) {
  const content = PAYMENT_STATE_COPY[state];
  const isSuccess = content.tone === 'success';
  const isError = content.tone === 'error';
  const Icon = isSuccess ? CheckCircle2 : isError ? AlertCircle : Clock3;

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : isError
            ? 'border-red-200 bg-red-50 text-red-950'
            : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">{content.title}</p>
          <p className="mt-1 text-sm opacity-90">{content.message}</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" aria-hidden="true" />
        重新整理狀態
      </Button>
    </div>
  );
}

export function BillingPlanSelector({
  data,
  paymentState,
  paymentTradeNo,
  requestedPlan,
}: BillingPlanSelectorProps) {
  const router = useRouter();
  const [processingPlan, setProcessingPlan] = useState<SelfServiceSaaSPlanCode | null>(null);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ProviderSubmission | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isTrial = data.org.status === 'trialing' ||
    (data.org.status === 'suspended' && data.org.suspensionSource === 'trial_expired');

  useEffect(() => {
    if (submission && formRef.current) {
      formRef.current.submit();
    }
  }, [submission]);

  useEffect(() => {
    if (paymentState !== 'pending' || !paymentTradeNo) return;

    let stopped = false;
    let attempts = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let requestTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    const stopAndNavigate = (nextState: Exclude<BillingPaymentQueryState, 'pending'>) => {
      stopped = true;
      router.replace(`/settings/billing?payment=${nextState}`);
      router.refresh();
    };

    const poll = async () => {
      if (stopped || attempts >= PAYMENT_POLL_MAX_ATTEMPTS) return;
      attempts += 1;
      activeController = new AbortController();
      requestTimeout = setTimeout(() => activeController?.abort(), 5_000);

      try {
        const response = await fetch(
          `/api/saas/billing/payment-status?trade=${encodeURIComponent(paymentTradeNo)}`,
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { accept: 'application/json' },
            signal: activeController.signal,
          }
        );

        if (!response.ok) {
          if ([400, 401, 403, 404].includes(response.status)) stopped = true;
          return;
        }

        const status = normalizePolledPaymentStatus(await response.json().catch(() => null));
        if (status === 'paid') {
          stopAndNavigate('success');
        } else if (status === 'failed') {
          stopAndNavigate('failed');
        } else if (status === 'manual_review') {
          stopAndNavigate('review');
        } else if (status === 'expired') {
          stopAndNavigate('expired');
        } else if (status === 'cancelled') {
          stopAndNavigate('cancelled');
        } else if (status === 'refunded') {
          stopAndNavigate('refunded');
        }
      } catch (pollError) {
        if (pollError instanceof Error && pollError.name !== 'AbortError') {
          // Transient network errors remain pending and are retried within the
          // same strict attempt budget.
        }
      } finally {
        if (requestTimeout) clearTimeout(requestTimeout);
        requestTimeout = null;
        activeController = null;
        if (!stopped && attempts < PAYMENT_POLL_MAX_ATTEMPTS) {
          pollTimer = setTimeout(() => void poll(), PAYMENT_POLL_INTERVAL_MS);
        }
      }
    };

    pollTimer = setTimeout(() => void poll(), PAYMENT_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (requestTimeout) clearTimeout(requestTimeout);
      activeController?.abort();
    };
  }, [paymentState, paymentTradeNo, router]);

  async function requestCheckout(
    request: { plan: SelfServiceSaaSPlanCode } | { offerId: string },
    clearProcessing: () => void
  ) {
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECKOUT_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/saas/billing/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setError(checkoutErrorMessage(payload, response.status));
        clearProcessing();
        return;
      }

      const nextSubmission = normalizeProviderSubmission(payload);
      if (!nextSubmission) {
        setError('付款服務回應不完整，請稍後再試。');
        clearProcessing();
        return;
      }
      setSubmission(nextSubmission);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error && checkoutError.name === 'AbortError'
          ? '等待付款服務回應逾時，請稍後再試。'
          : CHECKOUT_GENERIC_ERROR_MESSAGE
      );
      clearProcessing();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function startCheckout(plan: SelfServiceSaaSPlanCode) {
    setProcessingPlan(plan);
    await requestCheckout({ plan }, () => setProcessingPlan(null));
  }

  async function startCustomOfferCheckout(offerId: string) {
    setProcessingOfferId(offerId);
    await requestCheckout({ offerId }, () => setProcessingOfferId(null));
  }

  return (
    <div className="space-y-5">
      {paymentState ? <PaymentStateNotice state={paymentState} /> : null}

      <Card id="plans" className="scroll-mt-24 rounded-2xl border-gray-200 shadow-sm">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle>升級方案</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            直接在 AI 退貨系統內選擇方案並付款。每次付款購買一個月使用期，不會自動續扣。
          </p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          {data.customOffersUnavailable ? (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>專屬報價暫時無法載入；公開 NT$399 方案仍可正常使用。請重新整理後再試。</p>
            </div>
          ) : null}
          {data.customOffers.length > 0 ? (
            <section
              aria-labelledby="custom-plan-offers-title"
              className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5"
            >
              <div className="mb-4">
                <Badge className="mb-2 bg-emerald-700 text-white hover:bg-emerald-700">
                  專屬報價
                </Badge>
                <h3 id="custom-plan-offers-title" className="text-lg font-semibold text-gray-950">
                  為你的工作區準備的方案
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  此報價只會顯示在你的帳務頁，付款後會建立一個月使用期。
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {data.customOffers.map((offer) => {
                  const isProcessing = processingOfferId === offer.id;
                  const hasLegacyPlan = !isTrial && data.org.plan !== SAAS_SELF_SERVICE_PLAN_CODE;
                  const checkoutInProgress = processingPlan !== null || processingOfferId !== null;
                  const disabled =
                    !data.actions.canUpdateBilling || hasLegacyPlan || checkoutInProgress;

                  return (
                    <article
                      key={offer.id}
                      aria-labelledby={`custom-offer-${offer.id}`}
                      className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm"
                    >
                      <h4
                        id={`custom-offer-${offer.id}`}
                        className="text-lg font-semibold text-gray-950"
                      >
                        {offer.title}
                      </h4>
                      {offer.description ? (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {offer.description}
                        </p>
                      ) : null}
                      <p className="mt-5 text-3xl font-semibold text-gray-950">
                        {formatAmount(offer.amountTwd)}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>一次預付一個月・不自動續扣</p>
                        <p>報價有效至 {formatSaaSBillingDate(offer.expiresAt)}</p>
                      </div>
                      <Button
                        type="button"
                        className="mt-5 h-11 w-full"
                        disabled={disabled}
                        aria-busy={isProcessing}
                        onClick={() => void startCustomOfferCheckout(offer.id)}
                      >
                        {isProcessing ? '正在前往付款…' : '使用專屬報價付款'}
                        {!isProcessing ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {(() => {
            const code = SAAS_SELF_SERVICE_PLAN_CODE;
            const plan = SAAS_PLAN_DEFINITIONS[code];
            const isCurrentPlan = !isTrial && data.org.plan === code;
            const isCurrentActivePlan = isCurrentPlan && data.org.status === 'active';
            const hasLegacyPlan = !isTrial && data.org.plan !== code;
            const isPrimaryPlan = requestedPlan === code || isTrial || isCurrentPlan;
            const disabled =
              !data.actions.canUpdateBilling ||
              hasLegacyPlan ||
              processingPlan !== null ||
              processingOfferId !== null;

            return (
              <article
                aria-labelledby={`billing-plan-${code}`}
                className={`max-w-2xl rounded-xl border p-5 ${
                  isPrimaryPlan
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      id={`billing-plan-${code}`}
                      className="text-lg font-semibold text-gray-950"
                    >
                      {plan.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {PLAN_SUMMARY}
                    </p>
                  </div>
                  {isCurrentPlan ? <Badge variant="secondary">目前方案</Badge> : null}
                </div>
                <p className="mt-5 text-3xl font-semibold text-gray-950">
                  NT${plan.monthlyPriceTwd?.toLocaleString('zh-TW')}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">／月</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">一次預付一個月・不自動續扣</p>
                <Button
                  type="button"
                  className="mt-5 h-11 w-full"
                  variant={isPrimaryPlan ? 'default' : 'outline'}
                  disabled={disabled}
                  aria-busy={processingPlan === code}
                  onClick={() => void startCheckout(code)}
                >
                  {processingPlan === code
                    ? '正在前往付款…'
                    : hasLegacyPlan
                      ? '舊版方案暫不支援線上變更'
                      : isCurrentActivePlan
                        ? `續購 1 個月・NT$${plan.monthlyPriceTwd?.toLocaleString('zh-TW')}`
                        : `升級方案・NT$${plan.monthlyPriceTwd?.toLocaleString('zh-TW')}`}
                  {!hasLegacyPlan && processingPlan !== code ? (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  ) : null}
                </Button>
              </article>
            );
          })()}

          {!data.actions.canUpdateBilling && data.actions.disabledReason ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              {data.actions.disabledReason}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-gray-200 shadow-sm">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle>付款與訂閱紀錄</CardTitle>
          <p className="text-sm text-muted-foreground">顯示最近 24 筆付款狀態與對應使用期間。</p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          {data.history.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              目前沒有付款紀錄。完成第一筆付款後，訂閱期間會顯示在這裡。
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {data.history.map((item) => (
                  <article key={item.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-950">
                          {item.plan ? SAAS_PLAN_DEFINITIONS[item.plan].name : '方案未記錄'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.periodStart && item.periodEnd
                            ? `${formatSaaSBillingDate(item.periodStart)}－${formatSaaSBillingDate(item.periodEnd)}`
                            : '尚未產生使用期間'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.status === 'failed' || item.status === 'expired'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {paymentStatusLabel(item)}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">付款金額</dt>
                        <dd className="mt-1 font-medium text-gray-950">
                          {formatAmount(item.amountTwd)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">付款方式</dt>
                        <dd className="mt-1 text-gray-950">{providerLabel(item)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">
                          {item.provider === 'manual'
                            ? '入帳時間'
                            : item.paidAt
                              ? '付款時間'
                              : '訂單建立時間'}
                        </dt>
                        <dd className="mt-1 text-gray-950">
                          {formatSaaSBillingDateTime(
                            item.paidAt ?? item.createdAt
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-xl border lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">訂閱期間</th>
                      <th className="px-4 py-3 font-medium">方案</th>
                      <th className="px-4 py-3 font-medium">金額</th>
                      <th className="px-4 py-3 font-medium">付款方式</th>
                      <th className="px-4 py-3 font-medium">狀態</th>
                      <th className="px-4 py-3 font-medium">付款／建立時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.history.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-gray-950">
                          {item.periodStart && item.periodEnd
                            ? `${formatSaaSBillingDate(item.periodStart)}－${formatSaaSBillingDate(item.periodEnd)}`
                            : '尚未產生使用期間'}
                        </td>
                        <td className="px-4 py-3">
                          {item.plan ? SAAS_PLAN_DEFINITIONS[item.plan].name : '方案未記錄'}
                        </td>
                        <td className="px-4 py-3">{formatAmount(item.amountTwd)}</td>
                        <td className="px-4 py-3">{providerLabel(item)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              item.status === 'failed' || item.status === 'expired'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {paymentStatusLabel(item)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatSaaSBillingDateTime(
                            item.paidAt ?? item.createdAt
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {submission ? (
        <form ref={formRef} action={submission.action} method="post" className="hidden" aria-hidden="true">
          {Object.entries(submission.fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      ) : null}
    </div>
  );
}
