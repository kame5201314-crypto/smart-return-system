import Link from 'next/link';
import { ArrowLeft, BadgeCheck, FileClock, Flag, ReceiptText, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DemoDataBanner } from '@/components/saas/demo-data-banner';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';

const detail = {
  id: 'demo-growth',
  name: '朝露選品',
  slug: 'morning-select',
  plan: SAAS_PLAN_DEFINITIONS.growth,
  status: 'trialing',
  owner: 'owner@morning.example',
  trialEnd: '2026-06-03',
  billingEmail: 'billing@morning.example',
  taxId: '12345678',
};

const memberRows = [
  ['owner@morning.example', 'Owner', 'active'],
  ['ops@morning.example', 'Admin', 'active'],
  ['warehouse@morning.example', 'Staff', 'active'],
  ['finance@morning.example', 'Viewer', 'invited'],
] as const;

const featureRows = [
  ['public_signup', 'off', 'Stage 3 前維持關閉'],
  ['billing', 'off', 'Stage 2 接 ECPay 測試後開啟'],
  ['subscription_plan', 'on', '方案限制由 org.plan 判斷'],
  ['ai_usage_limit', 'on', 'AI 額度硬上限'],
  ['advanced_analytics', 'on', 'Growth 以上開啟'],
  ['multi_tenant_admin', 'off', '需接 platform admin guard'],
] as const;

const auditRows = [
  ['2026-05-20 13:10', 'plan.reviewed', 'Growth trial limits reviewed'],
  ['2026-05-20 12:44', 'member.invited', 'finance@morning.example invited as Viewer'],
  ['2026-05-20 12:05', 'org.created', 'Manual Beta organization created'],
] as const;

export default async function InternalOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link href="/internal/orgs">
              <ArrowLeft className="size-4" />
              返回租戶清單
            </Link>
          </Button>
          <h2 className="text-2xl font-semibold">{detail.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo route id: {id}. 正式版會以 organization id 查詢 SaaS Supabase，不跨 org 讀取資料。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap gap-2">
            <Button disabled variant="outline" title="multi_tenant_admin 旗標開啟後可用">
              調整方案
            </Button>
            <Button disabled variant="outline" title="multi_tenant_admin 旗標開啟後可用">
              停用 / 恢復
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">需 platform admin guard 與 audit log 接好後啟用。</p>
        </div>
      </div>

      <DemoDataBanner>
        <span className="font-medium">租戶詳情示意</span>
        ：成員、旗標、帳務、Audit 皆為 demo 內容，正式版以該 org_id 從 SaaS Supabase 查詢。
      </DemoDataBanner>

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ['Plan', detail.plan.name, 'org.plan'],
          ['Status', detail.status, 'organizations.status'],
          ['Trial End', detail.trialEnd, 'subscriptions.trial_end'],
          ['Owner', detail.owner, 'organization_members.role=owner'],
        ].map(([label, value, helper]) => (
          <Card key={label} className="rounded-lg">
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-lg">{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-5 text-emerald-700" />
              成員與權限
            </CardTitle>
            <CardDescription>角色以 Owner / Admin / Staff / Viewer 為準。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberRows.map(([email, role, status]) => (
                  <TableRow key={email}>
                    <TableCell className="font-medium">{email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="size-5 text-cyan-700" />
              帳務資料
            </CardTitle>
            <CardDescription>Stage 2 接 ECPay 定期定額與電子發票。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {[
              ['Billing Email', detail.billingEmail],
              ['Tax ID', detail.taxId],
              ['Provider', 'ecpay'],
              ['Next Action', '等待測試金鑰與 webhook route'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 font-medium">{value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-5 text-emerald-700" />
              旗標狀態
            </CardTitle>
            <CardDescription>三層 guard：plan、feature flag、role。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {featureRows.map(([flag, state, note]) => (
                  <TableRow key={flag}>
                    <TableCell className="font-mono text-xs">{flag}</TableCell>
                    <TableCell>
                      <Badge variant={state === 'on' ? 'default' : 'outline'}>{state}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileClock className="size-5 text-cyan-700" />
              Audit Log
            </CardTitle>
            <CardDescription>正式操作需寫入 audit_logs，避免平台手動調整不可追蹤。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditRows.map(([time, event, note]) => (
                  <TableRow key={`${time}-${event}`}>
                    <TableCell className="text-muted-foreground">{time}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{event}</Badge>
                    </TableCell>
                    <TableCell>{note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
          <p>
            此頁尚未接正式資料源。後續要先確認 023/024/025 migration 已套到 SaaS project，並由 server route
            加上 platform admin guard 後，才開啟修改方案、停用租戶與帳務事件重送。
          </p>
        </div>
      </div>
    </div>
  );
}
