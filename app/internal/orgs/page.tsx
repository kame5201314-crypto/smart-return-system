import Link from 'next/link';
import { Lightbulb } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

function sortWithinGroup(orgs: readonly PlatformOrg[]): PlatformOrg[] {
  return [...orgs].sort((a, b) => {
    const daysA = a.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    const daysB = b.daysUntilTrialEnd ?? Number.POSITIVE_INFINITY;
    if (daysA !== daysB) return daysA - daysB;
    return a.name.localeCompare(b.name, 'zh-TW');
  });
}

// 與租戶詳情頁同一套風險等級用詞：需關注 / 觀察中 / 健康。
function groupForFollowUp(orgs: readonly PlatformOrg[]): {
  attention: PlatformOrg[];
  watch: PlatformOrg[];
  healthy: PlatformOrg[];
} {
  const tiers: PlatformOrg[][] = [[], [], []];
  for (const org of orgs) {
    tiers[followUpTier(org)].push(org);
  }
  return {
    attention: sortWithinGroup(tiers[0]),
    watch: sortWithinGroup(tiers[1]),
    healthy: sortWithinGroup(tiers[2]),
  };
}

function buildSuggestions(org: PlatformOrg): string[] {
  const actions = formatSuggestedActions(org.health.riskReasons);
  if (isTrialExpired(org)) {
    return ['聯絡客戶確認續約或延長試用', ...actions];
  }
  return actions;
}

