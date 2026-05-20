import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { DashboardScene } from '@/components/marketing/dashboard-scene';
import {
  getPlanPriceLabel,
  launchStages,
  planCopy,
  planOrder,
  workflowHighlights,
} from '@/components/marketing/commercial-data';
import { MarketingShell } from '@/components/marketing/site-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';

export const metadata: Metadata = {
  title: 'Smart Return SaaS | 電商退貨管理訂閱制平台',
  description:
    'Smart Return SaaS 協助台灣電商品牌集中處理退貨、AI 文字分析、用量控管與訂閱制商業化流程。',
};

const trustItems = [
  ['14 天', '免卡試用'],
  ['ECPay', '定期定額準備'],
  ['RLS', '租戶資料隔離'],
  ['AI', '文字分析控管'],
] as const;

const workflowIcons = [PackageCheck, Sparkles, ShieldCheck, BadgeCheck] as const;

const operatingControls = [
  [Clock3, '退貨量軟限制', '到達 80% 與 100% 時提醒 Owner / Admin，但不阻擋日常作業。'],
  [Sparkles, 'AI 額度硬上限', 'Basic 5 次、Growth 30 次、Pro 100 次；Enterprise 依合約設定。'],
  [LockKeyhole, '權限與旗標', '每個功能同時看 plan、feature flag 與角色權限，避免新功能直接全量開放。'],
  [Building2, '台灣商務準備', '優先規劃 ECPay 定期定額與電子發票，Stripe / TapPay 保留為後續選項。'],
] as const;

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="relative isolate h-[78svh] min-h-[520px] max-h-[760px] overflow-hidden bg-neutral-950 text-white">
        <DashboardScene />
        <div className="absolute inset-0 bg-neutral-950/48" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge className="border-emerald-300/30 bg-emerald-300/15 text-emerald-50 hover:bg-emerald-300/15">
              SaaS 商業版封閉 Beta
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              把退貨、AI 分析與訂閱用量，收進同一個營運工作台。
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-200 sm:text-lg">
              Smart Return SaaS 為台灣電商品牌設計，從退貨登記、檢查、AI 原因分析到方案權限控管，
              讓客服、倉庫與營運主管用同一份資料協作。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-neutral-950 hover:bg-neutral-100">
                <Link href="/signup">
                  申請 14 天試用
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                <Link href="/pricing">查看價格</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-neutral-200 px-4 sm:grid-cols-4 sm:px-6 lg:px-8">
          {trustItems.map(([value, label]) => (
            <div key={value} className="bg-white py-5 text-center">
              <div className="text-2xl font-semibold text-neutral-950">{value}</div>
              <div className="mt-1 text-sm text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-neutral-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-emerald-700">營運核心</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
                先把每日退貨處理穩住，再逐步開放計費與公開註冊。
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-600">
                商業版採 MVP-first 節奏：Stage 1 手動開通，Stage 2 接定期定額與發票，Stage 3 才開放公開註冊。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {workflowHighlights.map((item, index) => {
                const Icon = workflowIcons[index];
                return (
                  <div key={item.title} className="rounded-lg border border-neutral-200 bg-white p-5">
                    <Icon className="size-5 text-emerald-700" />
                    <h3 className="mt-4 text-base font-semibold text-neutral-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold text-emerald-700">訂閱方案</p>
              <h2 className="mt-3 text-3xl font-semibold text-neutral-950">固定月費，AI 額度清楚控管。</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/pricing">
                比較方案
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {planOrder.map((code) => (
              <div
                key={code}
                className={`rounded-lg border p-5 ${
                  planCopy[code].featured ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-neutral-950">{SAAS_PLAN_DEFINITIONS[code].name}</h3>
                  {planCopy[code].featured ? <Badge className="bg-emerald-700">建議</Badge> : null}
                </div>
                <div className="mt-4 text-3xl font-semibold text-neutral-950">{getPlanPriceLabel(code)}</div>
                <div className="mt-1 text-sm text-neutral-500">{code === 'enterprise' ? '依合約' : '每月'}</div>
                <p className="mt-4 min-h-12 text-sm leading-6 text-neutral-600">{planCopy[code].summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-emerald-300">上線節奏</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">用階段控管風險，不急著一次開滿。</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-300">
                每個階段都有明確 gate：資料隔離、AI 成本、計費、通知與公開註冊分批完成。
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {launchStages.map((stage) => (
                <div key={stage.stage} className="rounded-lg border border-white/12 bg-white/8 p-5">
                  <div className="text-sm text-emerald-200">{stage.stage}</div>
                  <h3 className="mt-2 text-lg font-semibold">{stage.title}</h3>
                  <ul className="mt-4 space-y-2">
                    {stage.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-neutral-300">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          {operatingControls.map(([Icon, title, body]) => (
            <div key={title} className="rounded-lg border border-neutral-200 p-5">
              <Icon className="size-5 text-cyan-700" />
              <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
