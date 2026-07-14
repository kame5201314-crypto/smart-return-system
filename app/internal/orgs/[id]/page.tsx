import Link from 'next/link';
import { Activity, AlertTriangle, ArrowLeft, FileClock, Flag, ReceiptText, UsersRound } from 'lucide-react';

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
import {
  formatSuggestedActions,
  PLATFORM_ORG_STATUS_LABEL,
  PLATFORM_RISK_LEVEL_LABEL,
  PLATFORM_RISK_REASON_LABEL,
} from '@/components/internal/platform-labels';

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: '擁有者',
  admin: '管理員',
  staff: '作業成員',
  viewer: '檢視者',
};

const MEMBER_STATUS_LABEL: Record<string, string> = {
  active: '已加入',
  invited: '邀請中',
  disabled: '已停用',
};

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
};
import { loadPlatformOrganizationDetailView } from '@/lib/saas/platform-admin-live-data';
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
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

function DetailContent({ data }: { data: PlatformOrganizationDetailView }) {
  const org = data.organization;
  const plan = SAAS_PLAN_DEFINITIONS[org.plan];
  const featureFlags = Object.entries(org.featureFlags);

  const trialExpired =
    org.status === 'trialing' && org.daysUntilTrialEnd !== null && org.daysUntilTrialEnd <= 0;
  // 與租戶清單同一套「需關注」定義：帳務/額度風險或試用已到期。
  const needsAttention = org.health.riskLevel === 'at_risk' || trialExpired;

  const statusValue =
    org.status === 'trialing' && org.daysUntilTrialEnd !== null
      ? trialExpired
        ? '試用已到期'
        : `試用中（剩 ${org.daysUntilTrialEnd} 天）`
      : PLATFORM_ORG_STATUS_LABEL[org.status];

  const summaryCards = [
    ['方案', plan.name],
    ['狀態', statusValue],
    ['擁有者', org.ownerEmail ?? '—'],
    ['預估月營收', formatTwd(org.health.estimatedMrrTwd)],
  ] as const;

  const billingRows = [
    ['開通來源', org.provisioningSource === 'google_self_service' ? 'Google 自助試用' : '人工開通'],
    ['試用到期日', org.trialEnd ? formatDate(org.trialEnd) : '—'],
    ['試用 AI', formatSelfServiceTrialAI(org.selfServiceTrialAI)],
    ['帳務 Email', org.billingEmail ?? '—'],
    ['統一編號', org.taxId ?? '—'],
    ['方案', plan.name],
    ['建立日期', formatDate(org.createdAt)],
  ] as const;

  const suggestedActions = trialExpired
    ? ['聯絡客戶確認續約或延長試用', ...formatSuggestedActions(org.health.riskReasons)]
    : formatSuggestedActions(org.health.riskReasons);

  return (
    <>
      {needsAttention ? (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">此租戶目前需關注，建議優先跟進。</p>
            {(trialExpired || org.health.riskReasons.length > 0) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trialExpired ? (
                  <Badge variant="destructive" className="text-xs">
                    試用已到期
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
              <div className="mb-2 text-xs text-muted-foreground">
                席次 {org.memberCount} / {plan.seatLimit ?? '合約'}
              </div>
              <UsageProgress
                value={usagePercent(org.health.usagePercentages.seats)}
                aria-label={`${org.name} 席次使用率`}
              />
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs text-muted-foreground">
                退貨量 {org.usage.returnsThisMonth.toLocaleString('zh-TW')} /{' '}
                {plan.monthlyReturnSoftLimit?.toLocaleString('zh-TW') ?? '合約'}
              </div>
              <UsageProgress
                value={usagePercent(org.health.usagePercentages.returns)}
                aria-label={`${org.name} 退貨量使用率`}
              />
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-2 text-xs text-muted-foreground">
                AI {org.usage.aiUsedThisMonth} / {plan.aiMonthlyLimit ?? '合約'}
              </div>
              <UsageProgress
                value={usagePercent(org.health.usagePercentages.ai)}
                aria-label={`${org.name} AI 額度使用率`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-5 text-emerald-700" aria-hidden="true" />
              成員與權限
            </CardTitle>
            <CardDescription>組織內所有成員與其角色。</CardDescription>
          </CardHeader>
          <CardContent>
            {data.members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">尚無成員。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.displayName ? `${member.displayName}（${member.email}）` : member.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{MEMBER_ROLE_LABEL[member.role] ?? member.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {MEMBER_STATUS_LABEL[member.status] ?? member.status}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
          <CardContent className="grid gap-3 text-sm">
            {billingRows.map(([label, value]) => (
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
              <Flag className="size-5 text-emerald-700" aria-hidden="true" />
              功能開關
            </CardTitle>
            <CardDescription>此租戶目前開啟的功能。</CardDescription>
          </CardHeader>
          <CardContent>
            {featureFlags.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">尚未設定功能開關。</p>
            ) : (
              <Table>
                <TableBody>
                  {featureFlags.map(([flag, enabled]) => (
                    <TableRow key={flag}>
                      <TableCell className="font-mono text-xs">{flag}</TableCell>
                      <TableCell>
                        <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? '啟用' : '停用'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.actorEmail ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default async function InternalOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadPlatformOrganizationDetailView(id);
  redirectUnauthenticatedPlatformAdminResult(result, `/internal/orgs/${id}`);
  const title = result.state === 'ready' ? result.data.organization.name : '租戶詳情';

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
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            此租戶的方案、訂閱、用量與健康度概況。
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {result.state === 'ready' ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <StartTenantPreviewButton
                  orgId={result.data.organization.id}
                  orgName={result.data.organization.name}
                />
                <OrgBillingOperationControls
                  orgId={result.data.organization.id}
                  orgName={result.data.organization.name}
                  status={result.data.organization.status}
                  suggestedAmountTwd={SAAS_PLAN_DEFINITIONS[result.data.organization.plan].monthlyPriceTwd}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                唯讀預覽有效 1 小時；人工付款與暫停／恢復都會寫入操作紀錄。
              </p>
            </>
          ) : null}
        </div>
      </div>

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
