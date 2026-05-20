import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, PackageSearch, ScanLine, Truck } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '退貨流程管理 | Smart Return SaaS',
  description: '集中管理退貨登記、商品檢查、平台掃描、退款狀態與物流處理。',
};

const steps = [
  ['登記', '客服建立退貨單，保留訂單、客戶、品項、原因與備註，讓後續處理有一致資料來源。'],
  ['檢查', '倉庫記錄商品狀態、照片、處理方式與責任歸屬，減少口頭交接與漏記。'],
  ['判斷', '營運主管依退貨原因、商品狀態與平台規則決定退款、換貨或拒收。'],
  ['結案', '追蹤退款、補件、物流與內部稽核，讓每筆退貨都有清楚狀態。'],
] as const;

const capabilityCards = [
  [PackageSearch, '退貨單集中管理', '從客服輸入到倉庫檢查，所有退貨單用同一套狀態與欄位追蹤。'],
  [ScanLine, '平台掃描輔助', '支援掃描與比對退貨資料，降低倉庫收件時找不到訂單的時間成本。'],
  [ClipboardCheck, '檢查紀錄與稽核', '保留檢查結果、處理建議與操作紀錄，方便主管追蹤與事後稽核。'],
  [Truck, '物流與退款節點', '把待收件、待檢查、待退款、已結案等節點放在同一個作業流中。'],
] as const;

export default function ReturnsFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Returns Workflow"
        title="把退貨處理從零散訊息，整理成可追蹤的作業流。"
        description="Smart Return SaaS 讓客服、倉庫與營運主管用一致的退貨狀態協作，減少查單、漏記與重複溝通。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-semibold text-neutral-500">退貨處理節點</div>
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
              <div key={title} className="rounded-lg border border-neutral-200 p-5">
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
            <p className="text-sm font-semibold text-emerald-300">封閉 Beta</p>
            <h2 className="mt-2 text-2xl font-semibold">先讓退貨流程穩定，再接上訂閱與公開註冊。</h2>
          </div>
          <Button asChild className="bg-white text-neutral-950 hover:bg-neutral-100">
            <Link href="/signup">
              申請導入
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
