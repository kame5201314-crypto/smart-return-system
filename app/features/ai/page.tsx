import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Gauge,
  Sparkles,
  TrendingDown,
} from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'AI 退貨原因分析｜找出地雷 SKU | Smart Return',
  description:
    'AI 自動分析退貨原因、找出高退貨 SKU、提示客服該優先處理誰。專為台灣電商品牌做的退貨洞察工具，不取代你做決定，只幫你看得更清楚。',
};

const insights = [
  [
    TrendingDown,
    '退貨原因排名',
    '每月自動整理退貨原因 Top 10：尺寸不合、瑕疵、客戶不喜歡、寄錯⋯⋯讓你知道下個月該調整商品說明、進貨還是物流。',
  ],
  [
    AlertTriangle,
    '找出地雷 SKU',
    '哪幾個商品退貨率特別高？是同一個 SKU 還是同一個品類？AI 自動排名，避免你月底才靠 Excel pivot 找。',
  ],
  [
    Brain,
    '客服該優先處理誰',
    '從退貨原因與客戶留言判斷情緒與優先順序，提示哪幾單可能升級成客訴或負評。',
  ],
] as const;

const costControls = [
  ['AI 額度依方案設定', 'Basic 5 次 / Growth 30 次 / Pro 100 次每月，到期自動重置。'],
  ['相同資料命中快取不重複扣', '同一筆退貨重複分析、相同 fingerprint 命中快取時不會扣額度。'],
  ['80% / 100% 提醒', '額度用到 80% 與 100% 會通知 Owner，不會在你不知道的情況下產生意外費用。'],
  ['不會自動加購', '額度用完只是當月停用 AI 分析，退貨日常作業完全不受影響。'],
] as const;

export default function AiFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="AI 退貨洞察"
        title="AI 幫你看出 3 件事：退貨原因、地雷 SKU、優先處理誰。"
        description="AI 不是噱頭，也不是要取代客服或老闆做決定。它只做一件事：把每月幾百上千筆退貨整理成你 30 秒就能看懂的洞察。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {insights.map(([Icon, title, body]) => (
              <div key={title} className="rounded-lg border border-neutral-200 p-6">
                <Icon className="size-6 text-emerald-700" />
                <h2 className="mt-4 text-lg font-semibold text-neutral-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-50 py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-emerald-700">不擔心 AI 費用爆掉</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
              AI 成本有明確上限，不會在你不知道的情況下扣款。
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-600">
              很多老闆怕用 AI 是因為「不知道會花多少錢」。Smart Return 把 AI 額度設計成月度硬上限，
              超過就停止，不會自動加購、不會在月底嚇你一跳。
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-950 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-neutral-400">本月 AI 使用量</div>
                <div className="mt-1 text-3xl font-semibold">21 / 30</div>
                <div className="mt-1 text-xs text-emerald-300">Growth 方案</div>
              </div>
              <BarChart3 className="size-7 text-emerald-300" />
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[70%] rounded-full bg-emerald-300" />
            </div>
            <div className="mt-6 grid gap-3 text-sm">
              {costControls.map(([title, body]) => (
                <div key={title} className="rounded-md border border-white/10 bg-white/8 p-3">
                  <div className="flex items-start gap-2">
                    <Gauge className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                    <div>
                      <div className="font-medium">{title}</div>
                      <div className="mt-1 text-neutral-300">{body}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-1 size-6 text-emerald-700" />
            <div>
              <h2 className="text-2xl font-semibold text-neutral-950">
                想看看你的退貨資料能跑出什麼洞察？
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                30 分鐘 Demo 可用你自己的退貨資料當場跑 AI 分析，看是否真的能解決問題。
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/contact">
              預約 30 分鐘 Demo
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
