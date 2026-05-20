import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, DatabaseZap, GitBranch, KeyRound, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '資料隔離與安全 | Smart Return SaaS',
  description: '以 org_id、RLS、branch protection、環境隔離與 feature flags 建立 SaaS 安全邊界。',
};

const securityItems = [
  [UsersRound, 'org_id 租戶隔離', '客戶資料表逐步補上 org_id，查詢與寫入都必須帶入租戶條件。'],
  [ShieldCheck, 'Supabase RLS', 'SaaS DB 使用獨立 project，RLS policy 限定同組織成員才能讀寫。'],
  [LockKeyhole, 'getOrgContext()', 'server runtime 先解析使用者、組織、方案、角色與 feature flag。'],
  [KeyRound, 'secret 不入庫', '.env.saas.local、Vercel env、金流憑證與 Gemini key 都不提交到 git。'],
  [GitBranch, 'master 保護', '已設定 PR、required check、禁止 force push 與刪除，降低誤動上市版風險。'],
  [DatabaseZap, 'SaaS DB 獨立', 'SaaS project ref 與 internal/live project ref 分開，migration 只套 SaaS DB。'],
] as const;

export default function SecurityFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Security Boundary"
        title="商業版要先把資料邊界立起來，再談公開註冊。"
        description="這不是把內部系統直接打開收費，而是以獨立 Supabase Project、獨立 env、獨立 branch gate 和多租戶資料隔離重建 SaaS 安全邊界。"
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
            <p className="text-sm font-semibold text-emerald-300">上線控管</p>
            <h2 className="mt-2 text-2xl font-semibold">每個階段都先驗證，再開放更多客戶。</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['環境隔離', '資料庫安全', '權限檢查', '用量控管', '測試驗證', '建置驗證'].map((item) => (
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
            <h2 className="text-2xl font-semibold text-neutral-950">需要資安或導入文件？</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Enterprise 可另外提供資料刪除流程、SLA、權限審核與導入 checklist。
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
