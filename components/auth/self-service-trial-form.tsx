'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
  type SelfServiceTrialPlan,
} from '@/lib/saas/self-service-trial';

interface SelfServiceTrialFormProps {
  email: string;
  initialPlan: SelfServiceTrialPlan;
}

const PLAN_OPTIONS: Array<{
  code: SelfServiceTrialPlan;
  name: string;
  price: string;
  description: string;
}> = [
  {
    code: 'basic',
    name: '入門版',
    price: 'NT$499 / 月',
    description: '3 位成員、每月 300 筆退貨、10 次 AI 分析',
  },
  {
    code: 'growth',
    name: '成長版',
    price: 'NT$699 / 月',
    description: '5 位成員、每月 800 筆退貨、25 次 AI 分析',
  },
];

function getErrorMessage(code: unknown): string {
  if (code === 'trial_already_claimed') return '這個帳號已使用過試用資格。';
  if (code === 'google_identity_required') return '請先使用 Google 帳號登入。';
  if (code === 'feature_disabled') return '自助試用目前尚未開放。';
  if (code === 'rate_limited') return '操作過於頻繁，請稍後再試。';
  if (code === 'invalid_request') return '請確認品牌名稱、方案與條款勾選。';
  return '建立試用工作區失敗，請稍後再試。';
}

export function SelfServiceTrialForm({ email, initialPlan }: SelfServiceTrialFormProps) {
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [plan, setPlan] = useState<SelfServiceTrialPlan>(initialPlan);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      toast.success('14 天試用工作區已建立。');
      router.replace(payload.redirectTo || '/analytics');
      router.refresh();
    } catch {
      toast.error('建立試用工作區失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="trial-org-name" className="text-sm font-medium text-neutral-900">
          品牌或商店名稱
        </label>
        <Input
          id="trial-org-name"
          value={orgName}
          onChange={(event) => setOrgName(event.target.value)}
          placeholder="例如：好好生活選物"
          className="mt-2"
          maxLength={120}
          required
          disabled={isSubmitting}
        />
        <p className="mt-2 text-xs text-neutral-500">登入帳號：{email}</p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">試用方案</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {PLAN_OPTIONS.map((option) => {
            const selected = plan === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => setPlan(option.code)}
                disabled={isSubmitting}
                className={`relative min-h-32 border p-4 text-left transition-colors ${
                  selected
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
                aria-pressed={selected}
              >
                {selected && (
                  <Check className="absolute right-3 top-3 size-4 text-emerald-700" aria-hidden="true" />
                )}
                <span className="block font-semibold text-neutral-950">{option.name}</span>
                <span className="mt-1 block text-sm text-emerald-800">{option.price}</span>
                <span className="mt-3 block text-xs leading-5 text-neutral-600">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm leading-6 text-neutral-700">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          disabled={isSubmitting}
          className="mt-1 size-4 accent-emerald-700"
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
          ，並了解試用期為 14 天且不會自動扣款。
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            建立工作區中...
          </>
        ) : (
          '開始 14 天免費試用'
        )}
      </Button>
    </form>
  );
}
