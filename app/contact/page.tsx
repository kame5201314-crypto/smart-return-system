import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Clock3,
  Mail,
  MessageSquareText,
} from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '預約 Demo / 聯絡我們 | Smart Return',
  description:
    '預約 30 分鐘 Demo、申請 Beta 試用、洽談企業方案。我們會在 1 個工作天內回覆。',
};

const contactReasons = [
  [
    CalendarClock,
    '預約 30 分鐘 Demo',
    '用你自己的退貨資料當場跑一遍，看 Smart Return 是否真的能解決你的問題。',
  ],
  [
    Building2,
    '申請 Beta 試用',
    '14 天免費試用、不需信用卡。前 5 家品牌享免費協助導入第一批退貨資料。',
  ],
  [
    MessageSquareText,
    '導入評估',
    '討論你目前的退貨流程、客服與倉庫分工、平台與每月退貨量，確認合不合適。',
  ],
  [
    Clock3,
    '企業方案 / SLA',
    '集團、多品牌、多倉、客製權限或需要 SLA 與合約條件，請直接洽談。',
  ],
] as const;

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@smart-return.tw';
  const subject = encodeURIComponent('Smart Return 諮詢');
  const body = encodeURIComponent(
    [
      '您好，',
      '',
      '・品牌名稱：',
      '・聯絡人：',
      '・想詢問的事項：（Demo / Beta 試用 / 企業方案 / 其他）',
      '・每月退貨筆數（如適用）：',
      '',
      '謝謝！',
    ].join('\n')
  );
  const mailHref = `mailto:${contactEmail}?subject=${subject}&body=${body}`;

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="聯絡我們"
        title="預約 30 分鐘 Demo，用你的退貨資料當場跑。"
        description="留下品牌名稱、聯絡方式與每月退貨量，我們會在 1 個工作天內回覆。Beta 期間人工確認導入順序與資料匯入方式。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 p-6">
            <Mail className="size-6 text-emerald-700" />
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">寫信給我們</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">
              點下方按鈕會幫你帶好 Email 範本，補上你的資訊送出就好。1 個工作天內回覆。
            </p>
            <Button asChild className="mt-6 min-h-11 bg-emerald-700 hover:bg-emerald-800">
              <Link href={mailHref}>
                <Mail className="size-4" />
                寄信聯絡
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-neutral-600">寄到：{contactEmail}</p>
            <div className="mt-6 border-t border-emerald-200 pt-5 text-sm text-neutral-700">
              <p className="font-semibold">想直接申請試用？</p>
              <p className="mt-2 text-neutral-600">
                <Link href="/signup" className="inline-flex min-h-11 items-center text-emerald-700 underline underline-offset-2">
                  申請 Beta 試用 →
                </Link>
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
