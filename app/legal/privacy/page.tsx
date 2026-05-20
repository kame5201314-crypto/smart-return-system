import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '隱私權政策 | Smart Return SaaS',
  description: 'Smart Return SaaS 隱私權政策草案。',
};

const sections = [
  ['蒐集資料', '我們可能蒐集帳號資料、組織資料、退貨資料、客服與驗貨備註、用量紀錄、帳務資料、系統日誌與必要的安全事件紀錄。'],
  ['使用目的', '資料用於提供退貨管理服務、維護帳號與權限、產生統計與 AI 文字分析、處理帳務通知、偵測異常與改善服務品質。'],
  ['AI 分析', 'AI 分析預設只使用文字資料。圖片 AI 路徑預設關閉，正式開放前會另行提供功能說明與控制選項。'],
  ['資料隔離', 'SaaS 版本以組織為租戶邊界，透過 org_id、角色權限與資料庫層級政策隔離客戶資料。'],
  ['第三方服務', '服務可能使用 Supabase、Vercel、Gemini、ECPay、Email 與錯誤監控服務。正式上線前會依實際供應商更新清單。'],
  ['資料刪除', '客戶可申請匯出或刪除組織資料。刪除流程需確認帳務、法定保存與安全稽核需求後執行。'],
] as const;

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Legal"
        title="隱私權政策"
        description="此頁說明 SaaS 商業版如何處理客戶組織、退貨、AI 分析與帳務相關資料。"
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
