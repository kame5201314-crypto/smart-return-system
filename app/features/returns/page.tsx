import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, PackageSearch, ScanLine, Truck } from 'lucide-react';

import { MarketingShell, PageHeader } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '退貨流程管理 | Smart Return SaaS',
  description: '集中管理退貨申請、審核、收貨、驗貨、退款與跨部門交接。',
};

const steps = [
  ['申請', '客服或客戶建立退貨，保留來源、品項、原因與照片附件。'],
  ['審核', '依退貨原因與訂單資料判斷是否核准，避免資訊散落在訊息紀錄。'],
  ['收貨', '倉庫用掃描與狀態更新確認包裹進站，降低漏件與重複處理。'],
  ['驗貨', '記錄檢查結果、異常爭議與退款建議，主管可追蹤每筆進度。'],
] as const;

const capabilityCards = [
  [PackageSearch, '退貨單集中清單', '用狀態、渠道、原因、日期與關鍵字快速找到待處理退貨。'],
  [ScanLine, '掃描與收貨流程', '支援包裹掃描、未匹配記錄與每日 KPI，適合倉庫現場作業。'],
  [ClipboardCheck, '驗貨與異常追蹤', '驗貨結果、備註、爭議狀態與退款處理留在同一筆退貨紀錄。'],
  [Truck, '多渠道資料整合', '先支援既有蝦皮與官網流程，後續保留 momo、經銷商與其他渠道。'],
] as const;

export default function ReturnsFeaturePage() {
  return (
    <MarketingShell>
      <PageHeader
        eyebrow="Returns Workflow"
        title="讓退貨不再靠訊息截圖與人工追問。"
        description="Smart Return SaaS 把客服、倉庫、主管會看的退貨資料集中成同一條作業線，先解決最常見的漏件、重複處理與狀態不一致。"
      />

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-semibold text-neutral-500">退貨狀態流</div>
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
            <h2 className="mt-2 text-2xl font-semibold">先讓真實退貨團隊跑完完整流程。</h2>
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
