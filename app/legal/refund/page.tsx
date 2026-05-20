import type { Metadata } from 'next';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';

export const metadata: Metadata = {
  title: '退費政策 | Smart Return SaaS',
  description: 'Smart Return SaaS 退費政策草案。',
};

const rules = [
  ['首次付款 7 天內', '首次訂閱付款後 7 天內，且未大量使用，可申請人工審核退費。'],
  ['未大量使用定義', 'AI 使用次數不超過方案月額度 20%、退貨單建立筆數不超過方案軟限制 5%、未匯出報表、未邀請成員。'],
  ['續訂週期', '月費續訂週期原則上不退費。客戶可取消下期續訂，本期可用至週期結束。'],
  ['AI Pack', 'AI Pack 延後到 Stage 4+。未來若開放加購，一經使用原則上不退費。'],
  ['Enterprise', 'Enterprise 方案依合約約定付款、退費、SLA 與資料保存條件。'],
  ['濫用與例外', '若有違反條款、惡意濫用、異常大量請求或安全事件，退費申請可能不予受理。'],
] as const;

export default function RefundPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Legal"
        title="退費政策"
        description="退費採人工審核，重點是保留合理試用空間，同時避免大量使用後退費造成營運與 AI 成本風險。"
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
