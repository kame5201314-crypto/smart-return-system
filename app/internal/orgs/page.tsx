import Link from 'next/link';
import { ArrowRight, Building2, CircleDollarSign, PauseCircle, PlayCircle, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SAAS_PLAN_DEFINITIONS, type SaaSPlanCode } from '@/lib/config/saas-plans';

const orgRows = [
  {
    id: 'demo-growth',
    name: '朝露選品',
    slug: 'morning-select',
    plan: 'growth',
    status: 'trialing',
    owner: 'owner@morning.example',
    seatsUsed: 7,
    returnsUsed: 1320,
    aiUsed: 21,
  },
  {
    id: 'demo-pro',
    name: '島嶼生活',
    slug: 'island-life',
    plan: 'pro',
    status: 'active',
    owner: 'owner@island.example',
    seatsUsed: 18,
    returnsUsed: 5120,
    aiUsed: 62,
  },
  {
    id: 'demo-basic',
    name: '巷口小店',
    slug: 'lane-shop',
    plan: 'basic',
    status: 'suspended',
    owner: 'owner@lane.example',
    seatsUsed: 3,
    returnsUsed: 420,
    aiUsed: 5,
  },
] satisfies Array<{
  id: string;
  name: string;
  slug: string;
  plan: SaaSPlanCode;
  status: string;
  owner: string;
  seatsUsed: number;
  returnsUsed: number;
  aiUsed: number;
}>;

const summaryItems = [
  { label: 'Active / Trial', value: '2', helper: '可用中的 SaaS 租戶', icon: Building2 },
  { label: 'Suspended', value: '1', helper: '可登入但不可新增資料', icon: PauseCircle },
  { label: 'MRR Preview', value: 'NT$10,980', helper: '示意值，待 billing table 串接', icon: CircleDollarSign },
  { label: 'Seat Usage', value: '28', helper: '跨 org 帳號使用量', icon: UsersRound },
] as const;

function usagePercent(used: number, limit: number | null) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  if (status === 'suspended') return 'destructive';
  return 'outline';
}

export default function InternalOrgsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Organizations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            平台管理員的租戶總覽骨架。此頁目前只放示意資料，不讀寫任何 Supabase 專案。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled variant="outline">
            <PauseCircle className="size-4" />
            停用租戶
          </Button>
          <Button disabled>
            <PlayCircle className="size-4" />
            手動開通
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>{item.label}</CardDescription>
                  <Icon className="size-4 text-emerald-700" />
                </div>
                <CardTitle className="text-2xl">{item.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{item.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>租戶清單</CardTitle>
          <CardDescription>
            Stage 1 會由 service role server route 讀取 organizations、organization_members、subscriptions。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Org</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Returns</TableHead>
                <TableHead>AI</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgRows.map((org) => {
                const plan = SAAS_PLAN_DEFINITIONS[org.plan];
                const seatPercent = usagePercent(org.seatsUsed, plan.seatLimit);
                const returnPercent = usagePercent(org.returnsUsed, plan.monthlyReturnSoftLimit);
                const aiPercent = usagePercent(org.aiUsed, plan.aiMonthlyLimit);

                return (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-muted-foreground">{org.slug}</div>
                      <div className="text-xs text-muted-foreground">{org.owner}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(org.status)}>{org.status}</Badge>
                    </TableCell>
                    <TableCell className="min-w-28">
                      <div className="mb-1 text-xs text-muted-foreground">
                        {org.seatsUsed} / {plan.seatLimit ?? '合約'}
                      </div>
                      <Progress value={seatPercent} />
                    </TableCell>
                    <TableCell className="min-w-32">
                      <div className="mb-1 text-xs text-muted-foreground">
                        {org.returnsUsed.toLocaleString('zh-TW')} /{' '}
                        {plan.monthlyReturnSoftLimit?.toLocaleString('zh-TW') ?? '合約'}
                      </div>
                      <Progress value={returnPercent} />
                    </TableCell>
                    <TableCell className="min-w-28">
                      <div className="mb-1 text-xs text-muted-foreground">
                        {org.aiUsed} / {plan.aiMonthlyLimit ?? '合約'}
                      </div>
                      <Progress value={aiPercent} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/internal/orgs/${org.id}`}>
                          查看
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
