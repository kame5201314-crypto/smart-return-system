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

  it('does not show a restriction notice for active or trialing workspaces', () => {
    expect(buildWorkspaceAccessNotice({ status: 'active' })).toBeNull();
    expect(buildWorkspaceAccessNotice({ status: 'trialing' })).toBeNull();
  });
});
