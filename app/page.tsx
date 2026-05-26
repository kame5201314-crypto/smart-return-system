import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  Headphones,
  LineChart,
  MessageSquareWarning,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { DashboardScene } from '@/components/marketing/dashboard-scene';
import {
  getPlanPriceLabel,
  planCopy,
  planOrder,
} from '@/components/marketing/commercial-data';
import { MarketingShell } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';

export const metadata: Metadata = {
  title: 'Smart Return｜台灣電商退貨管理系統｜蝦皮 + 官網 + momo 集中處理',
  description:
    '把蝦皮、官網、momo 的退貨集中在同一個工作台，AI 自動分析退貨原因、找出地雷 SKU。14 天免費試用，不需信用卡。專為每月 50 筆以上退貨的台灣電商品牌設計。',
};

const trustItems = [
  ['14 天', '免費試用'],
  ['免信用卡', '註冊不綁卡'],
  ['Beta 限額', '前 5 家免費導入'],
  ['台灣設計', '蝦皮欄位內建'],
] as const;

const painPoints = [
  '客服每天用 LINE 問倉庫：「這筆退貨收到了沒？」',
  '倉庫收到包裹卻找不到對應訂單',
  '退款狀態散在蝦皮後台、Excel、客服 LINE 群',
  '月底才發現某幾個 SKU 一直被退，但講不出原因',
  '想用 AI 分析退貨原因，但怕成本失控',
  '客服、倉庫、老闆各看一份 Excel，數字對不起來',
] as const;

const outcomes = [
  [Clock3, '減少客服查單時間', '每筆退貨從手動查 5 分鐘變 30 秒，退貨狀態一打開就看到。'],
  [PackageCheck, '降低漏掃、漏退款', '倉庫掃描入庫對單，誰寄回、誰已退款一目了然。'],
  [LineChart, '找出高退貨 SKU', 'AI 自動整理退貨原因排名，每週看得到哪個商品是地雷。'],
  [Headphones, '客服 / 倉庫 / 老闆同步', '同一份退貨資料，4 種角色看自己關心的視角。'],
] as const;

const audienceFit = {
  good: [
    '每月退貨 50 筆以上',
    '同時經營蝦皮、官網、momo 或多通路',
    '有客服、倉庫、營運分工',
    '現在靠 Excel + LINE 管退貨',
    '想知道退貨原因與高退貨商品',
  ],
  bad: [
    '每月退貨不到 10 筆',
    '只需要簡單記帳',
    '不想整理現有退貨流程',
  ],
} as const;

const comparisonRows = [
  ['多平台退貨集中', false, false, true],
  ['客服 / 倉庫 / 老闆角色分權', false, false, true],
  ['AI 自動分析退貨原因', false, false, true],
  ['倉庫掃描入庫對單', false, false, true],
  ['退貨狀態即時同步', false, '部分', true],
  ['高退貨商品自動排名', false, false, true],
  ['不需自己寫公式 / pivot', false, true, true],
] as const;

const onboardingSteps = [
  [
    CalendarClock,
    '1. 申請 Beta 試用',
    '留下品牌名稱、聯絡方式、平台與每月退貨量。1 個工作天內回覆。',
  ],
  [
    MessageSquareWarning,
    '2. 30 分鐘 Demo',
    '一起看你目前的退貨流程，確認導入順序與資料匯入方式。',
  ],
  [
    Sparkles,
    '3. 開通試用 + 協助導入',
    '建立帳號、邀請團隊、協助匯入第一批退貨資料。14 天免費。',
  ],
] as const;

const faqItems = [
  {
    q: '跟 Excel / 蝦皮後台有什麼不一樣？',
    a: 'Excel 不會自動同步退貨狀態、不能分權、不會 AI 分析；蝦皮後台只看得到蝦皮、看不到官網與 momo。Smart Return 把多平台集中、AI 找原因、角色分權做在同一個工作台。',
  },
  {
    q: '試用要綁信用卡嗎？',
    a: '不需要。14 天免費試用完全不綁卡，試用結束不會自動扣款。要不要付費由你決定。',
  },
  {
    q: '我每月退貨 200 筆 / 800 筆 / 3000 筆夠用嗎？',
    a: 'Basic 500 筆、Growth 2,000 筆、Pro 8,000 筆。如果預估會超過，建議直接選大一階方案，免得月中觸發提醒。',
  },
  {
    q: '退貨量臨時爆量會被擋嗎？',
    a: '不會。退貨筆數是軟提醒，到 80% / 100% 會通知 Owner，但不會擋你新增退貨單。AI 分析次數則是硬上限，避免成本失控。',
  },
  {
    q: '蝦皮退貨怎麼接？',
    a: '支援蝦皮退貨匯入與掃描比對，倉庫收到包裹掃條碼就能找到對應退貨單與訂單資料。',
  },
  {
    q: 'AI 分析準嗎？會不會講錯？',
    a: 'AI 只分析文字資料（訂單、商品、原因、備註），做的是退貨原因歸類、SKU 排名與處理建議，不會自動退款或自動回覆客戶。最終決策仍由你的營運主管做。',
  },
  {
    q: '我的客戶資料 / 訂單資料安全嗎？',
    a: '每個品牌的資料完全獨立隔離，不同客戶之間互不相通；我們也不會把你的客戶資料用於任何其他用途。',
  },
  {
    q: '可以隨時取消嗎？',
    a: '可以。試用期間隨時可以停用；付費後也可隨時取消，當期結束不再續扣。',
  },
  {
    q: '需要技術人員才能用嗎？',
    a: '不需要。Beta 期我們會協助你導入第一批資料，客服與倉庫只要會用瀏覽器就能上手。',
  },
  {
    q: '多久能上線？',
    a: '申請 → Demo → 開通通常在 3–5 個工作天內完成。資料匯入依品牌的退貨量大小，多數品牌一週內可進入日常使用。',
  },
] as const;

