import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileClock,
  Flag,
  ReceiptText,
  Users,
} from 'lucide-react';

import { CopyEmailButton } from '@/components/internal/copy-email-button';
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
import { CustomPlanOfferControls } from '@/components/internal/custom-plan-offer-controls';
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
  'platform.billing.manual_payment_marked': '記錄人工付款',
  'platform.billing.org_suspended': '停權租戶',
  'platform.billing.org_resumed': '恢復租戶',
  'platform.billing.refund_requested': '申請退款',
};
import {
  loadPlatformOrganizationDetailView,
  loadPlatformOrganizationsView,
} from '@/lib/saas/platform-admin-live-data';
import { redirectUnauthenticatedPlatformAdminResult } from '@/lib/auth/internal-login-redirect';
import { SAAS_PLAN_DEFINITIONS } from '@/lib/config/saas-plans';
import { getPlatformOrganizationDisplayIdentity } from '@/lib/saas/platform-organization-display';
import type {
  PlatformOrganizationDetailView,
  PlatformOrganizationListItem,
  TeamMemberRole,
  TeamMemberStatus,
} from '@/lib/saas/ui-backend-contracts';

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

function formatRelativeTime(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '時間未知';

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('zh-TW', { numeric: 'auto' });
  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ] as const;

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return formatter.format(diffSeconds, 'second');
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

const TEAM_ROLE_LABEL: Record<TeamMemberRole, string> = {
  owner: '擁有者',
  admin: '管理員',
  staff: '作業成員',
  viewer: '檢視者',
};

const TEAM_ROLE_ORDER: Record<TeamMemberRole, number> = {
  owner: 0,
  admin: 1,
  staff: 2,
  viewer: 3,
};

const TEAM_STATUS_LABEL: Record<TeamMemberStatus, string> = {
  active: '已加入',
  invited: '邀請中',
  disabled: '已停用',
};

const FEATURE_FLAG_LABEL: Record<string, string> = {
  public_signup: '公開註冊',
  public_lead_capture: '試用申請',
  google_auth: 'Google 登入',
  google_auth_ui: 'Google 登入入口',
  google_trial_signup: 'Google 自助試用',
  email_otp_signup: 'Email 驗證註冊',
  phone_otp_signup: '手機驗證註冊',
  billing: '線上帳務',
  subscription_plan: '訂閱方案',
  ai_usage_limit: 'AI 額度限制',
  advanced_analytics: '進階分析',
  multi_tenant_admin: '多租戶管理',
  image_ai: '圖片 AI',
};

const SENSITIVE_AUDIT_ACTIONS = new Set([
  'member.disabled',
  'platform.billing.org_suspended',
  'platform.billing.org_resumed',
  'platform.billing.refund_requested',
]);

function EmailLink({ email, className = '' }: { email: string; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      <a
        href={`mailto:${encodeURIComponent(email)}`}
        className="min-w-0 truncate text-emerald-800 underline-offset-4 hover:underline"
        title={email}
      >
        {email}
      </a>
      <CopyEmailButton email={email} />
    </div>
  );
}

function memberStatusBadge(status: TeamMemberStatus) {
  if (status === 'invited') {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
        {TEAM_STATUS_LABEL[status]}
      </Badge>
    );
  }
  if (status === 'disabled') {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
        {TEAM_STATUS_LABEL[status]}
      </Badge>
    );
  }
  return <Badge variant="outline">{TEAM_STATUS_LABEL[status]}</Badge>;
}

interface AttentionNavigation {
  previous: Pick<PlatformOrganizationListItem, 'id' | 'name'> | null;
  next: Pick<PlatformOrganizationListItem, 'id' | 'name'> | null;
}

