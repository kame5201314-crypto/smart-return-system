import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '服務條款 | AI退貨管理系統',
  description: 'AI退貨管理系統服務條款。',
};

const sections = [
  ['服務範圍', '本服務提供退貨管理、AI 文字分析、用量控管與團隊權限等功能。Beta 期間部分功能由我們人工開通。'],
  ['帳號與角色', '品牌帳號的擁有者（Owner）負責帳號、成員與方案的管理；其他成員可使用的功能，依其角色與方案而定。'],
  ['方案與費用', '目前唯一公開方案為入門版 NT$399／月，內含固定席次、每月退貨量上限與 AI 月額度。超出退貨量上限不會自動加收費用；大量需求請與我們另行洽談。'],
  ['付款與續訂', '採單月預付、到期不自動扣款。完成綠界付款並經系統確認後，即開通或延長一個月使用期；到期後可自行決定是否續購。Beta 期間，付款與發票流程可能以人工方式確認。'],
  ['使用規範', '請勿以未授權方式存取其他品牌的資料、規避安全機制、影響服務穩定，或將本服務用於違法用途；違反時我們得暫停或終止服務。'],
  ['條款更新', '條款可能因產品、法規、金流或安全需求調整，重大變更會透過站內通知或 Email 公告。'],
] as const;

export default function TermsPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="法務"
        title="服務條款"
        description="以下為 Beta 期間的服務條款。正式收費前會依實際金流與發票作業調整並公告。"
      />
      <section className="bg-white py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            {sections.map(([title, body]) => (
              <section key={title} className="rounded-lg border border-neutral-200 p-6">
                <h2 className="text-xl font-semibold text-neutral-950">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{body}</p>
              </section>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
