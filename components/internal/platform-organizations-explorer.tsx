'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lightbulb, RotateCcw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { PlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';
import {
  formatSuggestedActions,
  PLATFORM_ORG_STATUS_LABEL,
  PLATFORM_RISK_LEVEL_LABEL,
} from '@/components/internal/platform-labels';

type PlatformOrg = PlatformOrganizationListView['organizations'][number];
type OrgFilter = 'all' | 'attention' | 'trialing' | 'active' | 'past_due' | 'healthy';
type OrgSort = 'priority' | 'trial_end' | 'usage' | 'name';

const FILTER_LABEL: Record<OrgFilter, string> = {
  all: '全部租戶',
  attention: '需關注',
  trialing: '試用中',
  active: '使用中',
  past_due: '待補款／暫停',
  healthy: '健康',
};

function formatTwd(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

function formatTrialEnd(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function isTrialExpired(org: PlatformOrg): boolean {
  return org.status === 'trialing' && org.daysUntilTrialEnd !== null && org.daysUntilTrialEnd <= 0;
}

function needsAttention(org: PlatformOrg): boolean {
  return org.health.riskLevel === 'at_risk' || isTrialExpired(org);
}

function followUpTier(org: PlatformOrg): number {
  if (needsAttention(org)) return 0;
  if (org.health.riskLevel === 'watch') return 1;
  return 2;
}

function maxUsagePercent(org: PlatformOrg): number {
  return Math.max(
    ...Object.values(org.health.usagePercentages).filter(
      (value): value is number => typeof value === 'number'
    ),
    0
  );
}

function buildSuggestions(org: PlatformOrg): string[] {
  const actions = formatSuggestedActions(org.health.riskReasons);
  if (isTrialExpired(org)) {
    return ['聯絡客戶確認續約或延長試用', ...actions];
  }
  return actions;
}

function matchesFilter(org: PlatformOrg, filter: OrgFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'attention') return needsAttention(org);
  if (filter === 'healthy') return org.health.riskLevel === 'healthy' && !isTrialExpired(org);
  if (filter === 'past_due') return org.status === 'past_due' || org.status === 'suspended';
  return org.status === filter;
}

function compareOrganizations(a: PlatformOrg, b: PlatformOrg, sort: OrgSort): number {
  if (sort === 'name') return a.name.localeCompare(b.name, 'zh-TW');
  if (sort === 'usage') return maxUsagePercent(b) - maxUsagePercent(a);
  if (sort === 'trial_end') {
    const daysA = a.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    const daysB = b.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    return daysA - daysB || a.name.localeCompare(b.name, 'zh-TW');
  }
  return (
    followUpTier(a) - followUpTier(b) ||
    (a.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY) -
      (b.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY) ||
    a.name.localeCompare(b.name, 'zh-TW')
  );
}

function TrialCountdown({ org }: { org: PlatformOrg }) {
  if (org.status !== 'trialing' || org.daysUntilTrialEnd === null) return <span>—</span>;
  if (org.daysUntilTrialEnd <= 0) {
    return <span className="font-medium text-red-700">已到期</span>;
  }
  const tone = org.daysUntilTrialEnd <= 7 ? 'font-medium text-amber-800' : '';
  return (
    <span className={tone}>
      {formatTrialEnd(org.trialEnd)}（剩 {org.daysUntilTrialEnd} 天）
    </span>
  );
}

function UsageMetric({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit && limit > 0 ? (used / limit) * 100 : null;
  const tone = percent !== null && percent >= 100
    ? 'font-semibold text-red-700'
    : percent !== null && percent >= 80
      ? 'font-medium text-amber-800'
      : 'text-muted-foreground';

  return (
    <span className={tone}>
      {label} {used.toLocaleString('zh-TW')} / {limit?.toLocaleString('zh-TW') ?? '合約'}
    </span>
  );
}

function UsageLine({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
      <UsageMetric label="席次" used={org.memberCount} limit={plan.seatLimit} />
      <UsageMetric label="退貨" used={org.usage.returnsThisMonth} limit={plan.monthlyReturnSoftLimit} />
      <UsageMetric label="AI" used={org.usage.aiUsedThisMonth} limit={plan.aiMonthlyLimit} />
    </span>
  );
}

function HealthBadge({ org }: { org: PlatformOrg }) {
  const attention = needsAttention(org);
  const label = attention ? '需關注' : PLATFORM_RISK_LEVEL_LABEL[org.health.riskLevel];
  const className = attention
    ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-50'
    : org.health.riskLevel === 'watch'
      ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50';
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function SummaryChips({
  summary,
  attentionCount,
  filter,
  onFilterChange,
}: {
  summary: PlatformOrganizationListView['summary'];
  attentionCount: number;
  filter: OrgFilter;
  onFilterChange: (filter: OrgFilter) => void;
}) {
  const chipClass = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${chipClass} border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100`}
        aria-pressed={filter === 'attention'}
        onClick={() => onFilterChange(filter === 'attention' ? 'all' : 'attention')}
      >
        需關注 <span className="font-semibold">{attentionCount}</span>
      </button>
      <button
        type="button"
        className={`${chipClass} border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100`}
        aria-pressed={filter === 'trialing'}
        onClick={() => onFilterChange(filter === 'trialing' ? 'all' : 'trialing')}
      >
        試用中 <span className="font-semibold">{summary.trialingOrganizations}</span>
      </button>
      <span className={`${chipClass} border-neutral-200 bg-white text-neutral-700`}>
        月營收 <span className="font-semibold">{formatTwd(summary.estimatedActiveMrrTwd)}</span>
      </span>
      <span className={`${chipClass} border-neutral-200 bg-white text-neutral-700`}>
        試用潛在 <span className="font-semibold">{formatTwd(summary.trialPipelineMrrTwd)}</span>
      </span>
    </div>
  );
}

function TenantMobileCard({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  const suggestions = buildSuggestions(org);
  return (
    <li className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link className="font-semibold text-emerald-700 underline-offset-4 hover:underline" href={`/internal/orgs/${org.id}`}>
            {org.name}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.name} · {PLATFORM_ORG_STATUS_LABEL[org.status]}
          </p>
        </div>
        <HealthBadge org={org} />
      </div>
      <p className="mt-3 break-all text-xs text-muted-foreground">{org.ownerEmail ?? '未提供帳號信箱'}</p>
      <div className="mt-2 text-xs text-muted-foreground"><TrialCountdown org={org} /></div>
      <div className="mt-2"><UsageLine org={org} /></div>
      {suggestions.length > 0 ? (
        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{suggestions.join('；')}</span>
        </div>
      ) : null}
      <Button asChild variant="outline" size="sm" className="mt-4 w-full">
        <Link href={`/internal/orgs/${org.id}`} aria-label={`查看租戶：${org.name}`}>
          查看租戶
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

export function PlatformOrganizationsExplorer({ data }: { data: PlatformOrganizationListView }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OrgFilter>('all');
  const [sort, setSort] = useState<OrgSort>('priority');
  const attentionCount = data.organizations.filter(needsAttention).length;

  const visibleOrganizations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return data.organizations
      .filter((org) => matchesFilter(org, filter))
      .filter((org) => {
        if (!normalizedQuery) return true;
        const planName = SAAS_PLAN_DEFINITIONS[org.plan].name;
        return [org.name, org.slug, org.ownerEmail ?? '', planName]
          .some((value) => value.toLocaleLowerCase('zh-TW').includes(normalizedQuery));
      })
      .sort((a, b) => compareOrganizations(a, b, sort));
  }, [data.organizations, filter, query, sort]);

  function resetControls() {
    setQuery('');
    setFilter('all');
    setSort('priority');
  }

  return (
    <div className="space-y-4">
      <SummaryChips
        summary={data.summary}
        attentionCount={attentionCount}
        filter={filter}
        onFilterChange={setFilter}
      />

      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_200px_200px_auto] lg:items-end">
            <div>
              <label htmlFor="tenant-search" className="text-sm font-medium">搜尋租戶</label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="tenant-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="品牌、信箱、代碼或方案"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tenant-filter" className="text-sm font-medium">租戶狀態</label>
              <select
                id="tenant-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value as OrgFilter)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {Object.entries(FILTER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tenant-sort" className="text-sm font-medium">排序方式</label>
              <select
                id="tenant-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as OrgSort)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="priority">處理優先級</option>
                <option value="trial_end">試用到期日</option>
                <option value="usage">最高用量</option>
                <option value="name">品牌名稱</option>
              </select>
            </div>
            <Button type="button" variant="outline" onClick={resetControls}>
              <RotateCcw className="size-4" aria-hidden="true" />
              清除條件
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            顯示 {visibleOrganizations.length} / {data.organizations.length} 個租戶
          </p>
        </CardContent>
      </Card>

      {visibleOrganizations.length > 0 ? (
        <>
          <ul className="space-y-3 md:hidden">
            {visibleOrganizations.map((org) => <TenantMobileCard key={org.id} org={org} />)}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border bg-white md:block">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">租戶</th>
                  <th scope="col" className="px-4 py-3 font-medium">方案與狀態</th>
                  <th scope="col" className="px-4 py-3 font-medium">試用到期</th>
                  <th scope="col" className="px-4 py-3 font-medium">本月用量</th>
                  <th scope="col" className="px-4 py-3 font-medium">健康狀態</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleOrganizations.map((org) => {
                  const suggestions = buildSuggestions(org);
                  return (
                    <tr key={org.id} className="align-top hover:bg-neutral-50/70">
                      <td className="px-4 py-4">
                        <Link className="font-medium text-emerald-700 underline-offset-4 hover:underline" href={`/internal/orgs/${org.id}`}>
                          {org.name}
                        </Link>
                        <p className="mt-1 max-w-52 break-all text-xs text-muted-foreground">{org.ownerEmail ?? '未提供帳號信箱'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p>{SAAS_PLAN_DEFINITIONS[org.plan].name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{PLATFORM_ORG_STATUS_LABEL[org.status]}</p>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground"><TrialCountdown org={org} /></td>
                      <td className="px-4 py-4"><UsageLine org={org} /></td>
                      <td className="px-4 py-4">
                        <HealthBadge org={org} />
                        {suggestions.length > 0 ? (
                          <p className="mt-2 max-w-60 text-xs leading-5 text-muted-foreground">{suggestions.join('；')}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/internal/orgs/${org.id}`} aria-label={`查看租戶：${org.name}`}>
                            查看
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed bg-white px-5 py-10 text-center" role="status">
          <p className="text-sm font-medium">找不到符合條件的租戶</p>
          <p className="mt-1 text-xs text-muted-foreground">請調整搜尋文字或清除篩選條件。</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={resetControls}>
            清除條件
          </Button>
        </div>
      )}
    </div>
  );
}
