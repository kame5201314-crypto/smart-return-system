import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, HelpCircle, Sparkles } from 'lucide-react';

import {
  getPlanPriceLabel,
  planCopy,
  planOrder,
} from '@/components/marketing/commercial-data';
import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';

export const metadata: Metadata = {
  title: '價格方案｜NT$399 單一月費方案 | Smart Return',
  description:
    'Smart Return 只有一個公開收費方案：每月 NT$399。3 天免費試用、不需信用卡，每次付款購買一個月且不會自動續扣。',
};

const pricingFaq = [
  {
    q: '試用要綁信用卡嗎？',
    a: '不需要。3 天免費試用完全不綁卡，試用結束不會自動扣款。',
  },
  {
    q: '付款後會自動續扣嗎？',
    a: '不會。每次付款購買一個月使用期；需要繼續使用時，再從 AI 退貨系統的帳務頁續購即可。',
  },
  {
    q: '退貨量超過每月 300 筆會怎樣？',
    a: '300 筆是用量提醒，不會擋你新增或處理退貨。系統會提示目前用量，讓你掌握營運狀況。',
  },
  {
    q: 'AI 額度用完會怎樣？',
    a: '當月停止新的 AI 分析，但既有退貨資料、報表與日常作業仍可正常使用；不會自動加購或產生額外扣款。',
  },
  {
    q: '付款方式是什麼？',
    a: '線上付款開放後會使用綠界科技 ECPay 安全結帳。付款結果須經伺服器驗證後，才會啟用或延長一個月使用期。',
  },
  {
    q: '可以申請退費嗎？',
    a: '符合退費政策的付款可提出申請，詳細條件請查看「退費政策」。',
  },
] as const;

export default function PricingPage() {
  const code = planOrder[0];
  const plan = SAAS_PLAN_DEFINITIONS[code];
  const copy = planCopy[code];

  return (
    <MarketingShell>
      <PageHeader
        eyebrow="價格方案"
        title="一個方案，NT$399／月。"
        description="先免費試用 3 天；需要繼續使用時，再於 AI 退貨系統內付款購買一個月。不綁卡、不自動續扣。"
      />

      <section className="bg-emerald-50 py-8">
        <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 sm:px-6 lg:px-8">
          <Sparkles className="mt-1 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-neutral-900">不用比較複雜方案</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              所有新客戶都使用同一個 NT$399 方案，費用、額度與使用期限清楚一致。
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <article
            id={`plan-${code}`}
            className="relative rounded-2xl border border-emerald-600 bg-emerald-50 p-6 shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-600 sm:p-8"
          >
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 px-3">
              唯一方案
            </Badge>
            <h2 className="text-2xl font-semibold text-neutral-950">{plan.name}</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{copy.summary}</p>
            <div className="mt-6 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight text-neutral-950">
                {getPlanPriceLabel(code)}
              </span>
              <span className="pb-1 text-sm text-neutral-500">／月</span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">一次預付一個月・不自動續扣</p>

            <Button asChild className="mt-7 h-12 w-full text-base">
              <Link href="/signup?plan=basic">
                免費試用 3 天
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-2 text-center text-xs text-neutral-500">不需信用卡，試用結束不會扣款</p>

            <div className="mt-7 grid gap-3 border-t border-emerald-200 pt-6 sm:grid-cols-2">
              {copy.features.map((feature) => (
                <div key={feature} className="flex gap-2 text-sm leading-5 text-neutral-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  {feature}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="bg-neutral-50 py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-emerald-700" aria-hidden="true" />
            <h2 className="text-2xl font-semibold text-neutral-950">付費常見問題</h2>
          </div>
          <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {pricingFaq.map((item) => (
              <details
                key={item.q}
                className="group p-5 transition-colors hover:bg-neutral-50 open:bg-neutral-50 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-neutral-950">
                  {item.q}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition group-open:rotate-45 group-hover:border-emerald-600 group-hover:text-emerald-700">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-sm text-neutral-600">
            更多細節請見
            <Link href="/legal/refund" className="mx-1 font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800">
              退費政策
            </Link>
            與
            <Link href="/legal/terms" className="mx-1 font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800">
              服務條款
            </Link>
            。
          </p>
        </div>
      </section>

      <section className="bg-neutral-950 py-14 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold">先試 3 天，再決定是否購買一個月。</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              唯一方案 NT$399，不需信用卡、不自動續扣。
            </p>
          </div>
          <Button asChild className="bg-white text-neutral-950 hover:bg-neutral-100">
            <Link href="/signup?plan=basic">
              申請 3 天免費試用
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
