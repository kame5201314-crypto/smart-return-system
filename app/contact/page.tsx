import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Clock3, Mail, MessageSquareText } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '聯絡我們 | Smart Return SaaS',
  description: '申請封閉 Beta、Enterprise 報價或導入諮詢。',
};

const contactReasons = [
  [Building2, '封閉 Beta', '適合已經有穩定退貨量、需要客服與倉庫協作的品牌。'],
  [MessageSquareText, '導入諮詢', '盤點目前退貨流程、資料來源、成員角色與 AI 分析需求。'],
  [Clock3, 'Enterprise', '討論 SLA、權限、資料保存、帳務與客製導入範圍。'],
] as const;

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@smart-return.tw';
  const mailHref = `mailto:${contactEmail}?subject=Smart%20Return%20SaaS%20Beta`;

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Contact"
        title="先用封閉 Beta，把商業版流程跑穩。"
        description="留下品牌與退貨量級，我們會優先安排適合 SaaS Beta 的電商品牌導入。正式公開註冊會在 Stage 3 開放。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
            <Mail className="size-6 text-emerald-700" />
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">申請 Beta 或 Enterprise 報價</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              請附上品牌名稱、每月退貨筆數、目前使用的平台與希望導入的時間。
            </p>
            <Button asChild className="mt-6">
              <Link href={mailHref}>
                寄送申請信
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-neutral-500">{contactEmail}</p>
          </div>

          <div className="grid gap-4">
            {contactReasons.map(([Icon, title, body]) => (
              <div key={title} className="rounded-lg border border-neutral-200 p-5">
                <Icon className="size-5 text-cyan-700" />
                <h2 className="mt-4 text-base font-semibold text-neutral-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
