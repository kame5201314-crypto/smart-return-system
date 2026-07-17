'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
  type SelfServiceTrialIdentityProvider,
  type SelfServiceTrialPlan,
} from '@/lib/saas/self-service-trial';

interface SelfServiceTrialFormProps {
  identityLabel: string;
  identityProvider: SelfServiceTrialIdentityProvider;
  verifiedEmail?: string | null;
  verifiedPhone?: string | null;
  initialContactName?: string;
  initialReferralCode?: string;
  initialPlan: SelfServiceTrialPlan;
}

const FIELD_CLASS = 'mt-2 h-12 text-base';
const SELECT_CLASS = 'mt-2 h-12 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const PLATFORM_OPTIONS = [
  ['shopee', '蝦皮'],
  ['official_site', '品牌官網'],
  ['momo', 'momo'],
  ['multi_channel', '多通路'],
  ['other', '其他'],
] as const;

const RETURN_BAND_OPTIONS = [
  ['under_30', '30 筆以下'],
  ['30_100', '30–100 筆'],
  ['101_300', '101–300 筆'],
  ['301_800', '301–800 筆'],
  ['over_800', '800 筆以上'],
] as const;

function getErrorMessage(code: unknown): string {
  if (code === 'invite_required') return '目前為邀請制測試，請使用受邀的電子信箱登入。';
  if (code === 'trial_already_claimed') return '這個帳號已使用過試用資格。';
  if (code === 'google_identity_required') return '請先使用 Google 帳號完成驗證。';
  if (code === 'verified_identity_required') return '請先完成信箱或手機驗證。';
  if (code === 'feature_disabled') return '自助試用目前尚未開放。';
  if (code === 'rate_limited') return '操作過於頻繁，請稍後再試。';
  if (code === 'not_configured') return '商家資料服務尚未完成設定，請聯絡客服。';
  if (code === 'profile_persistence_failed') return '商家資料暫時無法儲存，請稍後再試。';
  if (code === 'invalid_request') return '請檢查必填的商家資料與聯絡方式。';
  return '建立試用工作區失敗，請稍後再試。';
}

function normalizeContactPhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function isTaiwanMobile(value: string): boolean {
  return /^(?:09\d{8}|\+8869\d{8})$/.test(normalizeContactPhone(value));
}

