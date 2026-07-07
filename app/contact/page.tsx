import type { Metadata } from 'next';
import {
  Building2,
  CalendarClock,
  Clock3,
  Mail,
  MessageSquareText,
} from 'lucide-react';

import { LeadCaptureForm } from '@/components/marketing/lead-capture-form';
import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

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
  const lineOaId = process.env.NEXT_PUBLIC_LINE_OA_ID;

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
            <h2 className="mt-5 text-2xl font-semibold text-neutral-950">留下資訊，我們主動聯絡你</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-700">
              填好後選 LINE 或 Email 送出，1 個工作天內回覆。
            </p>
            <div className="mt-5 rounded-md border border-emerald-200 bg-white p-4">
              <LeadCaptureForm
                variant="contact"
                contactEmail={contactEmail}
                lineOaId={lineOaId}
              />
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
