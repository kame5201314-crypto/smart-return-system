import { describe, expect, it } from 'vitest';

import {
  buildWorkspaceActionAccess,
  enforceWorkspaceReadOnly,
  UNRESTRICTED_WORKSPACE_ACTION_ACCESS,
} from '@/lib/saas/workspace-action-access';

describe('workspace action access', () => {
  it('keeps active and trialing workspace actions available', () => {
    for (const status of ['active', 'trialing'] as const) {
      expect(buildWorkspaceActionAccess(status)).toMatchObject({
        status,
        canCreateData: true,
        canUseAI: true,
        canExport: true,
        isReadOnly: false,
      });
    }
  });

  it('marks inactive subscription states as read-only', () => {
    for (const status of ['past_due', 'suspended', 'cancelled'] as const) {
      expect(buildWorkspaceActionAccess(status)).toMatchObject({
        status,
        canCreateData: false,
        canUseAI: false,
        canExport: false,
        isReadOnly: true,
      });
    }
  });

  it('keeps the no-tenant fallback compatible with platform admin workspaces', () => {
    expect(UNRESTRICTED_WORKSPACE_ACTION_ACCESS).toEqual({
      status: null,
      canCreateData: true,
      canUseAI: true,
      canExport: true,
      isReadOnly: false,
    });
  });

  it('forces every mutation, export, and AI action off during a tenant preview', () => {
    expect(enforceWorkspaceReadOnly(UNRESTRICTED_WORKSPACE_ACTION_ACCESS)).toEqual({
      status: null,
      canCreateData: false,
      canUseAI: false,
      canExport: false,
      isReadOnly: true,
    });

    expect(enforceWorkspaceReadOnly(buildWorkspaceActionAccess('trialing'))).toEqual({
      status: 'trialing',
      canCreateData: false,
      canUseAI: false,
      canExport: false,
      isReadOnly: true,
    });
  });
});
