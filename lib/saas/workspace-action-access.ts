import {
  getSaaSSubscriptionAccessPolicy,
  type SaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';

export interface WorkspaceActionAccess {
  status: SaaSSubscriptionStatus | null;
  canCreateData: boolean;
  canUseAI: boolean;
  canExport: boolean;
  isReadOnly: boolean;
}

// Keep legacy/platform-admin workspaces usable when no tenant context exists.
// Tenant mutations and exports still enforce their server-side org requirements.
export const UNRESTRICTED_WORKSPACE_ACTION_ACCESS: WorkspaceActionAccess = {
  status: null,
  canCreateData: true,
  canUseAI: true,
  canExport: true,
  isReadOnly: false,
};

export const WORKSPACE_RESTRICTED_ACTION_TITLE =
  '工作區目前為唯讀；請結束租戶預覽，或前往帳務與訂閱確認方案狀態。';

export function buildWorkspaceActionAccess(
  status: SaaSSubscriptionStatus
): WorkspaceActionAccess {
  const policy = getSaaSSubscriptionAccessPolicy(status);
  return {
    status,
    canCreateData: policy.canCreateData,
    canUseAI: policy.canUseAI,
    canExport: policy.canExport,
    isReadOnly: !policy.canCreateData && !policy.canUseAI && !policy.canExport,
  };
}

export function enforceWorkspaceReadOnly(
  access: WorkspaceActionAccess
): WorkspaceActionAccess {
  return {
    ...access,
    canCreateData: false,
    canUseAI: false,
    canExport: false,
    isReadOnly: true,
  };
}