const ctaPrimary = (
  <Button asChild size="lg" className="bg-white text-neutral-950 hover:bg-neutral-100">
    <Link href="/signup">
      14 天免費試用，不需信用卡
      <ArrowRight className="size-4" />
    </Link>
  </Button>
);

const ctaSecondary = (
  <Button
    asChild
    size="lg"
    variant="outline"
    className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
  >
    <Link href="/contact">預約 30 分鐘 Demo</Link>
  </Button>
);

function ComparisonCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <div className="flex items-center justify-center">
        <CheckCircle2 className="size-5 text-emerald-700" />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex items-center justify-center">
        <XCircle className="size-5 text-neutral-300" />
      </div>
    );
  }
  return <div className="text-center text-sm text-neutral-600">{value}</div>;
}

export default function HomePage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative isolate min-h-[640px] overflow-hidden bg-neutral-950 text-white">
        <DashboardScene />
        <div className="absolute inset-0 bg-neutral-950/55" />

        <div className="relative z-10 mx-auto flex min-h-[640px] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge className="border-amber-300/40 bg-amber-300/15 text-amber-100 hover:bg-amber-300/15">
              Beta 限額 5 家 · 免費協助導入第一批退貨資料
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              蝦皮 + 官網 + momo 退貨同時湧進，<br className="hidden sm:inline" />
              客服一團亂、Excel 對不上？
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-200 sm:text-lg">
              Smart Return 幫你把退貨登記、倉庫掃描、退款狀態與 AI 原因分析
              <span className="font-semibold text-white"> 集中到同一個工作台</span>
              ，客服、倉庫、老闆看同一份資料，月底不用再手動拉 Excel。
            </p>
            <p className="mt-4 text-sm text-neutral-300">
              專為每月 50 筆以上退貨、需要客服 / 倉庫協作的台灣電商品牌設計。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {ctaPrimary}
              {ctaSecondary}
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              不需綁卡 · 隨時取消 · Beta 期手動協助開通
            </p>
          </div>
        </div>
      </section>

      {/* Trust band */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-neutral-200 px-4 sm:grid-cols-4 sm:px-6 lg:px-8">
          {trustItems.map(([value, label]) => (
            <div key={label} className="bg-white py-5 text-center">
              <div className="text-2xl font-semibold text-neutral-950">{value}</div>
              <div className="mt-1 text-sm text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Sympathy / pain checklist */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold text-rose-600">你是不是也遇到？</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
                退貨是電商最容易漏錢、最容易客訴的環節。
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-600">
                資料散在 4 個地方、客服與倉庫對不上、老闆永遠看不到全貌。
                打勾任意 2 條以上，Smart Return 就是為你做的。
              </p>
            </div>
            <ul className="space-y-3">
              {painPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-rose-500" />
                  <span className="text-sm leading-6 text-neutral-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Outcomes (results-focused, replaces workflow) */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-700">用 Smart Return 之後</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
              不是多一套系統，而是把每天浪費在退貨上的時間還給你。
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {outcomes.map(([Icon, title, body]) => (
              <div key={title} className="rounded-lg border border-neutral-200 bg-white p-5">
                <Icon className="size-5 text-emerald-700" />
                <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience fit */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-700">適合誰</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
              我們不適合所有人，但很適合這種電商。
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-600">
              先說清楚適合與不適合，避免你浪費時間試用後才發現不對。
            </p>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-700" />
                <h3 className="text-base font-semibold text-emerald-900">適合</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {audienceFit.good.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-neutral-700">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-neutral-400" />
                <h3 className="text-base font-semibold text-neutral-700">暫時不適合</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {audienceFit.bad.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-neutral-600">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-neutral-300" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-neutral-500">
                如果你只是想把現有 Excel 變漂亮，Smart Return 不會幫你太多。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-700">為什麼不繼續用 Excel？</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
              跟你現在的方法比較。
            </h2>
          </div>
          <div className="mt-8 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-[680px] w-full text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4 text-left font-semibold text-neutral-700">能力</th>
                  <th className="p-4 text-center font-semibold text-neutral-700">Excel</th>
                  <th className="p-4 text-center font-semibold text-neutral-700">蝦皮後台</th>
                  <th className="p-4 text-center font-semibold text-emerald-700">Smart Return</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, excel, shopee, sr]) => (
                  <tr key={label as string} className="border-t border-neutral-200">
                    <td className="p-4 font-medium text-neutral-900">{label}</td>
                    <td className="p-4"><ComparisonCell value={excel} /></td>
                    <td className="p-4"><ComparisonCell value={shopee} /></td>
                    <td className="p-4 bg-emerald-50/50"><ComparisonCell value={sr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-emerald-700">訂閱方案</p>
              <h2 className="mt-3 text-3xl font-semibold text-neutral-950">
                固定月費，沒有隱藏費用。
              </h2>
              <p className="mt-3 text-sm text-neutral-600">
                AI 額度有上限不怕成本爆掉、退貨量是軟提醒不擋作業。
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/pricing">
                看完整比較表
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {planOrder.map((code) => (
              <div
                key={code}
                className={`rounded-lg border p-5 ${
                  planCopy[code].featured
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-neutral-950">
                    {SAAS_PLAN_DEFINITIONS[code].name}
                  </h3>
                  {planCopy[code].featured ? (
                    <Badge className="bg-emerald-700">最多人選</Badge>
                  ) : null}
                </div>
                <div className="mt-4 text-3xl font-semibold text-neutral-950">
                  {getPlanPriceLabel(code)}
                </div>
                <div className="mt-1 text-sm text-neutral-500">
                  {code === 'enterprise' ? '依需求' : '每月'}
                </div>
                <p className="mt-4 min-h-12 text-sm leading-6 text-neutral-600">
                  {planCopy[code].summary}
                </p>
                <p className="mt-2 text-xs text-neutral-500">{planCopy[code].bestFor}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Onboarding steps */}
      <section className="bg-neutral-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-300">3 步開始使用</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              不需要你寫 IT 文件、不需要你 DIY 匯入。
            </h2>
            <p className="mt-4 text-base leading-7 text-neutral-300">
              Beta 期我們手動協助每一家品牌完成導入，確保你第一週就用得起來。
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {onboardingSteps.map(([Icon, title, body]) => (
              <div
                key={title}
                className="rounded-lg border border-white/12 bg-white/8 p-6"
              >
                <Icon className="size-6 text-emerald-300" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              [ShieldCheck, '資料獨立隔離', '每個品牌的資料完全分離，我們也不會用你的客戶資料做任何其他用途。'],
              [CreditCard, '不需信用卡', '14 天試用完全不綁卡，到期不會自動扣款。'],
              [Sparkles, 'AI 成本有上限', '依方案設定 AI 月額度上限，不會出現意外大筆扣款。'],
              [BadgeCheck, '台灣電商流程', '蝦皮欄位、爭議期、運費規則內建，不是國外通用 SaaS 硬套。'],
            ].map(([Icon, title, body]) => (
              <div key={title as string} className="rounded-lg border border-neutral-200 p-5">
                <Icon className="size-5 text-cyan-700" />
                <h3 className="mt-4 text-base font-semibold text-neutral-950">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{body as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold text-emerald-700">常見問題</p>
            <h2 className="mt-3 text-3xl font-semibold text-neutral-950">先把疑問講清楚。</h2>
          </div>
          <div className="mt-10 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {faqItems.map((item) => (
              <details key={item.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-neutral-950">
                  {item.q}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-neutral-950 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Badge className="border-amber-300/40 bg-amber-300/15 text-amber-100 hover:bg-amber-300/15">
            Beta 限額 5 家 · 免費協助導入
          </Badge>
          <h2 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">
            讓退貨流程從本月底開始穩定下來。
          </h2>
          <p className="mt-4 text-base leading-7 text-neutral-300">
            申請後 1 個工作天內回覆，30 分鐘 Demo 用你自己的退貨資料當場跑。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-neutral-950 hover:bg-neutral-100">
              <Link href="/signup">
                14 天免費試用，不需信用卡
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <Link href="/contact">預約 30 分鐘 Demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-neutral-400">
            不需綁卡 · 隨時取消 · Beta 期前 5 家品牌免費協助導入第一批退貨資料
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
