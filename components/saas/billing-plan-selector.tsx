'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SAAS_PLAN_DEFINITIONS, type SaaSPlanCode } from '@/lib/config/saas-plans';
import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

export type BillingPaymentQueryState = 'success' | 'pending' | 'failed' | 'cancelled';

interface ProviderSubmission {
  action: string;
  fields: Record<string, string>;
}

interface BillingPlanSelectorProps {
  data: BillingSettingsView;
  paymentState: BillingPaymentQueryState | null;
  requestedPlan?: SaaSPlanCode | null;
}

const PLAN_ORDER: Array<Extract<SaaSPlanCode, 'basic' | 'growth'>> = ['basic', 'growth'];

const PLAN_SUMMARY: Record<Extract<SaaSPlanCode, 'basic' | 'growth'>, string> = {
  basic: '適合剛開始整理退貨流程的小型品牌。',
  growth: '適合需要更多 AI 分析額度與多人協作的成長品牌。',
};

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
  manual: '人工處理',
  ecpay: '綠界科技',
  stripe: 'Stripe',
  tappay: 'TapPay',
};

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

function formatDate(value: string | null): string {
  if (!value) return '尚未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '尚未設定';
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
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
  requestedPlan,
}: BillingPlanSelectorProps) {
  const [processingPlan, setProcessingPlan] = useState<SaaSPlanCode | null>(null);
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

  async function startCheckout(plan: Extract<SaaSPlanCode, 'basic' | 'growth'>) {
    setProcessingPlan(plan);
    setError(null);

    try {
      const response = await fetch('/api/saas/billing/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : '目前無法建立付款流程，請稍後再試。';
        throw new Error(message);
      }

      const nextSubmission = normalizeProviderSubmission(payload);
      if (!nextSubmission) {
        throw new Error('付款服務回應不完整，請稍後再試。');
      }
      setSubmission(nextSubmission);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error && checkoutError.message
          ? checkoutError.message
          : '目前無法建立付款流程，請稍後再試。'
      );
      setProcessingPlan(null);
    }
  }

  return (
    <div className="space-y-5">
      {paymentState ? <PaymentStateNotice state={paymentState} /> : null}

      <Card id="plans" className="scroll-mt-24 rounded-2xl border-gray-200 shadow-sm">
        <CardHeader className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardTitle>選擇方案</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            每次付款購買一個月使用期，採預付制，不會自動續扣；到期前可自行再次付款續用。
          </p>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_ORDER.map((code) => {
              const plan = SAAS_PLAN_DEFINITIONS[code];
              const isCurrentPlan = !isTrial && data.org.plan === code;
              const isCurrentActivePlan = isCurrentPlan && data.org.status === 'active';
              const isDowngrade = !isTrial && data.org.plan === 'growth' && code === 'basic';
              const isOnlineChangeUnavailable = data.org.plan === 'enterprise';
              const isRequested = requestedPlan === code;
              const disabled =
                !data.actions.canUpdateBilling ||
                isDowngrade ||
                isOnlineChangeUnavailable ||
                processingPlan !== null;

              return (
                <div
                  key={code}
                  className={`flex flex-col rounded-lg border p-5 ${
                    isRequested ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-950">{plan.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {PLAN_SUMMARY[code]}
                      </p>
                    </div>
                    {isCurrentPlan ? <Badge variant="secondary">目前方案</Badge> : null}
                  </div>
                  <p className="mt-5 text-3xl font-semibold text-gray-950">
                    NT$ {plan.monthlyPriceTwd?.toLocaleString('zh-TW')}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">／月</span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">一次預付一個月・不自動續扣</p>
                  <Button
                    type="button"
                    className="mt-5 w-full"
                    variant={code === 'growth' ? 'default' : 'outline'}
                    disabled={disabled}
                    onClick={() => void startCheckout(code)}
                  >
                    {processingPlan === code
                      ? '正在前往付款…'
                      : isOnlineChangeUnavailable
                        ? '目前方案不支援線上變更'
                        : isDowngrade
                        ? '暫不支援線上降級'
                        : isCurrentActivePlan
                          ? '續購 1 個月'
                          : `選擇${plan.name}並付款`}
                    {!isDowngrade && !isOnlineChangeUnavailable && processingPlan !== code ? (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    ) : null}
                  </Button>
                </div>
              );
            })}
          </div>

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
                          {SAAS_PLAN_DEFINITIONS[item.plan].name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.periodStart && item.periodEnd
                            ? `${formatDate(item.periodStart)}－${formatDate(item.periodEnd)}`
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
                        {PAYMENT_STATUS_LABEL[item.status]}
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
                        <dd className="mt-1 text-gray-950">{PROVIDER_LABEL[item.provider]}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">紀錄日期</dt>
                        <dd className="mt-1 text-gray-950">{formatDate(item.createdAt)}</dd>
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
                      <th className="px-4 py-3 font-medium">紀錄日期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.history.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-gray-950">
                          {item.periodStart && item.periodEnd
                            ? `${formatDate(item.periodStart)}－${formatDate(item.periodEnd)}`
                            : '尚未產生使用期間'}
                        </td>
                        <td className="px-4 py-3">{SAAS_PLAN_DEFINITIONS[item.plan].name}</td>
                        <td className="px-4 py-3">{formatAmount(item.amountTwd)}</td>
                        <td className="px-4 py-3">{PROVIDER_LABEL[item.provider]}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              item.status === 'failed' || item.status === 'expired'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {PAYMENT_STATUS_LABEL[item.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(item.createdAt)}
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
