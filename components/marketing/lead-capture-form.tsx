'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Mail, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

const PLATFORM_OPTIONS = ['蝦皮', '官網', 'momo', '多通路', '其他'] as const;
const VOLUME_OPTIONS = ['30 筆以下', '30–100 筆', '100–300 筆', '300–800 筆', '800 筆以上'] as const;

export interface LeadCaptureFormProps {
  variant: 'signup' | 'contact';
  contactEmail: string;
  lineOaId?: string;
}

interface LeadFormValues {
  brandName: string;
  contactName: string;
  reachBack: string;
  platform: string;
  monthlyVolume: string;
  painPoint: string;
}

const EMPTY_VALUES: LeadFormValues = {
  brandName: '',
  contactName: '',
  reachBack: '',
  platform: PLATFORM_OPTIONS[0],
  monthlyVolume: VOLUME_OPTIONS[1],
  painPoint: '',
};

function buildLeadMessage(variant: LeadCaptureFormProps['variant'], values: LeadFormValues): string {
  const heading =
    variant === 'signup'
      ? '您好，想申請 Smart Return Beta 試用：'
      : '您好，想諮詢 Smart Return：';

  return [
    heading,
    '',
    `・品牌名稱：${values.brandName}`,
    `・聯絡人：${values.contactName || '—'}`,
    `・LINE ID 或 Email：${values.reachBack}`,
    `・主要銷售平台：${values.platform}`,
    `・每月退貨量：${values.monthlyVolume}`,
    `・目前最大痛點：${values.painPoint || '—'}`,
    '',
    '謝謝！',
  ].join('\n');
}

function buildLineHref(lineOaId: string, message: string): string {
  const normalizedId = lineOaId.trim().replace(/^@/, '');
  return `https://line.me/R/oaMessage/%40${encodeURIComponent(normalizedId)}/?${encodeURIComponent(message)}`;
}

export function LeadCaptureForm({ variant, contactEmail, lineOaId }: LeadCaptureFormProps) {
  const [values, setValues] = useState<LeadFormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const message = useMemo(() => buildLeadMessage(variant, values), [variant, values]);

  const validate = (): boolean => {
    if (!values.brandName.trim()) {
      setError('請填寫品牌名稱。');
      return false;
    }
    if (!values.reachBack.trim()) {
      setError('請留下 LINE ID 或 Email，我們才能回覆你。');
      return false;
    }
    setError(null);
    return true;
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

  const handleLine = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!validate()) {
      event.preventDefault();
    }
  };

  const handleMail = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!validate()) {
      event.preventDefault();
    }
  };

  const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent(
    variant === 'signup' ? 'Smart Return Beta 試用申請' : 'Smart Return 諮詢'
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
          聯絡人稱呼
          <input
            type="text"
            value={values.contactName}
            onChange={(event) => setValues((prev) => ({ ...prev, contactName: event.target.value }))}
            placeholder="例：王小姐"
            className={inputClassName}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-neutral-800">
        LINE ID 或 Email <span className="text-rose-600">*</span>
        <input
          type="text"
          value={values.reachBack}
          onChange={(event) => setValues((prev) => ({ ...prev, reachBack: event.target.value }))}
          placeholder="方便我們 1 個工作天內回覆你"
          className={inputClassName}
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-neutral-800">
          主要銷售平台
          <select
            value={values.platform}
            onChange={(event) => setValues((prev) => ({ ...prev, platform: event.target.value }))}
            className={inputClassName}
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          每月退貨量
          <select
            value={values.monthlyVolume}
            onChange={(event) => setValues((prev) => ({ ...prev, monthlyVolume: event.target.value }))}
            className={inputClassName}
          >
            {VOLUME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
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

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-5 flex flex-col gap-3">
        {lineHref ? (
          <Button
            asChild
            className="min-h-11 bg-[#06C755] text-white hover:bg-[#05b34c]"
          >
            <a href={lineHref} onClick={handleLine} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              用 LINE 傳送申請（最快）
              <ArrowRight className="size-4" />
            </a>
          </Button>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant={lineHref ? 'outline' : 'default'}
            className="min-h-11 flex-1"
            onClick={handleCopy}
          >
            {copyState === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copyState === 'copied' ? '已複製，貼給我們就可以' : '複製申請內容'}
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <a href={mailHref} onClick={handleMail}>
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
            rows={8}
            className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-2 text-xs text-neutral-700"
            onFocus={(event) => event.target.select()}
          />
        </div>
      ) : null}

      <p className="mt-3 text-xs text-neutral-600">
        收件信箱：{contactEmail} · 1 個工作天內回覆
      </p>
    </div>
  );
}
