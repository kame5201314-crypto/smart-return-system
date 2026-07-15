/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { buildWorkspaceAccessNotice } from '@/lib/saas/workspace-access-notice';

describe('workspace access notice', () => {
  it('shows a trial-expired notice for an expired suspended workspace', () => {
    expect(buildWorkspaceAccessNotice({
      status: 'suspended',
      trialEnd: '2026-07-13T00:00:00.000Z',
      now: new Date('2026-07-14T00:00:00.000Z'),
    })).toMatchObject({ kind: 'trial_expired', title: '3 天免費試用已結束' });
  });

  it('shows a generic readonly notice for other suspended workspaces', () => {
    expect(buildWorkspaceAccessNotice({ status: 'suspended' })).toMatchObject({
      kind: 'suspended',
      title: '工作區目前為唯讀',
    });
  });

  it('explains past-due readonly access and points merchants to support', () => {
    expect(buildWorkspaceAccessNotice({ status: 'past_due' })).toEqual({
      kind: 'past_due',
      title: '帳務狀態待確認，工作區暫時唯讀',
      message: '目前仍可查看歷史資料；新增退貨、資料匯入／匯出與 AI 分析已停用。請聯絡客服確認付款或續用方式。',
    });
  });

  it('explains cancelled readonly access and offers reactivation guidance', () => {
    expect(buildWorkspaceAccessNotice({ status: 'cancelled' })).toEqual({
      kind: 'cancelled',
      title: '訂閱已結束，工作區目前為唯讀',
      message: '目前仍可查看歷史資料；新增退貨、資料匯入／匯出與 AI 分析已停用。請重新啟用方案或聯絡客服恢復使用。',
    });
  });

  it('does not show a restriction notice for active or trialing workspaces', () => {
    expect(buildWorkspaceAccessNotice({ status: 'active' })).toBeNull();
    expect(buildWorkspaceAccessNotice({ status: 'trialing' })).toBeNull();
  });
});
