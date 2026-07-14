import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, HelpCircle, Sparkles } from 'lucide-react';

import {
  getPlanMetricLabel,
  getPlanPriceLabel,
  planCopy,
  planOrder,
} from '@/components/marketing/commercial-data';
import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';

export const metadata: Metadata = {
  title: '價格方案｜固定月費、不需信用卡試用 | Smart Return',
  description:
    '入門版 NT$499、成長版 NT$699，退貨量是軟提醒不擋作業、AI 額度有上限不怕成本失控。14 天免費試用，不需信用卡。',
};

const comparisonRows = [
  ['團隊席次', 'seat'],
  ['退貨量軟上限', 'returns'],
  ['AI 分析額度', 'ai'],
] as const;

const planRecommendation = [
  ['每月退貨 30–300 筆、1–3 人', '入門版', '剛開始整理退貨流程的小型品牌', 'basic'],
  ['每月退貨 300–800 筆、多人協作', '成長版', '最多人選的方案，AI 額度與進階分析夠用', 'growth'],
  ['代營運、多倉、API 或 SLA 需求', '大量需求', '需要合約、客製權限或多品牌', 'enterprise'],
] as const;

const pricingFaq = [
  {
    q: '試用要綁信用卡嗎？',
    a: '不需要。14 天免費試用完全不綁卡，試用結束不會自動扣款。',
  },
  {
    q: '退貨量超過軟上限會怎樣？',
    a: '不會擋你新增退貨單。系統會在達到 80% 與 100% 時通知 Owner，建議你升級方案，但日常作業完全不受影響。',
  },
  {
    q: 'AI 額度用完會怎樣？',
    a: '當月停止新的 AI 分析，但既有的退貨資料、報表與作業都正常使用。不會自動加購、不會出現意外扣款。下個月自動重置。',
  },
  {
    q: '可以中途升級或降級嗎？',
    a: '可以。升級立即生效；降級於下一期生效。Beta 期請直接聯繫我們協助處理。',
  },
  {
    q: '可以隨時取消嗎？',
    a: '可以。試用期內或付費後皆可隨時停用，不綁約。取消後當期結束不再續扣。',
  },
  {
    q: '付款方式？',
    a: 'Beta 期由我們手動開立帳單。正式上線後會接 ECPay 定期定額與電子發票，方便台灣電商使用。',
  },
  {
    q: '退費政策？',
    a: '7 天內若不適用可申請退費。詳細請看「退費政策」。',
  },
  {
    q: '需要多收的 AI 額度怎麼辦？',
    a: '入門版可升級成長版；若成長版仍不夠，請洽談大量需求方案。AI 加購方案會在後續推出。',
  },
] as const;

