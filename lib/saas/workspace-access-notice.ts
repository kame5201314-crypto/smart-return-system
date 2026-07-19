import type { SaaSSubscriptionStatus } from '@/lib/saas/subscription-access';
import type { BillingSuspensionSource } from '@/lib/saas/ui-backend-contracts';

export interface WorkspaceAccessNotice {
  kind: 'trial_expired' | 'past_due' | 'suspended' | 'cancelled';
  title: string;
  message: string;
}

export function buildWorkspaceAccessNotice(input: {
  status: SaaSSubscriptionStatus;
  suspensionSource?: BillingSuspensionSource | null;
}): WorkspaceAccessNotice | null {
  if (input.status === 'past_due') {
    return {
      kind: 'past_due',
      title: '帳務狀態待確認，工作區暫時唯讀',
      message: '目前仍可查看歷史資料；新增退貨、資料匯入／匯出與 AI 分析已停用。請前往帳務與訂閱確認付款狀態或重新付款。',
    };
  }

  if (input.status === 'cancelled') {
    return {
      kind: 'cancelled',
      title: '訂閱已結束，工作區目前為唯讀',
      message: '目前仍可查看歷史資料；新增退貨、資料匯入／匯出與 AI 分析已停用。請前往帳務與訂閱重新選擇方案。',
    };
  }

  if (input.status !== 'suspended') return null;
  if (input.suspensionSource === 'trial_expired') {
    return {
      kind: 'trial_expired',
      title: '3 天免費試用已結束',
      message: '目前仍可查看歷史資料；新增退貨、資料匯入／匯出與 AI 分析已停用。請前往帳務與訂閱升級方案以恢復使用。',
    };
  }
  return {
    kind: 'suspended',
    title: '工作區目前為唯讀',
    message: '目前仍可查看歷史資料；新增退貨、資料匯入／匯出與 AI 分析已停用。請前往帳務與訂閱確認方案狀態。',
  };
}
