import Link from 'next/link';
import { ArrowRight, Brain, ClipboardPlus, Upload } from 'lucide-react';

const steps = [
  {
    href: '/returns',
    title: '建立第一筆退貨',
    description: '手動新增客戶、商品、退貨原因與目前處理狀態。',
    action: '前往退貨管理',
    icon: ClipboardPlus,
  },
  {
    href: '/shopee-returns',
    title: '匯入蝦皮退貨資料',
    description: '已有蝦皮資料時，可直接匯入並集中追蹤處理進度。',
    action: '前往蝦皮退貨',
    icon: Upload,
  },
  {
    href: '/analytics/ai-report',
    title: '查看 AI 分析',
    description: '資料建立完成後，使用 AI 找出常見商品與退貨原因。',
    action: '前往 AI 分析',
    icon: Brain,
  },
] as const;

export function QuickStartGuide() {
  return (
    <section
      className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5"
      aria-labelledby="quick-start-guide-title"
    >
      <div>
        <p className="text-xs font-semibold tracking-wide text-emerald-700">新手導引</p>
        <h2 id="quick-start-guide-title" className="mt-1 text-lg font-semibold text-gray-950">
          3 步開始使用 AI 退貨系統
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          第一次使用時，建議先建立或匯入一筆退貨資料，再回到數據中心查看目前狀況。
        </p>
      </div>

      <ol className="mt-4 grid gap-3 lg:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex h-full gap-3 rounded-lg border border-emerald-100 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="text-xs font-medium text-emerald-700">步驟 {index + 1}</span>
                  <span className="mt-0.5 block font-medium text-gray-950">{step.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-gray-600">
                    {step.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-800">
                    {step.action}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
