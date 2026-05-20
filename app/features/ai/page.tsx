import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, Gauge, ImageOff, Sparkles } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'AI 成本控管 | Smart Return SaaS',
  description: '使用 gemini-2.5-flash-lite 做文字退貨分析，搭配月額度、快取與圖片 AI 關閉策略控制成本。',
};

const controls = [
  [Sparkles, '文字退貨分析', '退貨 AI 分析訂單、商品、原因與備註文字，協助整理退貨原因與處理建議。'],
  [ImageOff, '圖片 AI 預設關閉', 'ENABLE_IMAGE_AI=false 是 SaaS 預設，退貨 AI 不會呼叫圖片分析路徑。'],
  [Gauge, '月額度硬上限', 'Basic 5 次、Growth 30 次、Pro 100 次；Enterprise 依合約設定。'],
  [FileText, '快取命中不扣額度', '相同 fingerprint 的分析結果可重用，避免重複分析造成不必要成本。'],
] as const;

export default function AiFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="AI Cost Control"
        title="AI 只做該做的事，成本與額度都能被控制。"
        description="商業版退貨 AI 聚焦文字分析，不處理圖片；用量依 org.plan 控制，並保留快取與月度重置機制。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {controls.map(([Icon, title, body]) => (
              <div key={title} className="rounded-lg border border-neutral-200 p-5">
                <Icon className="size-5 text-emerald-700" />
                <h2 className="mt-4 text-base font-semibold text-neutral-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-neutral-400">AI 使用量</div>
                <div className="mt-1 text-2xl font-semibold">21 / 30</div>
              </div>
              <BarChart3 className="size-6 text-emerald-300" />
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[70%] rounded-full bg-emerald-300" />
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              {[
                ['80% 提醒', '寄送站內與 Email 提醒 Owner / Admin。'],
                ['100% 阻擋', '本月 AI 分析停止新增，既有資料與退貨作業仍可使用。'],
                ['月度重置', '依 Asia/Taipei 月份結算，下一期自動恢復方案額度。'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-md border border-white/10 bg-white/8 p-3">
                  <div className="font-medium">{title}</div>
                  <div className="mt-1 text-neutral-300">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-neutral-50 py-14">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold text-emerald-700">MVP 節奏</p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-950">
              先守住文字分析與成本上限，再開放加購方案。
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              AI Pack、圖片分析與更細的用量計費會延後到 Stage 4+，避免 MVP 早期帳務複雜度過高。
            </p>
          </div>
          <Button asChild>
            <Link href="/pricing">
              查看 AI 額度
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
