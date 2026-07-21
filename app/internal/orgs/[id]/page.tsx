import Link from 'next/link';
import { Activity, AlertTriangle, ArrowLeft, FileClock, ReceiptText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsageProgress } from '@/components/saas/usage-progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SettingsStateCard } from '@/components/saas/settings-state-card';
import { StartTenantPreviewButton } from '@/components/internal/start-tenant-preview-button';
import { OrgBillingOperationControls } from '@/components/internal/org-billing-operation-controls';
import { OrgOperationsNoteForm } from '@/components/internal/org-operations-note-form';
import {
  formatSuggestedActions,
  PLATFORM_ORG_STATUS_LABEL,
  PLATFORM_RISK_LEVEL_LABEL,
  PLATFORM_RISK_REASON_LABEL,
} from '@/components/internal/platform-labels';

// 常見平台操作的繁中對照；未知 action 以原始代碼顯示。
const AUDIT_ACTION_LABEL: Record<string, string> = {
  'member.invited': '邀請成員',
  'member.invite_accepted': '成員接受邀請',
  'member.role_changed': '變更成員角色',
  'member.disabled': '停用成員',
  'invite.revoked': '撤銷邀請',
  'invite.resent': '重送邀請',
  'org.onboarding_completed': '完成導入設定',
  'org.manual_beta_provisioned': '手動開通租戶',
  'platform.tenant_preview_started': '開始租戶預覽',
  'platform.tenant_preview_cleared': '結束租戶預覽',
  'platform.org.note_added': '營運紀錄',
};
import { loadPlatformOrganizationDetailView } from '@/lib/saas/platform-admin-live-data';
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import { getPlatformOrganizationDisplayIdentity } from '@/lib/saas/platform-organization-display';
import type { PlatformOrganizationDetailView } from '@/lib/saas/ui-backend-contracts';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatTwd(value: number): string {
  return `NT$${value.toLocaleString('zh-TW')}`;
}

function formatSelfServiceTrialAI(
  value: PlatformOrganizationDetailView['organization']['selfServiceTrialAI']
): string {
  if (!value) return '—';
  if (value.status === 'in_progress') return '分析中（0 / 1）';
  return `${value.used} / ${value.limit}`;
}

function usagePercent(value: number | null): number {
  return value ?? 0;
}

function riskVariant(
  riskLevel: PlatformOrganizationDetailView['organization']['health']['riskLevel']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (riskLevel === 'at_risk') return 'destructive';
  if (riskLevel === 'watch') return 'secondary';
  return 'outline';
}

function auditMetadataText(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  contact: '客戶聯絡',
  follow_up: '後續跟進',
  internal: '內部備註',
};

function formatProvisioningSource(
  source: PlatformOrganizationDetailView['organization']['provisioningSource']
): string {
  if (source === 'google_self_service') return 'Google 註冊';
  if (source === 'email_otp_self_service') return '信箱註冊';
  if (source === 'phone_otp_self_service') return '手機註冊';
  return '人工開通';
}

function formatOrganizationStatus(
  org: PlatformOrganizationDetailView['organization']
): string {
  const trialExpired =
    org.status === 'trialing' && org.daysUntilTrialEnd !== null && org.daysUntilTrialEnd <= 0;
  if (org.status === 'trialing' && org.daysUntilTrialEnd !== null) {
    return trialExpired ? '試用已到期' : `試用中（剩 ${org.daysUntilTrialEnd} 天）`;
  }
  return PLATFORM_ORG_STATUS_LABEL[org.status];
}

function statusBadgeClass(status: PlatformOrganizationDetailView['organization']['status']): string {
  if (status === 'suspended') return 'border-red-200 bg-red-50 text-red-800 hover:bg-red-50';
  if (status === 'past_due') return 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50';
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50';
  return 'border-neutral-200 bg-white text-neutral-700 hover:bg-white';
}

