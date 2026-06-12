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

export const PLATFORM_RISK_SUGGESTED_ACTION: Record<PlatformOrganizationRiskReason, string> = {
  past_due: '建議人工提醒補款',
  suspended: '確認補繳後協助恢復',
  cancelled: '了解取消原因，評估挽回',
  returns_high: '留意旺季用量，必要時建議升級',
  returns_limit: '建議升級方案（軟限制不擋作業）',
  ai_high: '留意 AI 用量走勢',
  ai_limit: '建議聯絡升級方案',
  seats_full: '建議升級方案以增加席次',
};

export function formatSuggestedActions(
  reasons: readonly PlatformOrganizationRiskReason[]
): string[] {
  return Array.from(
    new Set(reasons.map((reason) => PLATFORM_RISK_SUGGESTED_ACTION[reason]).filter(Boolean))
  );
}
