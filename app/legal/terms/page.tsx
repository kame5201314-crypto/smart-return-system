import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '服務條款 | Smart Return SaaS',
  description: 'Smart Return SaaS 服務條款草案。',
};

const sections = [
  ['服務範圍', 'Smart Return SaaS 提供退貨流程管理、團隊協作、AI 文字分析、用量統計、帳務與相關營運工具。Beta 期間部分功能可能採人工開通或分階段啟用。'],
  ['帳號與組織', '每個客戶組織需指定 Owner。Owner 需負責成員邀請、角色設定、帳務聯絡資訊與組織內資料使用。'],
  ['方案與用量', 'Basic、Growth、Pro、Enterprise 依方案提供席次、退貨量軟限制與 AI 額度。退貨量超量以提醒為主；AI 額度達上限時會停止新增 AI 分析。'],
  ['付款與取消', '付費方案以月費計價。正式金流啟用後，客戶可取消下期續訂；本期服務於週期結束前仍可使用，退費依退費政策辦理。'],
  ['禁止行為', '不得嘗試跨組織存取資料、繞過權限、破壞服務、上傳違法內容，或將服務用於未授權用途。'],
  ['條款更新', '條款更新時會於網站或系統內公告。重大變更會盡合理努力提前通知 Owner 或帳務聯絡人。'],
] as const;

export default function TermsPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Legal"
        title="服務條款"
        description="此頁為 SaaS 商業版 Beta 條款草案，正式公開收費前需再經法務與營運確認。"
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