function DetailContent({ data }: { data: PlatformOrganizationDetailView }) {
  const org = data.organization;
  const identity = getPlatformOrganizationDisplayIdentity(org);
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];

  const trialExpired =
    org.status === 'trialing' && org.daysUntilTrialEnd !== null && org.daysUntilTrialEnd <= 0;
  const trialEndingSoon =
    org.status === 'trialing' &&
    org.daysUntilTrialEnd !== null &&
    org.daysUntilTrialEnd > 0 &&
    org.daysUntilTrialEnd <= 3;
  const needsAttention = org.requiresAttention;

  const summaryCards = [
    ['預估月營收', formatTwd(org.health.estimatedMrrTwd)],
    ['試用到期', org.trialEnd ? formatDate(org.trialEnd) : '—'],
    ['本月退貨', `${org.usage.returnsThisMonth.toLocaleString('zh-TW')} 筆`],
    ['本月 AI', `${org.usage.aiUsedThisMonth.toLocaleString('zh-TW')} 次`],
  ] as const;

  const billingRows = [
    ['帳務 Email', org.billingEmail ?? '—'],
    ['統一編號', org.taxId ?? '—'],
    ['試用 AI', formatSelfServiceTrialAI(org.selfServiceTrialAI)],
    ['建立日期', formatDate(org.createdAt)],
  ] as const;

  const suggestedActions = trialExpired
    ? ['聯絡客戶確認續約或延長試用', ...formatSuggestedActions(org.health.riskReasons)]
    : trialEndingSoon
      ? [`試用將在 ${org.daysUntilTrialEnd} 天後到期，請確認轉付費安排`, ...formatSuggestedActions(org.health.riskReasons)]
    : formatSuggestedActions(org.health.riskReasons);

  return (
    <>
      {needsAttention ? (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">此租戶目前需關注，建議優先跟進。</p>
            {(trialExpired || trialEndingSoon || org.health.riskReasons.length > 0) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trialExpired ? (
                  <Badge variant="destructive" className="text-xs">
                    試用已到期
                  </Badge>
                ) : null}
                {trialEndingSoon ? (
                  <Badge variant="outline" className="border-amber-300 bg-white text-xs text-amber-900">
                    試用將在 {org.daysUntilTrialEnd} 天後到期
                  </Badge>
                ) : null}
                {org.health.riskReasons.map((reason) => (
                  <Badge key={reason} variant="destructive" className="text-xs">
                    {PLATFORM_RISK_REASON_LABEL[reason]}
                  </Badge>
                ))}
              </div>
            ) : null}
            {suggestedActions.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-amber-900">
                建議動作：{suggestedActions.join('；')}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        {summaryCards.map(([label, value]) => (
          <Card key={label} className="rounded-lg">
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-lg">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-emerald-700" aria-hidden="true" />
            客戶健康度
          </CardTitle>
          <CardDescription>由訂閱狀態、席次、退貨量與 AI 額度即時計算，不讀取退貨明細。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">跟進狀態</span>
              {trialExpired ? (
                <Badge className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100">
                  需關注
                </Badge>
              ) : (
                <Badge variant={riskVariant(org.health.riskLevel)}>
                  {PLATFORM_RISK_LEVEL_LABEL[org.health.riskLevel]}
                </Badge>
              )}
            </div>
            {trialExpired ? (
              <div className="space-y-1.5 text-sm">
                <p className="text-amber-800">試用已到期，建議聯絡客戶確認續約或延長試用。</p>
                {org.health.riskReasons.length === 0 ? (
                  <p className="text-xs text-muted-foreground">用量與帳務風險目前正常。</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {org.health.riskReasons.map((reason) => (
                      <Badge key={reason} variant="outline">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {PLATFORM_RISK_REASON_LABEL[reason]}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : org.health.riskReasons.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {org.health.riskReasons.map((reason) => (
                  <Badge key={reason} variant="outline">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {PLATFORM_RISK_REASON_LABEL[reason]}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">目前沒有逾期、滿額或 80% 用量警示。</p>
            )}
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="mb-2">
                <p className="font-medium">團隊席次</p>
                <p className="text-xs text-muted-foreground">
                  已使用 {org.memberCount} / {plan.seatLimit ?? '合約'}
                </p>
              </div>
              <UsageProgress
                value={usagePercent(org.health.usagePercentages.seats)}
                aria-label={`${identity.primaryLabel} 席次使用率`}
                aria-valuetext={`已使用 ${org.memberCount} / ${plan.seatLimit ?? '合約'}，${usagePercent(org.health.usagePercentages.seats)}%`}
              />
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                計算目前已加入的團隊成員；達上限後將無法再新增成員。
              </p>
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2">
                <p className="font-medium">本月退貨量</p>
                <p className="text-xs text-muted-foreground">
                  已使用 {org.usage.returnsThisMonth.toLocaleString('zh-TW')} /{' '}
                  {plan.monthlyReturnSoftLimit?.toLocaleString('zh-TW') ?? '合約'}
                </p>
              </div>
              <UsageProgress
                value={usagePercent(org.health.usagePercentages.returns)}
                aria-label={`${identity.primaryLabel} 退貨量使用率`}
                aria-valuetext={`已使用 ${org.usage.returnsThisMonth} / ${plan.monthlyReturnSoftLimit ?? '合約'}，${usagePercent(org.health.usagePercentages.returns)}%`}
              />
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                計算本月新增與匯入的退貨筆數；達上限後將無法再新增退貨。
              </p>
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2">
                <p className="font-medium">本月 AI 分析</p>
                <p className="text-xs text-muted-foreground">
                  已使用 {org.usage.aiUsedThisMonth} / {plan.aiMonthlyLimit ?? '合約'}
                </p>
              </div>
              <UsageProgress
                value={usagePercent(org.health.usagePercentages.ai)}
                aria-label={`${identity.primaryLabel} AI 額度使用率`}
                aria-valuetext={`已使用 ${org.usage.aiUsedThisMonth} / ${plan.aiMonthlyLimit ?? '合約'}，${usagePercent(org.health.usagePercentages.ai)}%`}
              />
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                計算本月執行 AI 分析的次數；達上限後本月將暫停 AI 分析。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-cyan-700" aria-hidden="true" />
            帳務資料
          </CardTitle>
          <CardDescription>帳務與訂閱基本資料。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          {billingRows.map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 font-medium">{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileClock className="size-5 text-cyan-700" aria-hidden="true" />
              操作紀錄
            </CardTitle>
            <CardDescription>最近的平台操作紀錄。</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentAuditLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">尚無操作紀錄。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>事件</TableHead>
                    <TableHead>操作者</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAuditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</Badge>
                        {log.action === 'platform.org.note_added' ? (
                          <div className="mt-2 max-w-md space-y-1 text-xs leading-5 text-muted-foreground">
                            <p className="font-medium text-neutral-800">
                              {NOTE_TYPE_LABEL[auditMetadataText(log.metadata, 'note_type') ?? ''] ?? '營運紀錄'}
                            </p>
                            <p className="whitespace-pre-wrap">{auditMetadataText(log.metadata, 'note') ?? '—'}</p>
                            {auditMetadataText(log.metadata, 'follow_up_at') ? (
                              <p>下次跟進：{formatDateTime(auditMetadataText(log.metadata, 'follow_up_at'))}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.actorEmail ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
      </Card>
    </>
  );
}

export default async function InternalOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadPlatformOrganizationDetailView(id);
  redirectUnauthenticatedPlatformAdminResult(result, `/internal/orgs/${id}`);
  const readyOrg = result.state === 'ready' ? result.data.organization : null;
  const readyIdentity = readyOrg ? getPlatformOrganizationDisplayIdentity(readyOrg) : null;
  const title = readyIdentity?.primaryLabel ?? '租戶詳情';
  const readyPlan = readyOrg ? SAAS_PLAN_DEFINITIONS[readyOrg.plan] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link href="/internal/orgs">
              <ArrowLeft className="size-4" aria-hidden="true" />
              返回租戶清單
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-950">{title}</h1>
            {readyOrg ? (
              <Badge variant="outline" className={statusBadgeClass(readyOrg.status)}>
                {formatOrganizationStatus(readyOrg)}
              </Badge>
            ) : null}
            {readyPlan ? <Badge variant="outline">{readyPlan.name}</Badge> : null}
          </div>
          {readyOrg ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {readyIdentity?.secondaryLabel ? `${readyIdentity.secondaryLabel} · ` : ''}
              {formatProvisioningSource(readyOrg.provisioningSource)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              此租戶的方案、訂閱、用量與健康度概況。
            </p>
          )}
        </div>
      </div>

      {result.state === 'ready' ? (
        <>
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>租戶操作</CardTitle>
              <CardDescription>預覽、跟進、帳務與存取權限集中在同一處。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border bg-neutral-50 p-3">
                <p className="text-xs font-medium text-muted-foreground">主要操作</p>
                <div className="mt-2">
                  <StartTenantPreviewButton
                    orgId={result.data.organization.id}
                    orgName={title}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">唯讀預覽有效 1 小時，不會修改客戶資料。</p>
              </div>
              <div className="rounded-md border bg-neutral-50 p-3">
                <p className="text-xs font-medium text-muted-foreground">營運跟進</p>
                <div className="mt-2">
                  <OrgOperationsNoteForm
                    orgId={result.data.organization.id}
                    orgName={title}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">聯絡內容與下次跟進時間會寫入操作紀錄。</p>
              </div>
              <OrgBillingOperationControls
                orgId={result.data.organization.id}
                orgName={title}
                status={result.data.organization.status}
                suggestedAmountTwd={SAAS_PLAN_DEFINITIONS[result.data.organization.plan].monthlyPriceTwd}
                canManageBillingOperations={result.context.permissions.includes('manage_billing_operations')}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      {result.state === 'ready' ? (
        <DetailContent data={result.data} />
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
