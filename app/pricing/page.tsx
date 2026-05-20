import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Info, Sparkles } from 'lucide-react';

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
  title: '方案價格 | Smart Return SaaS',
  description: 'Basic、Growth、Pro、Enterprise 固定月費方案，含席次、退貨量軟限制與 AI 分析額度。',
};

const comparisonRows = [
  ['成員席次', 'seat'],
  ['退貨量軟限制', 'returns'],
  ['AI 文字分析額度', 'ai'],
] as const;

export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Pricing"
        title="固定月費，退貨超量先提醒，AI 額度才硬控管。"
        description="MVP 先採 Basic、Growth、Pro、Enterprise 四種方案。14 天免卡試用與公開註冊會在 Stage 3 開放；封閉 Beta 先由平台管理員手動開通。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {planOrder.map((code) => {
            const plan = SAAS_PLAN_DEFINITIONS[code];
            const copy = planCopy[code];
            return (
              <div
                key={code}
                className={`rounded-lg border p-5 ${
                  copy.featured ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex min-h-7 items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-neutral-950">{plan.name}</h2>
                  {copy.featured ? <Badge className="bg-emerald-700">推薦</Badge> : null}
                </div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-neutral-600">{copy.summary}</p>
                <div className="mt-5">
                  <span className="text-3xl font-semibold text-neutral-950">{getPlanPriceLabel(code)}</span>
                  {plan.monthlyPriceTwd ? <span className="ml-1 text-sm text-neutral-500">/月</span> : null}
                </div>
                <p className="mt-2 text-sm text-neutral-500">{copy.bestFor}</p>

                <Button asChild className="mt-6 w-full" variant={copy.featured ? 'default' : 'outline'}>
                  <Link href={code === 'enterprise' ? '/contact' : '/signup'}>
                    {copy.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>

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

      <section className="bg-neutral-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <div className="grid min-w-[760px] grid-cols-5 border-b border-neutral-200 bg-neutral-100 text-sm font-semibold text-neutral-700">
              <div className="p-4">比較項目</div>
              {planOrder.map((code) => (
                <div key={code} className="p-4">
                  {SAAS_PLAN_DEFINITIONS[code].name}
                </div>
              ))}
            </div>
            {comparisonRows.map(([label, key]) => (
              <div key={label} className="grid min-w-[760px] grid-cols-5 border-b border-neutral-200 text-sm last:border-b-0">
                <div className="p-4 font-medium text-neutral-950">{label}</div>
                {planOrder.map((code) => (
                  <div key={`${code}-${key}`} className="p-4 text-neutral-700">
                    {getPlanMetricLabel(code, key)}
                  </div>
                ))}
              </div>
            ))}
            <div className="grid min-w-[760px] grid-cols-5 text-sm">
              <div className="p-4 font-medium text-neutral-950">進階分析</div>
              {planOrder.map((code) => (
                <div key={`${code}-analytics`} className="p-4 text-neutral-700">
                  {SAAS_PLAN_DEFINITIONS[code].hasAdvancedAnalytics ? '可用' : '不可用'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            ['退貨量', '退貨筆數是軟限制，超量先顯示提醒，不阻擋客服與倉庫作業。'],
            ['AI 額度', 'AI 文字分析按月硬上限，fingerprint 快取命中不扣額度。'],
            ['AI Pack', 'AI Pack 延後到 Stage 4+，MVP 不先做加購與 proration。'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-neutral-200 p-5">
              {title === 'AI 額度' ? <Sparkles className="size-5 text-emerald-700" /> : <Info className="size-5 text-cyan-700" />}
              <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
