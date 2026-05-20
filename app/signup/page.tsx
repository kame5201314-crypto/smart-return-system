import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, MailCheck, UserRoundPlus } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '申請試用 | Smart Return SaaS',
  description: '申請 Smart Return SaaS 封閉 Beta 與 14 天免卡試用。',
};

const onboardingSteps = [
  ['填寫品牌資料', '品牌名稱、退貨量、主要渠道與預計導入時間。'],
  ['人工審核', '確認 SaaS Beta 適配度與需要的方案。'],
  ['手動開通', '建立 org、Owner 帳號、方案與 14 天試用期間。'],
  ['導入流程', '匯入資料、邀請成員、建立第一批退貨與 AI 分析基準。'],
] as const;

const betaControls = [
  [ClipboardList, '方案先綁 org.plan', '方案限制不依 APP_MODE 寫死，後續才能安全升降級。'],
  [MailCheck, '邀請流程準備', 'Owner / Admin 可邀請 Staff / Viewer，Beta 先由人工協助。'],
  [CheckCircle2, '上線前驗證', '正式開放前必須通過環境、測試與建置驗證。'],
] as const;

export default function SignupPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Beta Signup"
        title="公開註冊尚未全量開放，先申請封閉 Beta。"
        description="Stage 1 採手動開通，確保每個組織都有正確方案、角色、feature flag 與資料隔離設定。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-emerald-600 bg-emerald-50 p-6">
            <UserRoundPlus className="size-6 text-emerald-700" />
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">14 天免卡試用</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">
              Beta 期會由平台管理員建立組織與 Owner 帳號。若你已準備好每月固定費方案，請先聯絡我們安排導入。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/contact">
                  申請 Beta
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">查看方案</Link>
              </Button>
            </div>
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
    </MarketingShell>
  );
}