function buildAttentionNavigation(
  currentOrgId: string,
  organizations: PlatformOrganizationListItem[]
): AttentionNavigation | null {
  const attentionOrganizations = organizations.filter((org) => org.requiresAttention);
  if (attentionOrganizations.length === 0) return null;

  const currentIndex = attentionOrganizations.findIndex((org) => org.id === currentOrgId);
  if (currentIndex === -1) {
    return {
      previous: null,
      next: attentionOrganizations[0] ?? null,
    };
  }

  return {
    previous: attentionOrganizations[currentIndex - 1] ?? null,
    next: attentionOrganizations[currentIndex + 1] ?? null,
  };
}

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
    { label: '帳務 Email', value: org.billingEmail ?? '—', email: org.billingEmail },
    { label: '統一編號', value: org.taxId ?? '—', email: null },
    { label: '試用 AI', value: formatSelfServiceTrialAI(org.selfServiceTrialAI), email: null },
    { label: '建立日期', value: formatDate(org.createdAt), email: null },
  ] as const;
  const sortedMembers = [...data.members].sort((left, right) => (
    TEAM_ROLE_ORDER[left.role] - TEAM_ROLE_ORDER[right.role]
    || left.email.localeCompare(right.email, 'zh-TW')
  ));
  const featureFlags = Object.entries(org.featureFlags).sort(([leftKey, leftEnabled], [rightKey, rightEnabled]) => (
    Number(rightEnabled) - Number(leftEnabled)
    || (FEATURE_FLAG_LABEL[leftKey] ?? leftKey).localeCompare(FEATURE_FLAG_LABEL[rightKey] ?? rightKey, 'zh-TW')
  ));

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <CardContent className="grid gap-4 lg:grid-cols-[0.55fr_1.45fr]">
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">整體狀態</span>
              <Badge variant={riskVariant(org.health.riskLevel)}>
                {PLATFORM_RISK_LEVEL_LABEL[org.health.riskLevel]}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {org.health.riskLevel === 'healthy'
                ? '目前沒有帳務、席次或用量警示。'
                : '需處理的原因與建議動作已集中顯示於頁面上方。'}
            </p>
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
        <CardContent>
          <dl className="overflow-hidden rounded-md border text-sm md:grid md:grid-cols-2">
            {billingRows.map(({ label, value, email }, index) => (
              <div
                key={label}
                className={`flex min-w-0 items-center justify-between gap-4 px-4 py-3 ${
                  index > 0 ? 'border-t' : ''
                } ${index === 1 ? 'md:border-t-0' : ''} ${index % 2 === 1 ? 'md:border-l' : ''}`}
              >
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className={`min-w-0 text-right font-medium ${value === '—' ? 'text-muted-foreground' : ''}`}>
                  {email ? <EmailLink email={email} className="justify-end" /> : value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-emerald-700" aria-hidden="true" />
            成員與權限（{org.memberCount} / {plan.seatLimit ?? '合約'} 席）
          </CardTitle>
          <CardDescription>依角色排序，快速確認尚未加入或已停用的成員。</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedMembers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">目前沒有成員資料。</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成員</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>狀態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="min-w-60">
                        {member.displayName ? (
                          <p className="font-medium">{member.displayName}</p>
                        ) : null}
                        <EmailLink email={member.email} className={member.displayName ? 'mt-1 text-xs' : ''} />
                      </TableCell>
                      <TableCell>{TEAM_ROLE_LABEL[member.role]}</TableCell>
                      <TableCell>{memberStatusBadge(member.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileClock className="size-5 text-cyan-700" aria-hidden="true" />
            操作紀錄
          </CardTitle>
          <CardDescription>顯示最近 {data.recentAuditLogs.length} 筆平台操作；完整時間可將游標停在相對時間上查看。</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentAuditLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">尚無操作紀錄。</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
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
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)}>
                          {formatRelativeTime(log.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell>
                        {SENSITIVE_AUDIT_ACTIONS.has(log.action) ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-900"
                          >
                            {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                          </Badge>
                        ) : (
                          <span className="font-medium">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</span>
                        )}
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-5 text-emerald-700" aria-hidden="true" />
            功能開關
          </CardTitle>
          <CardDescription>啟用項目優先顯示；技術代碼保留供支援人員核對。</CardDescription>
        </CardHeader>
        <CardContent>
          {featureFlags.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">尚未設定功能開關。</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {featureFlags.map(([key, enabled]) => (
                <li key={key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{FEATURE_FLAG_LABEL[key] ?? key}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={key}>{key}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600'}
                  >
                    {enabled ? '已啟用' : '未啟用'}
                  </Badge>
                </li>
              ))}
            </ul>
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
  const organizationsResult = result.state === 'ready'
    ? await loadPlatformOrganizationsView({ limit: 100 })
    : null;
  const attentionNavigation = result.state === 'ready' && organizationsResult?.state === 'ready'
    ? buildAttentionNavigation(result.data.organization.id, organizationsResult.data.organizations)
    : null;
  const readyOrg = result.state === 'ready' ? result.data.organization : null;
  const readyIdentity = readyOrg ? getPlatformOrganizationDisplayIdentity(readyOrg) : null;
  const title = readyIdentity?.primaryLabel ?? '租戶詳情';
  const readyPlan = readyOrg ? SAAS_PLAN_DEFINITIONS[readyOrg.plan] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
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
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {readyOrg.ownerEmail ? <EmailLink email={readyOrg.ownerEmail} /> : null}
              {readyOrg.ownerEmail ? <span aria-hidden="true">·</span> : null}
              <span>{formatProvisioningSource(readyOrg.provisioningSource)}</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              此租戶的方案、訂閱、用量與健康度概況。
            </p>
          )}
        </div>
        {attentionNavigation?.previous || attentionNavigation?.next ? (
          <nav className="flex items-center gap-2 sm:justify-end" aria-label="需關注租戶導覽">
            {attentionNavigation.previous ? (
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Link
                  href={`/internal/orgs/${attentionNavigation.previous.id}`}
                  title={attentionNavigation.previous.name}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  上一個需關注
                </Link>
              </Button>
            ) : null}
            {attentionNavigation.next ? (
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Link
                  href={`/internal/orgs/${attentionNavigation.next.id}`}
                  title={attentionNavigation.next.name}
                >
                  下一個需關注
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
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
                <div className="mt-2 [&>button]:w-full">
                  <StartTenantPreviewButton
                    orgId={result.data.organization.id}
                    orgName={title}
                  />
                </div>
              </div>
              <div className="rounded-md border bg-neutral-50 p-3">
                <p className="text-xs font-medium text-muted-foreground">營運跟進</p>
                <div className="mt-2 [&>button]:w-full">
                  <OrgOperationsNoteForm
                    orgId={result.data.organization.id}
                    orgName={title}
                  />
                </div>
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
          <CustomPlanOfferControls
            orgId={result.data.organization.id}
            orgName={title}
            canManageBillingOperations={result.context.permissions.includes('manage_billing_operations')}
          />
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
