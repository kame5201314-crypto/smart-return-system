import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '隱私權政策 | Smart Return SaaS',
  description: 'Smart Return SaaS 隱私權政策草案。',
};

const sections = [
  ['蒐集的資料', '我們可能蒐集帳號資料、組織資料、退貨資料、訂單與客戶聯絡資料、系統操作紀錄、AI 分析輸入與輸出，以及帳務相關資料。'],
  ['使用目的', '資料會用於提供退貨管理、團隊協作、AI 文字分析、帳務處理、客服支援、安全稽核與服務改善。'],
  ['AI 分析', '退貨 AI 只使用文字資料進行分析。圖片 AI 在商業版預設關閉，除非未來功能明確開放且客戶同意使用。'],
  ['資料隔離', 'SaaS 版本以 org_id 與 RLS policy 建立租戶隔離，避免不同組織資料互相讀取或寫入。'],
  ['第三方服務', '服務可能使用 Supabase、Vercel、Gemini、ECPay、Email 供應商或其他必要服務提供商。正式上線前會補齊供應商與資料處理細節。'],
  ['資料刪除', '客戶可提出資料匯出或刪除需求。實際處理時間、保留期間與例外情境會依合約、法規與帳務保存要求辦理。'],
] as const;

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Legal"
        title="隱私權政策"
        description="本政策說明 Smart Return SaaS 如何處理帳號、退貨、AI 分析與帳務資料。"
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
