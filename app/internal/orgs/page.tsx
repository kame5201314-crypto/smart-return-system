import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CreditCard,
  Lightbulb,
  PlayCircle,
} from 'lucide-react';

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
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { PlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';
import {
  formatSuggestedActions,
  PLATFORM_ORG_STATUS_LABEL,
  PLATFORM_RISK_LEVEL_LABEL,
  PLATFORM_RISK_REASON_LABEL,
} from '@/components/internal/platform-labels';

function usagePercent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function formatTwd(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

function formatTrialEnd(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

function TrialCell({
  org,
}: {
  org: PlatformOrganizationListView['organizations'][number];
}) {
  if (org.status !== 'trialing' || org.daysUntilTrialEnd === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const days = org.daysUntilTrialEnd;
  const tone =
    days <= 3 ? 'text-red-600 font-medium' : days <= 7 ? 'text-amber-700 font-medium' : 'text-muted-foreground';
  const dateLabel = formatTrialEnd(org.trialEnd);

  return (
    <span className={`text-xs ${tone}`}>
      {days <= 0 ? '已到期' : `${dateLabel}（剩 ${days} 天）`}
    </span>
  );
}

function statusVariant(
  status: PlatformOrganizationListView['organizations'][number]['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  if (status === 'suspended' || status === 'past_due') return 'destructive';
  return 'outline';
}

function riskVariant(
  riskLevel: PlatformOrganizationListView['organizations'][number]['health']['riskLevel']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (riskLevel === 'at_risk') return 'destructive';
  if (riskLevel === 'watch') return 'secondary';
  return 'outline';
}

function OrgsContent({ data }: { data: PlatformOrganizationListView }) {
  const orgs = data.organizations;
  const summary = data.summary;
  const atRiskOrgs = orgs.filter((org) => org.health.riskLevel === 'at_risk');

  const summaryItems = [
    {
      label: '預估月營收',
      value: formatTwd(summary.estimatedActiveMrrTwd),
      helper: `試用潛在 ${formatTwd(summary.trialPipelineMrrTwd)}`,
      icon: CreditCard,
      alert: false,
    },
    {
      label: '使用中 / 試用',
      value: summary.activeOrTrialingOrganizations.toLocaleString('zh-TW'),
      helper: `${summary.trialingOrganizations.toLocaleString('zh-TW')} 個試用中`,
      icon: PlayCircle,
      alert: false,
    },
    {
      label: '需關注租戶',
      value: summary.atRiskOrganizations.toLocaleString('zh-TW'),
      helper: `${summary.pausedOrPastDueOrganizations.toLocaleString('zh-TW')} 個停用或逾期`,
      icon: AlertTriangle,
      alert: summary.atRiskOrganizations > 0,
    },
    {
      label: 'AI 額度用完',
      value: summary.aiLimitReachedOrganizations.toLocaleString('zh-TW'),
      helper: '需客服或升級介入',
      icon: Bot,
      alert: summary.aiLimitReachedOrganizations > 0,
    },
  ] as const;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={`rounded-lg ${item.alert ? 'border-amber-300 bg-amber-50/60' : ''}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>{item.label}</CardDescription>
                  <Icon className={`size-4 ${item.alert ? 'text-amber-600' : 'text-emerald-700'}`} />
                </div>
                <CardTitle className={`text-2xl ${item.alert ? 'text-amber-900' : ''}`}>
                  {item.value}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xs ${item.alert ? 'text-amber-800' : 'text-muted-foreground'}`}>
                  {item.helper}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {atRiskOrgs.length > 0 ? (
        <Card className="rounded-lg border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <AlertTriangle className="size-5 text-amber-600" />
              需關注的租戶（{atRiskOrgs.length}）
            </CardTitle>
            <CardDescription className="text-amber-900">
              達 80% / 100% 額度、付款異常或暫停的 org，建議主動跟進。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {atRiskOrgs.map((org) => (
                <li
                  key={org.id}
                  className="flex flex-col items-start justify-between gap-3 rounded-md border border-amber-200 bg-white p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/internal/orgs/${org.id}`}
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        {org.name}
                      </Link>
                      <Badge variant="outline">{SAAS_PLAN_DEFINITIONS[org.plan].name}</Badge>
                      <Badge variant={statusVariant(org.status)}>
                        {PLATFORM_ORG_STATUS_LABEL[org.status]}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {org.ownerEmail ?? '—'}
                    </div>
                    {org.health.riskReasons.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {org.health.riskReasons.map((reason) => (
                          <Badge key={reason} variant="destructive" className="text-xs">
                            {PLATFORM_RISK_REASON_LABEL[reason]}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {formatSuggestedActions(org.health.riskReasons).length > 0 ? (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                        <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>{formatSuggestedActions(org.health.riskReasons).join('；')}</span>
                      </div>
                    ) : null}
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/internal/orgs/${org.id}`}>
                      跟進
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>租戶清單</CardTitle>
          <CardDescription>所有租戶及其當月用量與健康度。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租戶</TableHead>
                <TableHead>方案</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>試用到期</TableHead>
                <TableHead>席次</TableHead>
                <TableHead>退貨量</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>健康度</TableHead>
                <TableHead className="text-right">操作</TableHead>
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
                      <Badge variant={statusVariant(org.status)}>
                        {PLATFORM_ORG_STATUS_LABEL[org.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-24">
                      <TrialCell org={org} />
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
                    <TableCell className="min-w-36">
                      <div className="flex flex-col gap-1">
                        <Badge variant={riskVariant(org.health.riskLevel)}>
                          {PLATFORM_RISK_LEVEL_LABEL[org.health.riskLevel]}
                        </Badge>
                        {org.health.riskReasons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {org.health.riskReasons.map((reason) => (
                              <Badge key={reason} variant="outline" className="text-xs">
                                {PLATFORM_RISK_REASON_LABEL[reason]}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
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
  redirectUnauthenticatedPlatformAdminResult(result, '/internal/orgs');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">租戶管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            平台所有租戶的方案、狀態、用量與健康度。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ManualBetaOrgForm />
          <p className="text-xs text-muted-foreground">
            停用 / 調整方案等寫入操作將於第二階段收費功能開通後提供。
          </p>
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
