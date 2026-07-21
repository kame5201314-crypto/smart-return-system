'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
  initialReferralCode?: string;
  initialPlan: SelfServiceTrialPlan;
}

const FIELD_CLASS = 'mt-2 h-12 text-base';

// The simplified onboarding no longer asks merchants for segmentation data.
// Keep contract-safe defaults so the existing provisioning API remains stable.
const DEFAULT_PLATFORM = 'other';
const DEFAULT_MONTHLY_RETURN_BAND = '30_100';

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
  verifiedPhone = null,
  initialReferralCode = '',
  initialPlan,
}: SelfServiceTrialFormProps) {
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState(verifiedPhone || '');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isTaiwanMobile(contactPhone)) {
      toast.error('請輸入有效的台灣手機號碼，例如 0912345678。');
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
          lineId: '',
          preferredContactChannel: 'phone',
          platform: DEFAULT_PLATFORM,
          monthlyReturnBand: DEFAULT_MONTHLY_RETURN_BAND,
          referralCode: initialReferralCode,
          plan: initialPlan,
          termsAccepted,
          termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const payload = await response.json() as {
        success?: boolean;
        code?: string;
        redirectTo?: string;
        data?: {
          reused?: boolean;
          trialEnd?: string;
        };
      };

      if (!response.ok || !payload.success) {
        toast.error(getErrorMessage(payload.code));
        return;
      }

      if (payload.data?.reused) {
        const trialEnd = payload.data.trialEnd
          ? new Date(payload.data.trialEnd).getTime()
          : Number.NaN;
        if (Number.isFinite(trialEnd) && trialEnd <= Date.now()) {
          toast.info('此帳號的試用已到期，將返回原工作區。');
        } else {
          toast.info('已找到原有試用工作區，將沿用原試用期限。');
        }
      } else {
        toast.success('商家資料已完成，3 天試用工作區已建立。');
      }
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
