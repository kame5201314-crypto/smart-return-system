import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  ScanLine,
  Truck,
  XCircle,
} from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '退貨流程管理｜蝦皮 + 官網 + momo 集中處理 | AI退貨管理系統',
  description:
    '把多平台退貨從散亂的 Excel、LINE 與後台集中到同一個工作台。客服登記、倉庫掃描入庫、退款結案，全部用同一份資料追蹤。',
};

const beforeAfter = {
  before: [
    '退貨登記在客服 Excel、倉庫白板、蝦皮後台各一份',
    '客服 LINE 問倉庫：「這筆退貨收到了嗎？」',
    '倉庫收到包裹找不到對應訂單',
    '退款狀態散在蝦皮 / 官網 / 客服訊息裡',
    '老闆要報表得手動跨多個來源彙整',
  ],
  after: [
    '所有退貨單集中在一個工作台',
    '退貨狀態即時同步，不用 LINE 來回問',
    '倉庫掃條碼就找得到訂單與客戶資料',
    '退款狀態跟退貨單綁在一起，一目了然',
    '老闆隨時看得到本月退貨數字與原因',
  ],
} as const;

const steps = [
  ['登記', '客服建立退貨單，保留訂單、客戶、品項、原因與備註，後續節點都用這份資料。'],
  ['檢查', '倉庫記錄商品狀態、照片、處理方式與責任歸屬，減少口頭交接與漏記。'],
  ['判斷', '營運主管依退貨原因、商品狀態與平台規則決定退款、換貨或拒收。'],
  ['結案', '追蹤退款、補件、物流與內部紀錄，讓每筆退貨都有清楚狀態。'],
] as const;

const capabilityCards = [
  [PackageSearch, '退貨單集中管理', '從客服輸入到倉庫檢查，所有退貨單用同一套狀態與欄位追蹤。'],
  [ScanLine, '蝦皮退貨掃描', '支援蝦皮退貨匯入與掃描比對，倉庫收件時不用再翻訂單。'],
  [ClipboardCheck, '檢查紀錄完整', '保留檢查結果、處理建議與操作紀錄，方便事後查證或內部稽核。'],
  [Truck, '物流與退款節點', '把待收件、待檢查、待退款、已結案放在同一個作業流中。'],
] as const;

export default function ReturnsFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="退貨流程"
        title="把退貨從零散訊息，變成可追蹤的作業流。"
        description="客服、倉庫、營運主管看同一份退貨資料，用同一套狀態協作。不再每天 LINE 來回問「這筆退貨收到了沒」。"
      />

      {/* Before / After */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-6">
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-rose-500" />
                <h2 className="text-base font-semibold text-rose-700">Before：你現在的退貨</h2>
              </div>
              <ul className="mt-5 space-y-3">
                {beforeAfter.before.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-neutral-700">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-700" />
                <h2 className="text-base font-semibold text-emerald-900">After：用 AI退貨管理系統 之後</h2>
              </div>
              <ul className="mt-5 space-y-3">
                {beforeAfter.after.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-neutral-800">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow steps + capabilities */}
      <section className="bg-neutral-50 py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="text-sm font-semibold text-neutral-500">退貨處理 4 個節點</div>
            <div className="mt-6 grid gap-3">
              {steps.map(([title, body], index) => (
                <div key={title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                  <div className="flex size-10 items-center justify-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div className="border-b border-neutral-200 pb-4 last:border-b-0">
                    <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {capabilityCards.map(([Icon, title, body]) => (
              <div key={title} className="rounded-lg border border-neutral-200 bg-white p-5">
                <Icon className="size-5 text-emerald-700" />
                <h2 className="mt-4 text-base font-semibold text-neutral-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold">看看你的退貨流程套進來會長怎樣。</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              30 分鐘 Demo 用你自己的退貨資料當場跑，看是否真的能解決你的問題。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="min-h-11 bg-white text-neutral-950 hover:bg-neutral-100">
              <Link href="/signup">
                3 天免費試用
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white">
              <Link href="/contact">預約 Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
