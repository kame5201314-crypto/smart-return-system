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
  title: 'Smart Return SaaS | 訂閱制退貨管理系統',
  description: '給台灣電商品牌的 SaaS 退貨管理系統，支援退貨流程、AI 文字分析、多租戶隔離與訂閱制方案。',
};

const trustItems = [
  ['14 天', '免卡試用'],
  ['ECPay', '定期定額準備'],
  ['RLS', '多租戶隔離'],
  ['AI', '文字分析控管'],
] as const;

const workflowIcons = [PackageCheck, Sparkles, ShieldCheck, BadgeCheck] as const;

const operatingControls = [
  [Clock3, '退貨量軟限制', '超量先提醒，不阻擋作業；連續超量再建議升級。'],
  [Sparkles, 'AI 額度硬上限', 'Basic 5 次、Growth 30 次、Pro 100 次，Enterprise 依合約。'],
  [LockKeyhole, '資料隔離', '所有客戶資料都要綁 org.plan、org_id 與角色權限。'],
  [Building2, '台灣金流準備', '優先 ECPay 定期定額與電子發票，Stripe / TapPay 延後。'],
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
              每月固定費，把退貨、驗貨、AI 分析收進同一套流程。
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-200 sm:text-lg">
              Basic、Growth、Pro、Enterprise 四種方案，先以手動開通服務 Beta 客戶，再分階段接上 ECPay、電子發票與公開註冊。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-neutral-950 hover:bg-neutral-100">
                <Link href="/signup">
                  申請 14 天試用
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                <Link href="/pricing">查看方案</Link>
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
              <p className="text-sm font-semibold text-emerald-700">商業版核心</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950">
                從客服到倉庫，退貨資料只流向正確的組織。
              </h2>
              <p className="mt-4 text-base leading-7 text-neutral-600">
                先把 SaaS 需要的 org、plan、feature flag 與用量限制建好，再讓金流與公開註冊逐步開放。
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
              <p className="text-sm font-semibold text-emerald-700">固定月費方案</p>
              <h2 className="mt-3 text-3xl font-semibold text-neutral-950">先賣清楚的四種方案。</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/pricing">
                完整比較
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
              <h2 className="mt-3 text-3xl font-semibold leading-tight">先封閉付費 Beta，再開公開註冊。</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-300">
                商業化功能會依 Stage 開啟，不直接全量啟用，避免金流、資料隔離與 AI 成本一起放大風險。
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
