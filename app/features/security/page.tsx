import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, DatabaseZap, GitBranch, KeyRound, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '資料安全與租戶隔離 | Smart Return SaaS',
  description: '以 org_id、Supabase RLS、branch protection、feature flags 與 secret 管理建立 SaaS 安全邊界。',
};

const securityItems = [
  [UsersRound, 'org_id 租戶隔離', '所有客戶業務資料都要掛上 org_id，查詢與寫入必須限定在目前組織。'],
  [ShieldCheck, 'Supabase RLS', 'SaaS DB 使用獨立 project，透過 RLS policy 保護不同組織的資料邊界。'],
  [LockKeyhole, 'getOrgContext()', 'server runtime 先解析 user、org、plan 與 feature flags，再進入業務操作。'],
  [KeyRound, 'secret 不進 Git', '.env.saas.local、Vercel env、Gemini key 與 DB password 都只存在本機或平台 secret。'],
  [GitBranch, 'master 保護', 'live 版 master 已啟用 PR、required check、禁止 force push 與刪除。'],
  [DatabaseZap, 'SaaS DB 獨立', 'SaaS project ref 固定與 internal/live 分離，migration 只能套到 SaaS DB。'],
] as const;

export default function SecurityFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Security Boundary"
        title="商業版與上市版分離，客戶資料也必須彼此隔離。"
        description="Smart Return SaaS 用獨立 checkout、獨立 Supabase、獨立 Vercel project 與明確分支規則，降低商業化開發對 live 版本的風險。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
          {securityItems.map(([Icon, title, body]) => (
            <div key={title} className="rounded-lg border border-neutral-200 p-5">
              <Icon className="size-5 text-emerald-700" />
              <h2 className="mt-4 text-base font-semibold text-neutral-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-neutral-950 py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-emerald-300">安全控管</p>
            <h2 className="mt-2 text-2xl font-semibold">每次上線前都要通過明確 gate。</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['分支檢查', 'Supabase project 檢查', 'schema gate', 'secret 檢查', 'feature flag 檢查', 'build / test gate'].map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/8 px-4 py-3 text-sm text-neutral-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-950">需要企業級安全評估？</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Enterprise 可討論導入 checklist、權限矩陣、資料保留政策與 SLA 條款。
            </p>
          </div>
          <Button asChild>
            <Link href="/contact">
              聯絡我們
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
