import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, Gauge, ImageOff, Sparkles } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'AI 文字分析 | Smart Return SaaS',
  description: '以 gemini-2.5-flash-lite 為預設文字模型，控管 AI 額度、快取與成本風險。',
};

const controls = [
  [Sparkles, '文字分析優先', '退貨 AI 只分析文字資料，例如原因、備註、渠道與 SKU 彙整。'],
  [ImageOff, '圖片 AI 預設關閉', 'ENABLE_IMAGE_AI=false 是全域停用開關，退貨 AI 不會呼叫圖片路徑。'],
  [Gauge, '月度額度硬上限', 'Basic 5 次、Growth 30 次、Pro 100 次，Enterprise 依合約。'],
  [FileText, '快取命中不扣額度', '相同 fingerprint 的 AI 分析命中快取時不重複消耗額度。'],
] as const;

export default function AiFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="AI Cost Control"
        title="AI 要能幫忙看退貨原因，也要能控制每月成本。"
        description="商業版先採文字分析、固定月度額度與快取策略。圖片 AI、AI Pack、進階加購都延後到更成熟的 Stage。"
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
                ['80% 提醒', '站內提示與 Email 提醒 Owner / Admin。'],
                ['100% 阻擋', '回傳可升級方案的狀態，不再送出 AI 請求。'],
                ['月初重置', '以 Asia/Taipei 月份區間統計使用量。'],
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
            <p className="text-sm font-semibold text-emerald-700">分階段啟用</p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-950">
              AI 成本控管先到位，再開放給 Beta 客戶使用。
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              網站、金流準備與租戶隔離可以先完成；正式啟用 AI 前再完成金鑰、額度與快取驗證。
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
