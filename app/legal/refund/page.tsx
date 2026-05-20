import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '退費政策 | Smart Return SaaS',
  description: 'Smart Return SaaS 退費政策草案。',
};

const rules = [
  ['首次付款 7 天內', '首次訂閱付款後 7 天內，且符合未大量使用條件，可提出人工審核退費申請。'],
  ['未大量使用定義', 'AI 使用次數不超過方案月額度 20%，退貨單建立筆數不超過方案軟上限 5%，且未匯出報表、未邀請成員。'],
  ['續訂週期', '月費續訂週期原則上不退費；客戶可取消下期續訂，本期到期前仍可使用已付款服務。'],
  ['AI Pack', 'AI Pack 延後到 Stage 4+。未來若開放加購，已使用的 AI Pack 原則上不退費。'],
  ['Enterprise', 'Enterprise 方案依雙方合約、SLA 與客製條款處理退費、取消與服務終止。'],
  ['人工審核', '所有退費申請需人工審核。若有違反服務條款、濫用、詐欺或不可抗力情形，處理方式可能不同。'],
] as const;

export default function RefundPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Legal"
        title="退費政策"
        description="退費政策採人工審核，兼顧客戶體驗與 AI 成本控制；正式上線前會依金流與發票流程再次確認。"
      />
      <section className="bg-white py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            {rules.map(([title, body]) => (
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