export function SelfServiceTrialForm({
  identityLabel,
  identityProvider,
  verifiedEmail = null,
  verifiedPhone = null,
  initialContactName = '',
  initialReferralCode = '',
  initialPlan,
}: SelfServiceTrialFormProps) {
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState(initialContactName);
  const [contactPhone, setContactPhone] = useState(verifiedPhone || '');
  const [lineId, setLineId] = useState('');
  const [preferredContactChannel, setPreferredContactChannel] = useState<'email' | 'phone' | 'line'>(
    verifiedEmail ? 'email' : 'phone'
  );
  const [platform, setPlatform] = useState('shopee');
  const [monthlyReturnBand, setMonthlyReturnBand] = useState('30_100');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [plan, setPlan] = useState<SelfServiceTrialPlan>(initialPlan);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isTaiwanMobile(contactPhone)) {
      toast.error('請輸入有效的台灣手機號碼，例如 0912345678。');
      return;
    }
    if (preferredContactChannel === 'email' && !verifiedEmail) {
      toast.error('目前帳號沒有已驗證信箱，請選擇電話或 LINE。');
      return;
    }
    if (preferredContactChannel === 'line' && !lineId.trim()) {
      toast.error('偏好使用 LINE 聯絡時，請填寫 LINE ID。');
      return;
    }
    if (!termsAccepted) {
      toast.error('請先同意服務條款與隱私權政策。');
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/saas/trial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orgName,
          contactName,
          contactPhone: normalizeContactPhone(contactPhone),
          lineId,
          preferredContactChannel,
          platform,
          monthlyReturnBand,
          referralCode,
          plan,
          termsAccepted,
          termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const payload = await response.json() as {
        success?: boolean;
        code?: string;
        redirectTo?: string;
      };

      if (!response.ok || !payload.success) {
        toast.error(getErrorMessage(payload.code));
        return;
      }

      toast.success('商家資料已完成，3 天試用工作區已建立。');
      router.replace(payload.redirectTo || '/analytics');
      router.refresh();
    } catch {
      toast.error('建立試用工作區失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isGoogleIdentity = identityProvider === 'google';

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="merchant-profile-form">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-950">登入身分已驗證</p>
            <p className="mt-1 break-all text-sm text-emerald-900">{identityLabel}</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              {isGoogleIdentity
                ? 'Google 只用於確認登入身分；完成下方商家資料後才會建立工作區。'
                : '完成下方商家資料後才會建立工作區。'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="trial-org-name" className="text-sm font-medium text-neutral-900">
          品牌或商店名稱 <span className="text-red-600">*</span>
        </label>
        <Input
          id="trial-org-name"
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          placeholder="例如：好好生活選物"
          className={FIELD_CLASS}
          maxLength={120}
          required
          disabled={isSubmitting}
          autoFocus
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="trial-contact-name" className="text-sm font-medium text-neutral-900">
            聯絡人姓名 <span className="text-red-600">*</span>
          </label>
          <Input
            id="trial-contact-name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="例如：王小姐"
            className={FIELD_CLASS}
            maxLength={120}
            required
            disabled={isSubmitting}
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="trial-contact-phone" className="text-sm font-medium text-neutral-900">
            聯絡電話 <span className="text-red-600">*</span>
          </label>
          <Input
            id="trial-contact-phone"
            type="tel"
            inputMode="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="0912345678"
            className={FIELD_CLASS}
            maxLength={20}
            required
            readOnly={Boolean(verifiedPhone)}
            disabled={isSubmitting}
            autoComplete="tel"
          />
          <p className="mt-1.5 text-xs leading-5 text-neutral-500">
            {verifiedPhone ? '此手機號碼已完成驗證。' : '作為客服聯絡使用，目前尚未完成手機驗證。'}
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="trial-platform" className="text-sm font-medium text-neutral-900">
            主要銷售平台 <span className="text-red-600">*</span>
          </label>
          <select
            id="trial-platform"
            className={SELECT_CLASS}
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            disabled={isSubmitting}
            required
          >
            {PLATFORM_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="trial-return-band" className="text-sm font-medium text-neutral-900">
            每月退貨量 <span className="text-red-600">*</span>
          </label>
          <select
            id="trial-return-band"
            className={SELECT_CLASS}
            value={monthlyReturnBand}
            onChange={(event) => setMonthlyReturnBand(event.target.value)}
            disabled={isSubmitting}
            required
          >
            {RETURN_BAND_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="trial-preferred-contact" className="text-sm font-medium text-neutral-900">
            偏好聯絡方式 <span className="text-red-600">*</span>
          </label>
          <select
            id="trial-preferred-contact"
            className={SELECT_CLASS}
            value={preferredContactChannel}
            onChange={(event) => setPreferredContactChannel(event.target.value as 'email' | 'phone' | 'line')}
            disabled={isSubmitting}
            required
          >
            {verifiedEmail ? <option value="email">Email</option> : null}
            <option value="phone">電話</option>
            <option value="line">LINE</option>
          </select>
        </div>
        <div>
          <label htmlFor="trial-line-id" className="text-sm font-medium text-neutral-900">
            LINE ID {preferredContactChannel === 'line' ? <span className="text-red-600">*</span> : '（選填）'}
          </label>
          <Input
            id="trial-line-id"
            value={lineId}
            onChange={(event) => setLineId(event.target.value)}
            placeholder="例如：smartreturn"
            className={FIELD_CLASS}
            maxLength={80}
            required={preferredContactChannel === 'line'}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="trial-plan" className="text-sm font-medium text-neutral-900">
            試用方案 <span className="text-red-600">*</span>
          </label>
          <select
            id="trial-plan"
            className={SELECT_CLASS}
            value={plan}
            onChange={(event) => setPlan(event.target.value as SelfServiceTrialPlan)}
            disabled={isSubmitting}
            required
          >
            <option value="basic">入門版 NT$499／月</option>
            <option value="growth">成長版 NT$699／月</option>
          </select>
          <p className="mt-1.5 text-xs leading-5 text-neutral-500">前 3 天免費，不需信用卡且不會自動扣款。</p>
        </div>
        <div>
          <label htmlFor="trial-referral-code" className="text-sm font-medium text-neutral-900">
            推薦碼（選填）
          </label>
          <Input
            id="trial-referral-code"
            value={referralCode}
            onChange={(event) => setReferralCode(event.target.value)}
            placeholder="請輸入推薦碼"
            className={FIELD_CLASS}
            maxLength={64}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-neutral-700">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          disabled={isSubmitting}
          className="mt-1 size-4 accent-emerald-700"
          required
        />
        <span>
          我同意
          <Link href="/legal/terms" target="_blank" className="mx-1 text-emerald-700 underline">
            服務條款
          </Link>
          與
          <Link href="/legal/privacy" target="_blank" className="mx-1 text-emerald-700 underline">
            隱私權政策
          </Link>
          ，並了解試用期為 3 天且不會自動扣款。
        </span>
      </label>

      <div className="rounded-lg bg-neutral-50 p-4 text-xs leading-5 text-neutral-600">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <p>商家資料只用於建立工作區、客服聯絡與提供 Smart Return 服務。</p>
        </div>
      </div>

      <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            建立工作區中...
          </>
        ) : (
          '完成資料並開始 3 天免費試用'
        )}
      </Button>
    </form>
  );
}