function TrialCountdown({ org }: { org: PlatformOrg }) {
  if (org.status !== 'trialing' || org.daysUntilTrialEnd === null) {
    return null;
  }

  const days = org.daysUntilTrialEnd;
  if (days <= 0) {
    return <span className="text-xs font-medium text-red-600">試用已到期</span>;
  }

  const tone = days <= 7 ? 'font-medium text-amber-700' : 'text-muted-foreground';
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

function UsageLine({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  return (
    <span className="flex flex-wrap gap-x-2 text-xs">
      <UsageMetric label="席次" used={org.memberCount} limit={plan.seatLimit} />
      <span className="text-muted-foreground">·</span>
      <UsageMetric
        label="退貨"
        used={org.usage.returnsThisMonth}
        limit={plan.monthlyReturnSoftLimit}
      />
      <span className="text-muted-foreground">·</span>
      <UsageMetric label="AI" used={org.usage.aiUsedThisMonth} limit={plan.aiMonthlyLimit} />
    </span>
  );
}

function TrialSourceLine({ org }: { org: PlatformOrg }) {
  if (org.provisioningSource !== 'google_self_service' || !org.selfServiceTrialAI) {
    return null;
  }

  const status = org.selfServiceTrialAI.status === 'in_progress'
    ? '分析中'
    : `${org.selfServiceTrialAI.used} / ${org.selfServiceTrialAI.limit}`;

  return (
    <span className="text-xs text-emerald-700">
      Google 自助試用 · 試用 AI {status}
    </span>
  );
}

// 需關注與觀察中用完整卡片；整卡可點，名稱是主視覺，方案/狀態/email 降為次要資訊。
function OrgCard({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  const attention = needsAttention(org);
  const suggestions = buildSuggestions(org);

  return (
    <li>
      <Link
        href={`/internal/orgs/${org.id}`}
        className={`block rounded-lg border bg-white p-4 transition hover:shadow-sm ${
          attention
            ? 'border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/30 hover:border-amber-400'
            : 'border-neutral-200 hover:border-emerald-500'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-neutral-950">{org.name}</span>
          {attention ? (
            <Badge className="border-transparent bg-amber-500 text-white hover:bg-amber-500">
              需關注
            </Badge>
          ) : null}
          <span className="ml-auto">
            <TrialCountdown org={org} />
          </span>
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {plan.name} · {PLATFORM_ORG_STATUS_LABEL[org.status]} · {org.ownerEmail ?? '—'}
        </div>

        {org.provisioningSource === 'google_self_service' ? (
          <div className="mt-1">
            <TrialSourceLine org={org} />
          </div>
        ) : null}

        <div className="mt-1.5">
          <UsageLine org={org} />
        </div>

        {suggestions.length > 0 ? (
          <div
            className={`mt-2 flex items-start gap-1.5 text-xs ${
              attention ? 'text-amber-800' : 'text-muted-foreground'
            }`}
          >
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>建議：{suggestions.join('；')}</span>
          </div>
        ) : null}
      </Link>
    </li>
  );
}

// 健康租戶降為單行密度：這頁的重點是異常處理，不是展示所有租戶。
function HealthyOrgRow({ org }: { org: PlatformOrg }) {
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];

  return (
    <li>
      <Link
        href={`/internal/orgs/${org.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-neutral-200 bg-white px-4 py-2.5 transition hover:border-emerald-500 hover:shadow-sm"
      >
        <span className="text-sm font-medium text-neutral-950">{org.name}</span>
        <span className="text-xs text-muted-foreground">
          {plan.name} · {PLATFORM_ORG_STATUS_LABEL[org.status]}
        </span>
        <TrialCountdown org={org} />
        <TrialSourceLine org={org} />
        <span className="ml-auto">
          <UsageLine org={org} />
        </span>
      </Link>
    </li>
  );
}

function SectionHeading({
  title,
  count,
  dotClass,
}: {
  title: string;
  count: number;
  dotClass: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
      <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
      {title}（{count.toLocaleString('zh-TW')}）
    </h3>
  );
}

function SummaryChips({
  summary,
  attentionCount,
}: {
  summary: PlatformOrganizationListView['summary'];
  attentionCount: number;
}) {
  const neutralChip =
    'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href="#orgs-attention"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
          attentionCount > 0
            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            : 'border-neutral-200 bg-white text-neutral-500'
        }`}
      >
        需關注 <span className="font-semibold">{attentionCount.toLocaleString('zh-TW')}</span>
      </a>
      <span className={neutralChip}>
        試用中 <span className="font-semibold">{summary.trialingOrganizations.toLocaleString('zh-TW')}</span>
      </span>
      <span className={neutralChip}>
        月營收 <span className="font-semibold">{formatTwd(summary.estimatedActiveMrrTwd)}</span>
      </span>
      <span className={neutralChip}>
        試用潛在 <span className="font-semibold">{formatTwd(summary.trialPipelineMrrTwd)}</span>
      </span>
    </div>
  );
}

function OrgsContent({ data }: { data: PlatformOrganizationListView }) {
  const groups = groupForFollowUp(data.organizations);

  return (
    <>
      <SummaryChips summary={data.summary} attentionCount={groups.attention.length} />

      <section id="orgs-attention" className="scroll-mt-6 space-y-3">
        <SectionHeading title="需關注" count={groups.attention.length} dotClass="bg-amber-500" />
        {groups.attention.length > 0 ? (
          <ul className="space-y-3">
            {groups.attention.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-200 px-4 py-3 text-sm text-muted-foreground">
            目前沒有需要跟進的租戶。
          </p>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title="觀察中" count={groups.watch.length} dotClass="bg-neutral-400" />
        {groups.watch.length > 0 ? (
          <ul className="space-y-3">
            {groups.watch.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-200 px-4 py-3 text-sm text-muted-foreground">
            此分組目前沒有租戶。
          </p>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading title="健康" count={groups.healthy.length} dotClass="bg-emerald-500" />
        {groups.healthy.length > 0 ? (
          <ul className="space-y-2">
            {groups.healthy.map((org) => (
              <HealthyOrgRow key={org.id} org={org} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-neutral-200 px-4 py-3 text-sm text-muted-foreground">
            此分組目前沒有租戶。
          </p>
        )}
      </section>

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
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">租戶管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            依「誰需要跟進」分組的行動清單。
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
