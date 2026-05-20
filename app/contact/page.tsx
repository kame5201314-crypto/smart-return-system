import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Clock3, Mail, MessageSquareText } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '聯絡我們 | Smart Return SaaS',
  description: '聯絡 Smart Return SaaS，申請封閉 Beta、Enterprise 洽談或導入評估。',
};

const contactReasons = [
  [Building2, '封閉 Beta', '適合已經有退貨處理痛點，希望先用手動開通方式導入的電商品牌。'],
  [MessageSquareText, '導入評估', '可討論每月退貨量、客服與倉庫流程、AI 使用頻率與資料隔離需求。'],
  [Clock3, 'Enterprise', '可洽談 SLA、客製權限、資料保留政策、多倉流程與合約條件。'],
] as const;

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@smart-return.tw';
  const mailHref = `mailto:${contactEmail}?subject=Smart%20Return%20SaaS%20Beta`;

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Contact"
        title="聯絡我們，安排商業版 Beta 導入。"
        description="請提供品牌規模、每月退貨量、目前平台與想改善的流程，我們會依 Stage 1 手動開通節奏安排後續。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
            <Mail className="size-6 text-emerald-700" />
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">申請 Beta 或 Enterprise 洽談</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              目前公開註冊預設關閉，請先透過 Email 聯絡。正式公開註冊會在 SaaS DB、計費、通知與發票流程完成後開放。
            </p>
            <Button asChild className="mt-6">
              <Link href={mailHref}>
                寄信聯絡
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
