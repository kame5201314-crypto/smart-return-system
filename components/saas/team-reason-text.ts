/**
 * UI-only 對照層：將後端團隊管理回傳的英文 disabledReason 轉成繁體中文 tooltip 文案。
 *
 * 後端（lib/saas/team-management.ts 等）目前以自由文字英文字串描述停用原因，
 * 為符合 spec §D「文案全繁中、無工程術語」，於 UI 端統一翻譯。
 * 採「精確比對 + 繁中通用 fallback」：即使後端日後新增未對照的訊息，
 * 也只會顯示通用繁中文案，絕不外洩英文。
 */
const REASON_ZH: Record<string, string> = {
  // 成員（row-level）
  'Member is already disabled.': '此成員已停用。',
  'You cannot change or disable your own team membership.': '無法調整或停用自己的帳號。',
  'At least one active owner must remain.': '組織必須至少保留一位擁有者。',
  'Your role cannot manage this member.': '您的角色無法管理此成員。',
  'This member cannot be changed.': '此成員無法變更角色。',
  'This member cannot be disabled.': '此成員無法停用。',
  // 邀請（row-level）
  'Your role cannot manage this invite.': '您的角色無法管理此邀請。',
  'Invite has been revoked.': '此邀請已撤銷。',
  'Invite has already been accepted.': '此邀請已被接受。',
  'Invite cannot be revoked.': '此邀請無法撤銷。',
  'Invite cannot be resent.': '此邀請無法重送。',
  'Invite role is invalid.': '邀請角色無效。',
  'Seat limit has been reached for this plan.': '已達方案席次上限。',
  'Beta trial workspaces support one member only.':
    'Beta 試用期間僅提供擁有者 1 個席次；升級後即可邀請成員。',
  // 團隊頂層 actions（邀請表單）
  'Owner or admin role is required to manage team settings.':
    '需要擁有者或管理員角色才能管理團隊設定。',
};

export function translateTeamReason(reason: string | undefined | null): string | undefined {
  if (!reason) return undefined;
  const exact = REASON_ZH[reason];
  if (exact) return exact;
  // 後端以動態字串描述訂閱狀態限制，例如 "Organization status suspended does not allow team changes."
  if (reason.startsWith('Organization status')) {
    return '目前的訂閱狀態不允許變更團隊設定。';
  }
  return '目前無法執行此操作。';
}
