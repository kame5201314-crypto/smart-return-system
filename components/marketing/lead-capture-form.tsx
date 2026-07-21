'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { SaaSPlanCode } from '@/lib/config/saas-plans';
import {
  captureSaaSLeadAttribution,
} from '@/lib/saas/lead-attribution';
import type {
  SaaSLeadAttribution,
  SaaSLeadContactChannel,
  SaaSMonthlyReturnBand,
} from '@/lib/saas/lead-capture';

const PLATFORM_OPTIONS = ['蝦皮', '官網', 'momo', '多通路', '其他'] as const;
const VOLUME_OPTIONS: ReadonlyArray<{
  value: SaaSMonthlyReturnBand;
  label: string;
}> = [
  { value: 'under_30', label: '30 筆以下' },
  { value: '30_100', label: '30–100 筆' },
  { value: '101_300', label: '101–300 筆' },
  { value: '301_800', label: '301–800 筆' },
  { value: 'over_800', label: '800 筆以上' },
];
const PLAN_OPTIONS: ReadonlyArray<{ value: SaaSPlanCode; label: string }> = [
  { value: 'basic', label: '入門版 NT$399 / 月' },
  { value: 'enterprise', label: '大量需求（非公開方案，專人評估）' },
];

export interface LeadCaptureFormProps {
  variant: 'signup' | 'contact';
  contactEmail: string;
  initialPlan?: SaaSPlanCode;
  leadCaptureEnabled?: boolean;
  lineOaId?: string;
}

interface LeadFormValues {
  brandName: string;
  contactName: string;
  email: string;
  lineId: string;
  phone: string;
  preferredContactChannel: SaaSLeadContactChannel;
  requestedPlan: SaaSPlanCode;
  platform: string;
  monthlyVolume: SaaSMonthlyReturnBand;
  painPoint: string;
  privacyConsent: boolean;
  website: string;
}

type SubmitState = 'idle' | 'submitting' | 'submitted' | 'failed';

function createInitialValues(initialPlan: SaaSPlanCode): LeadFormValues {
  return {
    brandName: '',
    contactName: '',
    email: '',
    lineId: '',
    phone: '',
    preferredContactChannel: 'email',
    requestedPlan: initialPlan === 'enterprise' ? 'enterprise' : 'basic',
    platform: PLATFORM_OPTIONS[0],
    monthlyVolume: '30_100',
    painPoint: '',
    privacyConsent: false,
    website: '',
  };
}

