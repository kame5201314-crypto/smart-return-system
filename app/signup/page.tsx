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
  title: '申請試用 | Smart Return SaaS',
  description: '申請 Smart Return SaaS 封閉 Beta 或 14 天免卡試用。',
};

const onboardingSteps = [
  ['填寫需求', '提供品牌名稱、聯絡方式、每月退貨量與目前使用的平台，方便確認導入範圍。'],
  ['確認方案', 'Beta 期會先依 Basic、Growth、Pro 或 Enterprise 建立對應 org.plan。'],
  ['開通試用', 'Stage 1 採手動開通，由平台管理員建立 org、Owner 與 14 天 trial。'],
  ['導入資料', '確認 org_id、RLS 與 feature flags 後，再開始匯入或建立測試資料。'],
] as const;

const betaControls = [
  [ClipboardList, '方案不寫死', '功能限制會依 org.plan 計算，不用 APP_MODE 寫死商業邏輯。'],
  [MailCheck, '角色清楚', 'Owner / Admin / Staff / Viewer 分工，Beta 期先用邀請制控管成員。'],
  [LockKeyhole, '公開註冊預設關閉', 'ENABLE_PUBLIC_SIGNUP 預設 false；未授權前不會自動建立客戶 org。'],
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
        title="申請 Smart Return SaaS 試用。"
        description="目前採封閉 Beta 節奏，先由平台管理員手動開通；公開註冊會等 SaaS DB、計費與通知流程完成後再開放。"
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
                ['預設方案', '公開註冊 MVP 先以 Basic 試用為主，避免方案與計費流程過早複雜。'],
                ['Beta 開通', '封閉 Beta 由平台管理員手動建立 org、Owner 與 trial 狀態。'],
                ['安全前提', '023/024/025 migration 與 RLS 通過後，才會開放資料寫入流程。'],
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
              目前模式：{signupState.mode}。API gate 已存在，但未接 persistence 前不會建立 org。
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
            <span>公開註冊開放前，所有 org 建立與成員邀請都會保留 audit log。</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-700" />
            <span>AI 額度依 org.plan 控制，避免商業化初期成本失控。</span>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
