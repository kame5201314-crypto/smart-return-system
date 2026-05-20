import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '接受邀請 | Smart Return SaaS',
  description: 'Smart Return SaaS 團隊邀請入口。',
};

export default function InvitePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Team Invite"
        title="團隊邀請入口準備中。"
        description="邀請資料表與角色設計已納入 SaaS migration 草案，正式 Beta 啟用後會在此完成邀請驗證與加入組織。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-5xl gap-5 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-lg border border-neutral-200 p-6">
            <MailCheck className="size-6 text-emerald-700" />
            <h2 className="mt-5 text-xl font-semibold text-neutral-950">已收到邀請？</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              請先使用邀請信中的帳號登入。Beta 期若無法加入組織，請聯絡你的 Owner 或 Admin。
            </p>
            <Button asChild className="mt-6">
              <Link href="/login">
                前往登入
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="rounded-lg border border-neutral-200 p-6">
            <ShieldCheck className="size-6 text-cyan-700" />
            <h2 className="mt-5 text-xl font-semibold text-neutral-950">角色權限</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              商業版支援 Owner、Admin、Staff、Viewer。每個邀請都會綁定組織與角色，避免跨組織誤加入。
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