function getVolumeLabel(value: SaaSMonthlyReturnBand): string {
  return VOLUME_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getPlanLabel(value: SaaSPlanCode): string {
  return PLAN_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function buildLeadMessage(
  variant: LeadCaptureFormProps['variant'],
  values: LeadFormValues
): string {
  const heading =
    variant === 'signup'
      ? '您好，想申請 AI退貨管理系統 Beta 試用：'
      : '您好，想諮詢 AI退貨管理系統：';

  return [
    heading,
    '',
    `・品牌名稱：${values.brandName}`,
    `・聯絡人：${values.contactName}`,
    `・Email：${values.email || '—'}`,
    `・LINE ID：${values.lineId || '—'}`,
    `・電話：${values.phone || '—'}`,
    `・希望方案：${getPlanLabel(values.requestedPlan)}`,
    `・主要銷售平台：${values.platform}`,
    `・每月退貨量：${getVolumeLabel(values.monthlyVolume)}`,
    `・目前最大痛點：${values.painPoint || '—'}`,
    '',
    '謝謝！',
  ].join('\n');
}

function buildLineHref(lineOaId: string, message: string): string {
  const normalizedId = lineOaId.trim().replace(/^@/, '');
  return `https://line.me/R/oaMessage/%40${encodeURIComponent(normalizedId)}/?${encodeURIComponent(message)}`;
}

export function LeadCaptureForm({
  variant,
  contactEmail,
  initialPlan = 'basic',
  leadCaptureEnabled = false,
  lineOaId,
}: LeadCaptureFormProps) {
  const [values, setValues] = useState<LeadFormValues>(() => createInitialValues(initialPlan));
  const [attribution, setAttribution] = useState<SaaSLeadAttribution>({});
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  useEffect(() => {
    setAttribution(
      captureSaaSLeadAttribution({
        storage: window.sessionStorage,
        url: window.location.href,
        referrer: document.referrer,
      })
    );
  }, []);

  const message = useMemo(() => buildLeadMessage(variant, values), [variant, values]);

  const setContactValue = (
    field: 'email' | 'lineId' | 'phone',
    channel: SaaSLeadContactChannel,
    value: string
  ) => {
    setValues((previous) => {
      const next = { ...previous, [field]: value };
      const preferredValue = {
        email: next.email,
        line: next.lineId,
        phone: next.phone,
      }[next.preferredContactChannel];
      if (!preferredValue.trim()) {
        next.preferredContactChannel = next.email.trim()
          ? 'email'
          : next.lineId.trim()
            ? 'line'
            : next.phone.trim()
              ? 'phone'
              : channel;
      }
      return next;
    });
  };

  const validate = (): boolean => {
    if (!values.brandName.trim()) {
      setError('請填寫品牌名稱。');
      return false;
    }
    if (!values.contactName.trim()) {
      setError('請填寫聯絡人稱呼。');
      return false;
    }
    if (!values.email.trim() && !values.lineId.trim() && !values.phone.trim()) {
      setError('請至少留下一種聯絡方式。');
      return false;
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError('Email 格式不正確。');
      return false;
    }
    const preferredValue = {
      email: values.email,
      line: values.lineId,
      phone: values.phone,
    }[values.preferredContactChannel];
    if (!preferredValue.trim()) {
      setError('請填寫你選擇的優先聯絡方式。');
      return false;
    }
    if (!values.privacyConsent) {
      setError('請先同意個人資料使用說明。');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitState('submitting');

    try {
      const response = await fetch('/api/saas/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyName: values.brandName,
          contactName: values.contactName,
          email: values.email || undefined,
          lineId: values.lineId || undefined,
          phone: values.phone || undefined,
          preferredContactChannel: values.preferredContactChannel,
          requestedPlan: values.requestedPlan,
          monthlyReturnBand: values.monthlyVolume,
          platform: values.platform,
          painPoint: values.painPoint || undefined,
          attribution,
          privacyConsent: values.privacyConsent,
          website: values.website,
        }),
      });
      if (!response.ok) throw new Error('Lead request failed');
      setSubmitState('submitted');
    } catch {
      setSubmitState('failed');
      setError('目前無法送出，請改用 LINE、複製內容或 Email 聯絡我們。');
    }
  };

  const handleCopy = async () => {
    if (!validate()) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleManualLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!validate()) event.preventDefault();
  };

  const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent(
    variant === 'signup' ? 'AI退貨管理系統 Beta 試用申請' : 'AI退貨管理系統 諮詢'
  )}&body=${encodeURIComponent(message)}`;
  const lineHref = lineOaId ? buildLineHref(lineOaId, message) : null;
  const inputClassName =
    'mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-neutral-800">
          品牌名稱 <span className="text-rose-600">*</span>
          <input
            type="text"
            value={values.brandName}
            onChange={(event) => setValues((prev) => ({ ...prev, brandName: event.target.value }))}
            placeholder="例：好好生活選物"
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          聯絡人稱呼 <span className="text-rose-600">*</span>
          <input
            type="text"
            value={values.contactName}
            onChange={(event) => setValues((prev) => ({ ...prev, contactName: event.target.value }))}
            placeholder="例：王小姐"
            className={inputClassName}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-neutral-800">
          Email
          <input
            type="email"
            value={values.email}
            onChange={(event) => setContactValue('email', 'email', event.target.value)}
            placeholder="owner@example.com"
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          LINE ID
          <input
            type="text"
            value={values.lineId}
            onChange={(event) => setContactValue('lineId', 'line', event.target.value)}
            placeholder="例：smartreturn"
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          電話
          <input
            type="tel"
            value={values.phone}
            onChange={(event) => setContactValue('phone', 'phone', event.target.value)}
            placeholder="例：0912-345-678"
            className={inputClassName}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Email、LINE ID、電話至少填一項。</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-neutral-800">
          優先聯絡方式
          <select
            value={values.preferredContactChannel}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                preferredContactChannel: event.target.value as SaaSLeadContactChannel,
              }))
            }
            className={inputClassName}
          >
            <option value="email">Email</option>
            <option value="line">LINE</option>
            <option value="phone">電話</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          希望方案
          <select
            value={values.requestedPlan}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, requestedPlan: event.target.value as SaaSPlanCode }))
            }
            className={inputClassName}
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-neutral-800">
          主要銷售平台
          <select
            value={values.platform}
            onChange={(event) => setValues((prev) => ({ ...prev, platform: event.target.value }))}
            className={inputClassName}
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          每月退貨量
          <select
            value={values.monthlyVolume}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, monthlyVolume: event.target.value as SaaSMonthlyReturnBand }))
            }
            className={inputClassName}
          >
            {VOLUME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-neutral-800">
        目前最大的退貨痛點（選填）
        <textarea
          value={values.painPoint}
          onChange={(event) => setValues((prev) => ({ ...prev, painPoint: event.target.value }))}
          placeholder="例：蝦皮退貨和官網退貨分開記，月底對不起來"
          rows={3}
          className={inputClassName}
        />
      </label>

      <label className="mt-4 flex items-start gap-3 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={values.privacyConsent}
          onChange={(event) => setValues((prev) => ({ ...prev, privacyConsent: event.target.checked }))}
          className="mt-1 size-4 rounded border-neutral-300 text-emerald-700 focus:ring-emerald-600"
        />
        <span>
          我同意依
          <a href="/legal/privacy" className="mx-1 font-medium text-emerald-700 underline underline-offset-2">
            隱私權政策
          </a>
          使用上述資料回覆申請。<span className="text-rose-600">*</span>
        </span>
      </label>

      <label className="sr-only" aria-hidden="true">
        網站
        <input
          type="text"
          value={values.website}
          onChange={(event) => setValues((prev) => ({ ...prev, website: event.target.value }))}
          tabIndex={-1}
          autoComplete="off"
        />
      </label>

      {error ? <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p> : null}
      {submitState === 'submitted' ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          申請已送出。我們會在 1 個工作天內與你聯絡。
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3">
        {leadCaptureEnabled ? (
          <Button
            type="button"
            className="min-h-11"
            onClick={handleSubmit}
            disabled={submitState === 'submitting' || submitState === 'submitted'}
          >
            {submitState === 'submitting' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitState === 'submitted' ? '申請已送出' : submitState === 'submitting' ? '送出中' : '送出申請'}
          </Button>
        ) : null}

        {lineHref ? (
          <Button asChild variant="outline" className="min-h-11 border-[#06C755] text-[#058f3f] hover:bg-[#06C755]/5">
            <a href={lineHref} onClick={handleManualLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              用 LINE 傳送申請
              <ArrowRight className="size-4" />
            </a>
          </Button>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={handleCopy}>
            {copyState === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copyState === 'copied' ? '已複製，貼給我們即可' : '複製申請內容'}
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <a href={mailHref} onClick={handleManualLink}>
              <Mail className="size-4" />
              用 Email 寄出
            </a>
          </Button>
        </div>
      </div>

      {copyState === 'failed' ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs text-neutral-600">自動複製失敗，請手動選取以下內容：</p>
          <textarea
            readOnly
            value={message}
            rows={10}
            className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700"
            onFocus={(event) => event.target.select()}
          />
        </div>
      ) : null}

      {submitState === 'failed' ? null : (
        <p className="mt-3 text-xs text-neutral-600">
          收件信箱：{contactEmail} · 1 個工作天內回覆
        </p>
      )}
    </div>
  );
}
