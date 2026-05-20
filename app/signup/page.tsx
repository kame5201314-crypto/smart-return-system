import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  LockKeyhole,
  MailCheck,
  UserRoundPlus,
} from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveSaaSPublicSignupState } from '@/lib/saas/public-signup';

export const metadata: Metadata = {
  title: '試用申請 | Smart Return SaaS',
  description: '申請 Smart Return SaaS 商業版 Beta 或公開註冊 14 天試用。',
};

const onboardingSteps = [
  ['填寫基本資料', '提供品牌名稱、主要銷售通路、每月退貨量與需要的帳號數。'],
  ['確認方案與角色', '依 Basic、Growth、Pro 或 Enterprise 建立 org.plan 與 Owner 權限。'],
  ['開通 14 天試用', '試用期間可登入系統、匯入資料並驗證退貨流程與 AI 額度。'],
  ['完成上線檢查', '確認 org_id、RLS、feature flag 與用量限制都已通過安全檢查。'],
] as const;

const betaControls = [
  [ClipboardList, '方案綁定 org.plan', '方案限制不靠 APP_MODE 寫死，所有額度與功能由租戶方案解析。'],
  [MailCheck, '邀請流程分段開', 'Owner / Admin 可邀請 Staff / Viewer；Beta 期先保留人工審核。'],
  [LockKeyhole, '公開註冊旗標控管', 'ENABLE_PUBLIC_SIGNUP 預設關閉，未授權前不會直接建立租戶。'],
] as const;

export default function SignupPage() {
  const signupState = resolveSaaSPublicSignupState();
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@smart-return.tw';
  const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent('Smart Return SaaS 試用申請')}`;
  const primaryHref = signupState.isPublicSignupEnabled ? mailHref : '/contact';

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Beta Signup"
        title="申請 Smart Return SaaS 商業版試用"
        description="Stage 1 先採手動開通，Stage 3 才以 public_signup 旗標開放公開註冊。未開旗標前，這裡只收 Beta 申請，不會直接建立 org。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-emerald-600 bg-emerald-50 p-6">
            <div className="flex items-center justify-between gap-3">
              <UserRoundPlus className="size-6 text-emerald-700" />
              <Badge variant={signupState.isPublicSignupEnabled ? 'default' : 'outline'}>
                {signupState.statusLabel}
              </Badge>
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">
              {signupState.headline}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">{signupState.description}</p>

            <div className="mt-6 grid gap-3 text-sm">
              {[
                ['預設方案', 'Basic 14 天試用，公開註冊只送 Basic'],
                ['Beta 開通', '平台管理員手動建立 org、Owner 與 trial'],
                ['安全條件', '023/024/025 migration 與 RLS 通過後才接正式建立流程'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-emerald-200 bg-white/70 p-3">
                  <div className="text-xs font-medium text-emerald-800">{label}</div>
                  <div className="mt-1 text-neutral-700">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={primaryHref}>
                  {signupState.primaryCtaLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">{signupState.secondaryCtaLabel}</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              目前模式：{signupState.mode}。真實建立租戶前仍需平台管理員與 SaaS DB guard。
            </p>
          </div>

          <div className="grid gap-4">
            {onboardingSteps.map(([title, body], index) => (
              <div key={title} className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-lg border border-neutral-200 p-5">
                <div className="flex size-10 items-center justify-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-50 py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {betaControls.map(([Icon, title, body]) => (
            <div key={title} className="rounded-lg border border-neutral-200 bg-white p-5">
              <Icon className="size-5 text-emerald-700" />
              <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-neutral-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-emerald-700" />
            <span>公開註冊開放前，所有租戶建立都必須保留 audit log。</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-700" />
            <span>AI 額度、席次與退貨量限制以 org.plan 為準。</span>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
