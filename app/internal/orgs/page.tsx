import Link from 'next/link';
import { ArrowRight, Building2, PauseCircle, PlayCircle, UsersRound } from 'lucide-react';

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
import { UsageProgress } from '@/components/saas/usage-progress';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { ManualBetaOrgForm } from '@/components/internal/manual-beta-org-form';
import { loadPlatformOrganizationsView } from '@/lib/saas/platform-admin-live-data';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { PlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';

function usagePercent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function statusVariant(
  status: PlatformOrganizationListView['organizations'][number]['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  if (status === 'suspended' || status === 'past_due') return 'destructive';
  return 'outline';
}

function OrgsContent({ data }: { data: PlatformOrganizationListView }) {
  const orgs = data.organizations;
  const activeCount = orgs.filter((org) => org.status === 'active' || org.status === 'trialing').length;
  const pausedCount = orgs.filter((org) => org.status === 'suspended' || org.status === 'past_due').length;
  const totalSeats = orgs.reduce((sum, org) => sum + org.memberCount, 0);

  const summaryItems = [
    { label: '租戶總數', value: orgs.length, helper: '平台上的 SaaS 組織', icon: Building2 },
    { label: '使用中 / 試用', value: activeCount, helper: 'active 或 trialing', icon: PlayCircle },
    { label: '暫停 / 逾期', value: pausedCount, helper: 'suspended 或 past_due', icon: PauseCircle },
    { label: '總席次使用', value: totalSeats, helper: '跨 org 成員數', icon: UsersRound },
  ] as const;

  return (
    <>
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
                <CardTitle className="text-2xl">{item.value.toLocaleString('zh-TW')}</CardTitle>
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
          <CardDescription>來自 organizations、organization_members 與當月用量。</CardDescription>
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
              {orgs.map((org) => {
                const plan = SAAS_PLAN_DEFINITIONS[org.plan];
                const seatPercent = usagePercent(org.memberCount, plan.seatLimit);
                const returnPercent = usagePercent(org.usage.returnsThisMonth, plan.monthlyReturnSoftLimit);
                const aiPercent = usagePercent(org.usage.aiUsedThisMonth, plan.aiMonthlyLimit);

                return (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-muted-foreground">{org.slug}</div>
                      <div className="text-xs text-muted-foreground">{org.ownerEmail ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(org.status)}>{org.status}</Badge>
                    </TableCell>
                    <TableCell className="min-w-28">
                      <div className="mb-1 text-xs text-muted-foreground">
                        {org.memberCount} / {plan.seatLimit ?? '合約'}
                      </div>
                      <UsageProgress value={seatPercent} aria-label={`${org.name} 席次使用率 ${seatPercent}%`} />
                    </TableCell>
                    <TableCell className="min-w-32">
                      <div className="mb-1 text-xs text-muted-foreground">
                        {org.usage.returnsThisMonth.toLocaleString('zh-TW')} /{' '}
                        {plan.monthlyReturnSoftLimit?.toLocaleString('zh-TW') ?? '合約'}
                      </div>
                      <UsageProgress value={returnPercent} aria-label={`${org.name} 退貨量使用率 ${returnPercent}%`} />
                    </TableCell>
                    <TableCell className="min-w-28">
                      <div className="mb-1 text-xs text-muted-foreground">
                        {org.usage.aiUsedThisMonth} / {plan.aiMonthlyLimit ?? '合約'}
                      </div>
                      <UsageProgress value={aiPercent} aria-label={`${org.name} AI 額度使用率 ${aiPercent}%`} />
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
    </>
  );
}

export default async function InternalOrgsPage() {
  const result = await loadPlatformOrganizationsView();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Organizations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            平台租戶總覽，資料來自 organizations、organization_members 與 subscriptions。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap gap-2">
            <Button disabled variant="outline" title="租戶寫入操作待 platform admin 後端接好後開放">
              <PauseCircle className="size-4" />
              停用租戶
            </Button>
            <ManualBetaOrgForm />
          </div>
          <p className="text-xs text-muted-foreground">目前為唯讀檢視；停用 / 開通需 audit log 寫入接好後啟用。</p>
        </div>
      </div>

      {result.state === 'ready' ? (
        <OrgsContent data={result.data} />
      ) : result.state === 'gated' ? (
        <SettingsStateCard variant="gated" gated={result.gated} />
      ) : result.state === 'empty' ? (
        <SettingsStateCard variant="empty" message={result.message} />
      ) : (
        <SettingsStateCard variant="error" message={result.message} />
      )}
    </div>
  );
}