export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="價格方案"
        title="固定月費，退貨量不擋作業、AI 額度清楚封頂。"
        description="不需信用卡試用、隨時取消、不綁約。Beta 期前 5 家品牌享免費協助導入第一批退貨資料。"
      />

      {/* Recommendation strip */}
      <section className="bg-emerald-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 size-5 shrink-0 text-emerald-700" />
            <div>
              <h2 className="text-base font-semibold text-neutral-900">不知道選哪個？</h2>
              <p className="mt-1 text-sm text-neutral-600">點選符合你狀況的一項，直接查看對應方案。</p>
              <ul className="mt-3 grid gap-2 md:grid-cols-3">
                {planRecommendation.map(([who, plan, why, code]) => (
                  <li key={plan}>
                    <Link
                      href={`#plan-${code}`}
                      className="block h-full rounded-md border border-emerald-200 bg-white p-3 transition hover:border-emerald-500 hover:shadow-sm"
                    >
                      <div className="text-xs text-emerald-700">{who}</div>
                      <div className="mt-1 flex items-center gap-1 text-base font-semibold text-neutral-900">
                        {plan}
                        <ArrowRight className="size-4 text-emerald-700" />
                      </div>
                      <div className="mt-1 text-xs text-neutral-600">{why}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 pt-3 sm:px-6 lg:grid-cols-3 lg:px-8">
          {planOrder.map((code) => {
            const plan = SAAS_PLAN_DEFINITIONS[code];
            const copy = planCopy[code];
            return (
              <div
                key={code}
                id={`plan-${code}`}
                className={`relative flex scroll-mt-24 flex-col rounded-lg border p-5 transition-shadow ${
                  copy.featured
                    ? 'border-emerald-600 bg-emerald-50 shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-600'
                    : 'border-neutral-200 bg-white hover:shadow-md'
                }`}
              >
                {copy.featured ? (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 px-3">
                    最多人選
                  </Badge>
                ) : null}
                <h2 className="text-xl font-semibold text-neutral-950">{plan.name}</h2>
                <p className="mt-3 min-h-12 text-sm leading-6 text-neutral-600">{copy.summary}</p>
                <div className="mt-5">
                  <span className="text-4xl font-semibold tracking-tight text-neutral-950">
                    {getPlanPriceLabel(code)}
                  </span>
                  {plan.monthlyPriceTwd ? <span className="ml-1 text-sm text-neutral-500">/月</span> : null}
                </div>
                <p className="mt-2 text-sm text-neutral-500">{copy.bestFor}</p>

                <Button asChild className="mt-6 w-full" variant={copy.featured ? 'default' : 'outline'}>
                  <Link href={code === 'enterprise' ? '/contact?plan=enterprise' : `/signup?plan=${code}`}>
                    {copy.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <p className="mt-2 text-center text-xs text-neutral-500">
                  {code === 'enterprise' ? '留下需求後由專人與你聯繫' : '不需信用卡，隨時取消'}
                </p>

                <ul className="mt-6 space-y-3">
                  {copy.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-5 text-neutral-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="bg-neutral-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-neutral-950">方案比較</h2>
          <p className="mt-2 text-xs text-neutral-500 md:hidden">表格可左右滑動查看完整方案</p>
          <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-100 text-neutral-700">
                  <th scope="col" className="sticky left-0 z-10 bg-neutral-100 p-4 font-semibold">
                    方案限制
                  </th>
                  {planOrder.map((code) => (
                    <th
                      scope="col"
                      key={code}
                      className={`p-4 font-semibold ${planCopy[code].featured ? 'bg-emerald-100/70 text-emerald-900' : ''}`}
                    >
                      {SAAS_PLAN_DEFINITIONS[code].name}
                      {planCopy[code].featured ? (
                        <span className="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white">
                          最多人選
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, key]) => (
                  <tr key={label} className="border-b border-neutral-200">
                    <th scope="row" className="sticky left-0 z-10 bg-white p-4 text-left font-medium text-neutral-950">
                      {label}
                    </th>
                    {planOrder.map((code) => (
                      <td
                        key={`${code}-${key}`}
                        className={`p-4 text-neutral-700 ${planCopy[code].featured ? 'bg-emerald-50/60 font-medium text-neutral-900' : ''}`}
                      >
                        {getPlanMetricLabel(code, key)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="sticky left-0 z-10 bg-white p-4 text-left font-medium text-neutral-950">
                    進階分析儀表板
                  </th>
                  {planOrder.map((code) => (
                    <td
                      key={`${code}-analytics`}
                      className={`p-4 ${planCopy[code].featured ? 'bg-emerald-50/60' : ''}`}
                    >
                      {SAAS_PLAN_DEFINITIONS[code].hasAdvancedAnalytics ? (
                        <span className="flex items-center gap-1.5 font-medium text-emerald-800">
                          <CheckCircle2 className="size-4" />
                          可使用
                        </span>
                      ) : (
                        <span className="text-neutral-400" aria-label="不提供">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-emerald-700" />
            <h2 className="text-2xl font-semibold text-neutral-950">付費常見問題</h2>
          </div>
          <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
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

      {/* Final CTA */}
      <section className="bg-neutral-950 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold">先試 14 天，再決定要不要付費。</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              不需信用卡、隨時取消。Beta 期前 5 家品牌享免費協助導入。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-white text-neutral-950 hover:bg-neutral-100">
              <Link href="/signup?plan=growth">
                申請 14 天免費試用
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white">
              <Link href="/contact?plan=enterprise">預約導入</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
