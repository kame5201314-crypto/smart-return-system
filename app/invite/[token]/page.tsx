import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '團隊邀請 | Smart Return SaaS',
  description: '接受 Smart Return SaaS 團隊邀請。',
};

export default function InvitePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Team Invite"
        title="團隊邀請功能準備中。"
        description="邀請流程會在 SaaS migration 與 organization_invites 表確認後開放；目前 Beta 成員仍由平台管理員手動建立或協助邀請。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-5xl gap-5 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="rounded-lg border border-neutral-200 p-6">
            <MailCheck className="size-6 text-emerald-700" />
            <h2 className="mt-5 text-xl font-semibold text-neutral-950">收到邀請信？</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              如果你已收到 Beta 邀請，請先登入帳號。若邀請連結尚未啟用，請聯絡邀請你的 Owner 或 Admin。
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
              商業版角色包含 Owner、Admin、Staff、Viewer。邀請啟用後，角色會影響退貨寫入、帳務設定與平台管理權限。
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
