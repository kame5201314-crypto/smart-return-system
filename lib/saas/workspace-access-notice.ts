import type { SaaSSubscriptionStatus } from '@/lib/saas/subscription-access';

export interface WorkspaceAccessNotice {
  kind: 'trial_expired' | 'suspended';
  title: string;
  message: string;
}

function isReached(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= now.getTime();
}

export function buildWorkspaceAccessNotice(input: {
  status: SaaSSubscriptionStatus;
  trialEnd?: string | null;
  now?: Date;
}): WorkspaceAccessNotice | null {
  if (input.status !== 'suspended') return null;
  if (isReached(input.trialEnd, input.now ?? new Date())) {
    return {
      kind: 'trial_expired',
      title: '14 天免費試用已結束',
      message: '目前仍可查看歷史資料；新增退貨、AI 分析與資料匯出已暫停。',
    };
  }
  return {
    kind: 'suspended',
    title: '工作區目前為唯讀',
    message: '目前仍可查看歷史資料；需要恢復新增、AI 分析與匯出時，請聯絡客服。',
  };
}
