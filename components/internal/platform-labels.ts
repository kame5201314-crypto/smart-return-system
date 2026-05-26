import type {
  OrgSubscriptionStatus,
  PlatformAtRiskAlertSeverity,
  PlatformOrganizationRiskReason,
} from '@/lib/saas/ui-backend-contracts';

export const PLATFORM_ORG_STATUS_LABEL: Record<OrgSubscriptionStatus, string> = {
  trialing: '試用中',
  active: '使用中',
  past_due: '待補款',
  suspended: '已暫停',
  cancelled: '已取消',
};

export type PlatformRiskLevel = 'healthy' | 'watch' | 'at_risk';

export const PLATFORM_RISK_LEVEL_LABEL: Record<PlatformRiskLevel, string> = {
  healthy: '健康',
  watch: '觀察中',
  at_risk: '需關注',
};

export const PLATFORM_RISK_REASON_LABEL: Record<PlatformOrganizationRiskReason, string> = {
  past_due: '付款逾期',
  suspended: '已暫停',
  cancelled: '已取消',
  returns_high: '退貨量達 80%',
  returns_limit: '退貨量已滿',
  ai_high: 'AI 用量達 80%',
  ai_limit: 'AI 額度已滿',
  seats_full: '席次已滿',
};

export const PLATFORM_ALERT_SEVERITY_LABEL: Record<PlatformAtRiskAlertSeverity, string> = {
  info: '資訊',
  warning: '警告',
  critical: '嚴重',
};

export function formatRiskReasons(reasons: readonly PlatformOrganizationRiskReason[]): string[] {
  return reasons.map((reason) => PLATFORM_RISK_REASON_LABEL[reason] ?? reason);
}
