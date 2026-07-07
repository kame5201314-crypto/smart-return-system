import Link from 'next/link';
import { ArrowRight, Lightbulb } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { ManualBetaOrgForm } from '@/components/internal/manual-beta-org-form';
import { loadPlatformOrganizationsView } from '@/lib/saas/platform-admin-live-data';
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import type { PlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';
import {
  formatSuggestedActions,
  PLATFORM_ORG_STATUS_LABEL,
} from '@/components/internal/platform-labels';

type PlatformOrg = PlatformOrganizationListView['organizations'][number];

function formatTwd(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

function formatTrialEnd(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

function isTrialExpired(org: PlatformOrg): boolean {
  return org.status === 'trialing' && org.daysUntilTrialEnd !== null && org.daysUntilTrialEnd <= 0;
}

// 需關注＝帳務/額度風險（at_risk）或試用已到期——第一屏要直接回答「今天要跟進誰」。
function needsAttention(org: PlatformOrg): boolean {
  return org.health.riskLevel === 'at_risk' || isTrialExpired(org);
}

function followUpTier(org: PlatformOrg): number {
  if (needsAttention(org)) return 0;
  if (org.health.riskLevel === 'watch') return 1;
  return 2;
}

function sortForFollowUp(orgs: readonly PlatformOrg[]): PlatformOrg[] {
  return [...orgs].sort((a, b) => {
    const tierDiff = followUpTier(a) - followUpTier(b);
    if (tierDiff !== 0) return tierDiff;
    const daysA = a.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    const daysB = b.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    if (daysA !== daysB) return daysA - daysB;
    return a.name.localeCompare(b.name, 'zh-TW');
  });
}

function buildSuggestions(org: PlatformOrg): string[] {
  const actions = formatSuggestedActions(org.health.riskReasons);
  if (isTrialExpired(org)) {
    return ['聯絡客戶確認續約或延長試用', ...actions];
  }
  return actions;
}

function statusVariant(
  status: PlatformOrg['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'trialing') return 'secondary';
  if (status === 'suspended' || status === 'past_due') return 'destructive';
  return 'outline';
}

function TrialCountdown({ org }: { org: PlatformOrg }) {
  if (org.status !== 'trialing' || org.daysUntilTrialEnd === null) {
    return null;
  }

  const days = org.daysUntilTrialEnd;
  if (days <= 0) {
    return <span className="text-xs font-medium text-red-600">試用已到期</span>;
  }

  const tone =
    days <= 3 ? 'font-medium text-red-600' : days <= 7 ? 'font-medium text-amber-700' : 'text-muted-foreground';
  return (
    <span className={`text-xs ${tone}`}>
      {formatTrialEnd(org.trialEnd)}（剩 {days} 天）
    </span>
  );
}

// 0 用量不視覺化：預設純文字，>=80% 琥珀、>=100% 紅色加粗。
function UsageMetric({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit && limit > 0 ? (used / limit) * 100 : null;
  const tone =
    percent === null
      ? 'text-muted-foreground'
      : percent >= 100
        ? 'font-semibold text-red-600'
        : percent >= 80
          ? 'font-medium text-amber-700'
          : 'text-muted-foreground';

  return (
    <span className={tone}>
      {label} {used.toLocaleString('zh-TW')} / {limit?.toLocaleString('zh-TW') ?? '合約'}
    </span>
  );
}

function OrgCard({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  const attention = needsAttention(org);
  const suggestions = buildSuggestions(org);

  return (
    <li
      className={`rounded-lg border bg-white p-4 ${
        attention ? 'border-l-4 border-amber-200 border-l-amber-500 bg-amber-50/30' : 'border-neutral-200'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {attention ? <Badge variant="destructive">需關注</Badge> : null}
            <Link
              href={`/internal/orgs/${org.id}`}
              className="font-medium text-neutral-950 hover:text-emerald-700 hover:underline"
            >
              {org.name}
            </Link>
            <Badge variant="outline">{plan.name}</Badge>
            <Badge variant={statusVariant(org.status)}>
              {PLATFORM_ORG_STATUS_LABEL[org.status]}
            </Badge>
            <TrialCountdown org={org} />
          </div>

          <div className="text-xs text-muted-foreground">{org.ownerEmail ?? '—'}</div>

          <div className="flex flex-wrap gap-x-2 text-xs">
            <UsageMetric label="席次" used={org.memberCount} limit={plan.seatLimit} />
            <span className="text-muted-foreground">·</span>
            <UsageMetric
              label="退貨"
              used={org.usage.returnsThisMonth}
              limit={plan.monthlyReturnSoftLimit}
            />
            <span className="text-muted-foreground">·</span>
            <UsageMetric label="AI" used={org.usage.aiUsedThisMonth} limit={plan.aiMonthlyLimit} />
          </div>

          {suggestions.length > 0 ? (
            <div className="flex items-start gap-1.5 text-xs text-amber-800">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>建議：{suggestions.join('；')}</span>
            </div>
          ) : null}
        </div>

        <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
          <Link href={`/internal/orgs/${org.id}`}>
            查看
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

function OrgsContent({ data }: { data: PlatformOrganizationListView }) {
  const summary = data.summary;
  const orgs = sortForFollowUp(data.organizations);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {summary.totalOrganizations.toLocaleString('zh-TW')} 個租戶 ·{' '}
        {summary.trialingOrganizations.toLocaleString('zh-TW')} 個試用中 · 預估月營收{' '}
        {formatTwd(summary.estimatedActiveMrrTwd)}（試用潛在 {formatTwd(summary.trialPipelineMrrTwd)}）
      </p>

      <ul className="space-y-3">
        {orgs.map((org) => (
          <OrgCard key={org.id} org={org} />
        ))}
      </ul>

      <p className="text-center text-xs text-muted-foreground">
        停用／調整方案等操作將於收費功能開通後提供。
      </p>
    </>
  );
}

export default async function InternalOrgsPage() {
  const result = await loadPlatformOrganizationsView();
  redirectUnauthenticatedPlatformAdminResult(result, '/internal/orgs');

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">租戶管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            依「誰需要跟進」排序的租戶清單。
          </p>
        </div>
        <ManualBetaOrgForm />
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
