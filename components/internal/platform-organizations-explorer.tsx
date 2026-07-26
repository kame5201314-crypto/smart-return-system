'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lightbulb, RotateCcw, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CopyEmailButton } from '@/components/internal/copy-email-button';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import { getPlatformOrganizationDisplayIdentity } from '@/lib/saas/platform-organization-display';
import type { PlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';
import {
  formatSuggestedActions,
  PLATFORM_ORG_STATUS_LABEL,
  PLATFORM_RISK_LEVEL_LABEL,
} from '@/components/internal/platform-labels';

type PlatformOrg = PlatformOrganizationListView['organizations'][number];
export type PlatformOrganizationFilter =
  | 'all'
  | 'attention'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'healthy';
type OrgSort = 'priority' | 'trial_end' | 'created_desc' | 'usage' | 'name';
type PlanFilter = 'all' | PlatformOrg['plan'];
type ProvisioningSourceFilter = 'all' | PlatformOrg['provisioningSource'];
const INITIAL_VISIBLE_ORGANIZATIONS = 20;

const FILTER_LABEL: Record<PlatformOrganizationFilter, string> = {
  all: '全部租戶',
  attention: '需關注',
  trialing: '試用中',
  active: '使用中',
  past_due: '待補款',
  suspended: '已停權',
  healthy: '健康',
};

const PROVISIONING_SOURCE_LABEL: Record<PlatformOrg['provisioningSource'], string> = {
  manual: '人工開通',
  google_self_service: 'Google 註冊',
  email_otp_self_service: '信箱註冊',
  phone_otp_self_service: '手機註冊',
};

function formatTrialEnd(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function isTrialExpired(org: PlatformOrg): boolean {
  return org.status === 'trialing' && org.daysUntilTrialEnd !== null && org.daysUntilTrialEnd <= 0;
}

function followUpTier(org: PlatformOrg): number {
  if (org.requiresAttention) return 0;
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

function matchesFilter(org: PlatformOrg, filter: PlatformOrganizationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'attention') return org.requiresAttention;
  if (filter === 'healthy') return org.health.riskLevel === 'healthy' && !org.requiresAttention;
  return org.status === filter;
}

function compareOrganizations(a: PlatformOrg, b: PlatformOrg, sort: OrgSort): number {
  const displayNameA = getPlatformOrganizationDisplayIdentity(a).primaryLabel;
  const displayNameB = getPlatformOrganizationDisplayIdentity(b).primaryLabel;
  if (sort === 'name') return displayNameA.localeCompare(displayNameB, 'zh-TW');
  if (sort === 'usage') return maxUsagePercent(b) - maxUsagePercent(a);
  if (sort === 'trial_end') {
    const daysA = a.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    const daysB = b.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    return daysA - daysB || displayNameA.localeCompare(displayNameB, 'zh-TW');
  }
  if (sort === 'created_desc') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  return (
    followUpTier(a) - followUpTier(b) ||
    (a.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY) -
      (b.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY) ||
    displayNameA.localeCompare(displayNameB, 'zh-TW')
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
  const attention = org.requiresAttention;
  const label = attention ? '需關注' : PLATFORM_RISK_LEVEL_LABEL[org.health.riskLevel];
  const className = attention
    ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-50'
    : org.health.riskLevel === 'watch'
      ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50';
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function StatusBadge({ org }: { org: PlatformOrg }) {
  const className = org.status === 'suspended'
    ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-50'
    : org.status === 'past_due'
      ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50'
      : org.status === 'active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50'
        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-white';

  return (
    <Badge variant="outline" className={className}>
      {PLATFORM_ORG_STATUS_LABEL[org.status]}
    </Badge>
  );
}

function ProvisioningSourceBadge({ org }: { org: PlatformOrg }) {
  return (
    <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-50">
      {PROVISIONING_SOURCE_LABEL[org.provisioningSource]}
    </Badge>
  );
}

function SummaryChips({
  summary,
  pastDueCount,
  suspendedCount,
  filter,
  onFilterChange,
}: {
  summary: PlatformOrganizationListView['summary'];
  pastDueCount: number;
  suspendedCount: number;
  filter: PlatformOrganizationFilter;
  onFilterChange: (filter: PlatformOrganizationFilter) => void;
}) {
  const chipClass = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition';
  const pressedClass = 'font-semibold ring-2 ring-neutral-950 ring-offset-2';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${chipClass} border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 ${filter === 'attention' ? pressedClass : ''}`}
        aria-pressed={filter === 'attention'}
        onClick={() => onFilterChange(filter === 'attention' ? 'all' : 'attention')}
      >
        需關注 <span className="font-semibold">{summary.attentionOrganizations}</span>
      </button>
      <button
        type="button"
        className={`${chipClass} border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 ${filter === 'trialing' ? pressedClass : ''}`}
        aria-pressed={filter === 'trialing'}
        onClick={() => onFilterChange(filter === 'trialing' ? 'all' : 'trialing')}
      >
        試用中 <span className="font-semibold">{summary.trialingOrganizations}</span>
      </button>
      <button
        type="button"
        className={`${chipClass} border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 ${filter === 'past_due' ? pressedClass : ''}`}
        aria-pressed={filter === 'past_due'}
        onClick={() => onFilterChange(filter === 'past_due' ? 'all' : 'past_due')}
      >
        待補款 <span className="font-semibold">{pastDueCount}</span>
      </button>
      <button
        type="button"
        className={`${chipClass} border-red-200 bg-red-50 text-red-800 hover:bg-red-100 ${filter === 'suspended' ? pressedClass : ''}`}
        aria-pressed={filter === 'suspended'}
        onClick={() => onFilterChange(filter === 'suspended' ? 'all' : 'suspended')}
      >
        已停權 <span className="font-semibold">{suspendedCount}</span>
      </button>
    </div>
  );
}

function TenantMobileCard({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  const suggestions = buildSuggestions(org);
  const identity = getPlatformOrganizationDisplayIdentity(org);
  const secondaryLabel = identity.secondaryLabel === identity.primaryLabel
    ? null
    : identity.secondaryLabel;
  return (
    <li className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1">
            <Link className="font-semibold text-emerald-700 underline-offset-4 hover:underline" href={`/internal/orgs/${org.id}`}>
              {identity.primaryLabel}
            </Link>
            {org.ownerEmail === identity.primaryLabel ? <CopyEmailButton email={org.ownerEmail} /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{plan.name}</p>
        </div>
        <HealthBadge org={org} />
      </div>
      {secondaryLabel || (org.ownerEmail && org.ownerEmail !== identity.primaryLabel) ? (
        <div className="mt-3 flex items-center gap-1">
          <p className="min-w-0 break-all text-xs text-muted-foreground">
            {secondaryLabel ?? org.ownerEmail}
          </p>
          {org.ownerEmail ? <CopyEmailButton email={org.ownerEmail} /> : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusBadge org={org} />
        <ProvisioningSourceBadge org={org} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground"><TrialCountdown org={org} /></div>
      <div className="mt-2"><UsageLine org={org} /></div>
      {suggestions.length > 0 ? (
        <div className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{suggestions.join('；')}</span>
        </div>
      ) : null}
      <Button asChild variant="outline" size="sm" className="mt-4 w-full">
        <Link href={`/internal/orgs/${org.id}`} aria-label={`管理租戶：${identity.primaryLabel}`}>
          管理租戶
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

export function PlatformOrganizationsExplorer({
  data,
  initialFilter = 'all',
}: {
  data: PlatformOrganizationListView;
  initialFilter?: PlatformOrganizationFilter;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlatformOrganizationFilter>(initialFilter);
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<ProvisioningSourceFilter>('all');
  const [sort, setSort] = useState<OrgSort>('priority');
  const [expanded, setExpanded] = useState(false);
  const pastDueCount = data.organizations.filter((org) => org.status === 'past_due').length;
  const suspendedCount = data.organizations.filter((org) => org.status === 'suspended').length;

  const visibleOrganizations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return data.organizations
      .filter((org) => matchesFilter(org, filter))
      .filter((org) => planFilter === 'all' || org.plan === planFilter)
      .filter((org) => sourceFilter === 'all' || org.provisioningSource === sourceFilter)
      .filter((org) => {
        if (!normalizedQuery) return true;
        const planName = SAAS_PLAN_DEFINITIONS[org.plan].name;
        const identity = getPlatformOrganizationDisplayIdentity(org);
        return [identity.primaryLabel, identity.secondaryLabel ?? '', org.slug, planName]
          .some((value) => value.toLocaleLowerCase('zh-TW').includes(normalizedQuery));
      })
      .sort((a, b) => compareOrganizations(a, b, sort));
  }, [data.organizations, filter, planFilter, query, sort, sourceFilter]);

  const displayedOrganizations = expanded
    ? visibleOrganizations
    : visibleOrganizations.slice(0, INITIAL_VISIBLE_ORGANIZATIONS);
  const hiddenOrganizationCount = visibleOrganizations.length - displayedOrganizations.length;

  function changeFilter(nextFilter: PlatformOrganizationFilter) {
    setFilter(nextFilter);
    setExpanded(false);
  }

  function resetControls() {
    setQuery('');
    setFilter('all');
    setPlanFilter('all');
    setSourceFilter('all');
    setSort('priority');
    setExpanded(false);
  }

  return (
    <div className="space-y-4">
      <SummaryChips
        summary={data.summary}
        pastDueCount={pastDueCount}
        suspendedCount={suspendedCount}
        filter={filter}
        onFilterChange={changeFilter}
      />

      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_150px_150px_180px_180px_auto] xl:items-end">
            <div>
              <label htmlFor="tenant-search" className="text-sm font-medium">搜尋租戶</label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="tenant-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setExpanded(false);
                  }}
                  placeholder="品牌、信箱、代碼或方案"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tenant-plan-filter" className="text-sm font-medium">方案</label>
              <select
                id="tenant-plan-filter"
                value={planFilter}
                onChange={(event) => {
                  setPlanFilter(event.target.value as PlanFilter);
                  setExpanded(false);
                }}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">全部方案</option>
                {Object.entries(SAAS_PLAN_DEFINITIONS).map(([value, definition]) => (
                  <option key={value} value={value}>{definition.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tenant-source-filter" className="text-sm font-medium">開通來源</label>
              <select
                id="tenant-source-filter"
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value as ProvisioningSourceFilter);
                  setExpanded(false);
                }}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="all">全部來源</option>
                {Object.entries(PROVISIONING_SOURCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tenant-filter" className="text-sm font-medium">租戶狀態</label>
              <select
                id="tenant-filter"
                value={filter}
                onChange={(event) => changeFilter(event.target.value as PlatformOrganizationFilter)}
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
                onChange={(event) => {
                  setSort(event.target.value as OrgSort);
                  setExpanded(false);
                }}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="priority">處理優先級</option>
                <option value="trial_end">試用到期日</option>
                <option value="created_desc">建立時間（新到舊）</option>
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
            共 {data.organizations.length} 個租戶；符合 {visibleOrganizations.length} 筆，目前顯示 {displayedOrganizations.length} 筆
          </p>
        </CardContent>
      </Card>

      {visibleOrganizations.length > 0 ? (
        <>
          <ul className="space-y-3 md:hidden">
            {displayedOrganizations.map((org) => <TenantMobileCard key={org.id} org={org} />)}
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
                {displayedOrganizations.map((org) => {
                  const suggestions = buildSuggestions(org);
                  const identity = getPlatformOrganizationDisplayIdentity(org);
                  const secondaryLabel = identity.secondaryLabel === identity.primaryLabel
                    ? null
                    : identity.secondaryLabel;
                  return (
                    <tr key={org.id} className="align-top hover:bg-neutral-50/70">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <Link className="font-medium text-emerald-700 underline-offset-4 hover:underline" href={`/internal/orgs/${org.id}`}>
                            {identity.primaryLabel}
                          </Link>
                          {org.ownerEmail === identity.primaryLabel ? <CopyEmailButton email={org.ownerEmail} /> : null}
                        </div>
                        {secondaryLabel ? (
                          <div className="mt-1 flex max-w-60 items-center gap-1">
                            <p className="min-w-0 break-all text-xs text-muted-foreground">{secondaryLabel}</p>
                            {org.ownerEmail ? <CopyEmailButton email={org.ownerEmail} /> : null}
                          </div>
                        ) : org.ownerEmail && org.ownerEmail !== identity.primaryLabel ? (
                          <div className="mt-1 flex max-w-60 items-center gap-1">
                            <p className="min-w-0 break-all text-xs text-muted-foreground">{org.ownerEmail}</p>
                            <CopyEmailButton email={org.ownerEmail} />
                          </div>
                        ) : null}
                        <div className="mt-2">
                          <ProvisioningSourceBadge org={org} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p>{SAAS_PLAN_DEFINITIONS[org.plan].name}</p>
                        <div className="mt-2">
                          <StatusBadge org={org} />
                        </div>
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
                          <Link href={`/internal/orgs/${org.id}`} aria-label={`管理租戶：${identity.primaryLabel}`}>
                            管理
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

          {visibleOrganizations.length > INITIAL_VISIBLE_ORGANIZATIONS ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
              >
                {expanded
                  ? `收合至前 ${INITIAL_VISIBLE_ORGANIZATIONS} 筆`
                  : `顯示其餘 ${hiddenOrganizationCount} 筆`}
              </Button>
            </div>
          ) : null}
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
