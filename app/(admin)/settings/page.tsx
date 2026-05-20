import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  Database,
  FileText,
  Flag,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingCards = [
  {
    href: '/settings/billing',
    title: '帳務與訂閱',
    description: '檢視目前方案、試用狀態、付款週期與電子發票欄位。',
    icon: CreditCard,
    badge: 'Stage 2',
  },
  {
    href: '/settings/usage',
    title: '用量與額度',
    description: '追蹤退貨量軟限制、AI 月額度與升級提示狀態。',
    icon: BarChart3,
    badge: 'Stage 1',
  },
  {
    href: '/settings/team',
    title: '團隊與角色',
    description: '管理 Owner、Admin、Staff、Viewer 與邀請流程。',
    icon: UsersRound,
    badge: 'Stage 1',
  },
  {
    href: '/settings/backup',
    title: '資料備份',
    description: '保留既有資料備份功能，後續需補上 org_id 範圍限制。',
    icon: Database,
    badge: 'Existing',
  },
] as const;

const guardRows = [
  ['Plan', '限制從 organizations.plan 解析，不依 APP_MODE 寫死。'],
  ['Feature Flag', 'public signup、billing、AI usage limit 等功能分段開啟。'],
  ['Role', 'Owner / Admin / Staff / Viewer 分層授權。'],
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">SaaS 設定</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            商業版組織、訂閱、用量與團隊設定入口。Beta 期間部分功能仍採平台管理員手動開通。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/pricing" target="_blank">
            查看公開方案
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {settingCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.href} className="rounded-lg">
              <CardHeader className="gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <Icon className="size-5" />
                  </span>
                  <Badge variant="outline">{item.badge}</Badge>
                </div>
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="w-full justify-between">
                  <Link href={item.href}>
                    開啟
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-700" />
              三層 guard
            </CardTitle>
            <CardDescription>
              所有商業功能都應同時檢查方案、功能旗標與組織角色。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {guardRows.map(([name, description]) => (
              <div key={name} className="rounded-md border p-4">
                <div className="text-sm font-semibold text-gray-950">{name}</div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-5 text-cyan-700" />
              Beta 開放狀態
            </CardTitle>
            <CardDescription>新功能先關閉，依 Stage 開啟。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              ['public_signup', '關閉'],
              ['billing', '關閉'],
              ['subscription_plan', '關閉'],
              ['ai_usage_limit', '開啟'],
              ['advanced_analytics', '關閉'],
              ['multi_tenant_admin', '關閉'],
              ['image_ai', '關閉'],
            ].map(([flag, state]) => (
              <div key={flag} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="font-mono text-xs">{flag}</span>
                <Badge variant={state === '開啟' ? 'default' : 'secondary'}>{state}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-950">
            <FileText className="size-5" />
            待串接項目
          </CardTitle>
          <CardDescription className="text-amber-800">
            此頁先提供 SaaS 商業設定骨架。正式啟用前仍需接上 SaaS Supabase migration、billing webhook 與 Email 通知。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
