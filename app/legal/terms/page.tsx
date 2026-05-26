import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '服務條款 | Smart Return',
  description: 'Smart Return 服務條款草案。',
};

const sections = [
  ['服務範圍', 'Smart Return 提供退貨管理、AI 文字分析、用量控管、團隊權限與帳務準備功能。Beta 期間部分功能會以人工開通方式提供。'],
  ['帳號與角色', '品牌帳號的 Owner 對帳號、成員、資料與方案設定負主要管理責任。Admin、Staff、Viewer 等成員的可用功能會依其角色與品牌方案控制。'],
  ['方案與使用限制', 'Basic、Growth、Pro、Enterprise 方案包含不同席次、退貨量軟上限與 AI 月額度。退貨量超過軟上限時不阻擋作業，但系統可能提醒升級。'],
  ['付款與續訂', '付費功能正式啟用後，月費會依所選方案與付款週期收取。Beta 或手動開通期間，付款與發票流程可能以人工方式確認。'],
  ['使用限制', '使用者不得以未授權方式存取其他品牌的資料、繞過安全限制、破壞服務穩定性，或將本服務用於違法用途。'],
  ['條款更新', '服務條款可能因產品、法規、金流或安全需求調整。重大變更會透過站內通知、Email 或管理後台公告。'],
] as const;

export default function TermsPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="法務"
        title="服務條款"
        description="以下為 Beta 期間的服務條款草案。正式公開收費前會依實際金流、發票與合約條件更新。"
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
