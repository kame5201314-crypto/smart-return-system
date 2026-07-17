/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleCreatePlatformOrgNote } from '@/app/api/internal/saas/orgs/[id]/notes/route';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import type { PlatformAdminContext } from '@/lib/saas/platform-admin';
import { getPlatformAdminPermissions } from '@/lib/saas/platform-admin-roles';
import {
  normalizePlatformOrgNoteInput,
  recordPlatformOrgNote,
  type PlatformOrgNoteRepository,
} from '@/lib/saas/platform-org-notes';

const orgId = '11111111-1111-4111-8111-111111111111';
const access: PlatformAdminContext = {
  userId: '22222222-2222-4222-8222-222222222222',
  userEmail: 'support@example.com',
  isPlatformAdmin: true,
  platformRole: 'support',
  permissions: getPlatformAdminPermissions('support'),
  featureFlags: resolveSaaSFeatureFlags({ env: { ENABLE_MULTI_TENANT_ADMIN: 'true' }, orgPlan: 'enterprise' }),
};

function repository(): PlatformOrgNoteRepository {
  return { insertNote: vi.fn(async () => undefined) };
}

describe('platform organization notes', () => {
  it('normalizes a follow-up record and persists actor context', async () => {
    const repo = repository();
    const result = await recordPlatformOrgNote(
      {
        noteType: 'follow_up',
        note: ' 下週確認成長版方案 ',
        followUpAt: '2026-07-20T02:30:00.000Z',
      },
      orgId,
      access,
      repo
    );

    expect(result).toEqual({
      orgId,
      noteType: 'follow_up',
      note: '下週確認成長版方案',
      followUpAt: '2026-07-20T02:30:00.000Z',
    });
    expect(repo.insertNote).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: access.userId,
      actorEmail: 'support@example.com',
    }));
  });

  it('rejects incomplete notes before a write', () => {
    expect(() => normalizePlatformOrgNoteInput({ noteType: 'contact', note: '短' }, orgId))
      .toThrow('紀錄內容至少需要 4 個字。');
  });

  it('creates a note through the guarded internal route', async () => {
    const repo = repository();
    const response = await handleCreatePlatformOrgNote(
      new NextRequest(`http://localhost/api/internal/saas/orgs/${orgId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ noteType: 'contact', note: '已電話聯絡客戶' }),
      }),
      { params: Promise.resolve({ id: orgId }) },
      { requireAccess: async () => access, repository: repo }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { note: { orgId } } });
    expect(repo.insertNote).toHaveBeenCalledOnce();
  });
});
