import { ArrowDownLeft, BadgeCheck, BarChart3, PackageCheck, ScanLine } from 'lucide-react';

const rows = [
  ['RMA-2048', '蝦皮', '待審核', 'NT$ 1,280'],
  ['RMA-2049', '官網', '驗貨中', 'NT$ 860'],
  ['RMA-2050', 'momo', '退款中', 'NT$ 2,410'],
] as const;

const bars = ['h-20', 'h-28', 'h-16', 'h-32', 'h-24', 'h-36', 'h-20'] as const;

export function DashboardScene() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-neutral-950"
    >
      <div className="absolute left-0 top-0 hidden h-full w-full grid-cols-12 gap-px opacity-20 md:grid">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="border-r border-white/10" />
        ))}
      </div>
      <div className="absolute inset-0 bg-neutral-950/40" />

      <div className="absolute -right-8 top-10 hidden w-[58rem] max-w-[70vw] rotate-[-2deg] gap-4 rounded-lg border border-white/12 bg-white/8 p-4 shadow-2xl backdrop-blur md:grid">
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/12 p-4">
            <PackageCheck className="mb-5 size-5 text-emerald-200" />
            <div className="text-2xl font-semibold text-white">186</div>
            <div className="mt-1 text-xs text-emerald-100/80">本月退貨</div>
          </div>
          <div className="rounded-lg border border-cyan-300/25 bg-cyan-300/12 p-4">
            <ScanLine className="mb-5 size-5 text-cyan-200" />
            <div className="text-2xl font-semibold text-white">42</div>
            <div className="mt-1 text-xs text-cyan-100/80">今日掃描</div>
          </div>
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/12 p-4">
            <BarChart3 className="mb-5 size-5 text-amber-200" />
            <div className="text-2xl font-semibold text-white">71%</div>
            <div className="mt-1 text-xs text-amber-100/80">AI 額度</div>
          </div>
          <div className="rounded-lg border border-rose-300/25 bg-rose-300/12 p-4">
            <ArrowDownLeft className="mb-5 size-5 text-rose-200" />
            <div className="text-2xl font-semibold text-white">12</div>
            <div className="mt-1 text-xs text-rose-100/80">異常爭議</div>
          </div>
        </div>

        <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">
          <div className="rounded-lg border border-white/12 bg-neutral-950/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-medium text-white">退貨處理佇列</div>
              <BadgeCheck className="size-4 text-emerald-200" />
            </div>
            <div className="space-y-2">
              {rows.map(([id, channel, status, amount]) => (
                <div
                  key={id}
                  className="grid grid-cols-[1fr_0.7fr_0.8fr_0.8fr] items-center gap-3 rounded-md border border-white/8 bg-white/6 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-white">{id}</span>
                  <span className="text-neutral-300">{channel}</span>
                  <span className="text-emerald-100">{status}</span>
                  <span className="text-right text-neutral-200">{amount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/12 bg-neutral-950/60 p-4">
            <div className="mb-4 text-sm font-medium text-white">退貨原因趨勢</div>
            <div className="flex h-40 items-end gap-2">
              {bars.map((height, index) => (
                <div
                  key={`${height}-${index}`}
                  className={`w-full rounded-t-md bg-cyan-300/75 ${height}`}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
              <span>尺寸</span>
              <span>瑕疵</span>
              <span>錯寄</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-4 right-4 grid grid-cols-3 gap-2 md:hidden">
        {['待審核 18', '驗貨中 9', '退款中 15'].map((item) => (
          <div key={item} className="rounded-lg border border-white/12 bg-white/10 p-3 text-center text-xs text-white">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
