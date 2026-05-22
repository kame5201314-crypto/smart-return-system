/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  loadInviteAcceptanceView,
  type InviteAcceptanceMembershipRepository,
} from '@/lib/saas/invite-acceptance-live-data';
import type { InviteTokenDataRepository, SaaSInviteTokenData } from '@/lib/saas/invite-token-data';

function buildInvite(overrides: Partial<SaaSInviteTokenData> = {}): SaaSInviteTokenData {
  return {
    id: 'invite-1',
    orgId: 'org-1',
    email: 'staff@example.com',
    role: 'staff',
    token: 'token-1',
    expiresAt: '2026-05-29T00:00:00.000Z',
    acceptedAt: null,
    status: 'pending',
    canAccept: true,
    organization: {
      id: 'org-1',
      name: 'Demo Store',
      slug: 'demo-store',
      plan: 'growth',
      status: 'trialing',
    },
    ...overrides,
  };
}

function createInviteRepository(
  invite: SaaSInviteTokenData | null
): InviteTokenDataRepository {
  return {
    getInviteByToken: vi.fn(async () => invite),
  };
}

function createMembershipRepository(
  membership: { id: string } | null = null
): InviteAcceptanceMembershipRepository {
  return {
    findMembership: vi.fn(async () => membership),
  };
}

describe('SaaS invite acceptance live data loader', () => {
  it('loads a pending invite as can_accept for the matching signed-in user', async () => {
    const inviteRepository = createInviteRepository(buildInvite());
    const membershipRepository = createMembershipRepository();

    const result = await loadInviteAcceptanceView(' token-1 ', {
      inviteRepository,
      membershipRepository,
      auth: async () => ({
        ok: true,
        status: 200,
        userId: 'user-1',
        userEmail: 'STAFF@EXAMPLE.COM',
        isAdmin: false,
      }),
      now: new Date('2026-05-22T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        invite: {
          id: 'invite-1',
          email: 'staff@example.com',
          role: 'staff',
          inviteStatus: 'pending',
          canAccept: true,
        },
        organization: {
          name: 'Demo Store',
        },
        viewer: {
          state: 'can_accept',
          userId: 'user-1',
          userEmail: 'STAFF@EXAMPLE.COM',
        },
      },
    });
    expect(inviteRepository.getInviteByToken).toHaveBeenCalledWith({
      token: 'token-1',
      now: new Date('2026-05-22T00:00:00.000Z'),
    });
    expect(membershipRepository.findMembership).toHaveBeenCalledWith({
      orgId: 'org-1',
      userId: 'user-1',
    });
  });

  it('returns needs_login for public viewers without querying membership', async () => {
    const inviteRepository = createInviteRepository(buildInvite());
    const membershipRepository = createMembershipRepository();

    const result = await loadInviteAcceptanceView('token-1', {
      inviteRepository,
      membershipRepository,
      auth: async () => ({
        ok: false,
        status: 401,
        error: 'Unauthorized',
        isAdmin: false,
      }),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        viewer: {
          state: 'needs_login',
          userId: null,
          userEmail: null,
        },
      },
    });
    expect(membershipRepository.findMembership).not.toHaveBeenCalled();
  });

  it('returns email_mismatch for signed-in users with a different email', async () => {
    const inviteRepository = createInviteRepository(buildInvite());
    const membershipRepository = createMembershipRepository();

    const result = await loadInviteAcceptanceView('token-1', {
      inviteRepository,
      membershipRepository,
      auth: async () => ({
        ok: true,
        status: 200,
        userId: 'user-1',
        userEmail: 'other@example.com',
        isAdmin: false,
      }),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        viewer: {
          state: 'email_mismatch',
        },
      },
    });
    expect(membershipRepository.findMembership).not.toHaveBeenCalled();
  });

  it('returns already_member when the signed-in user is already in the org', async () => {
    const inviteRepository = createInviteRepository(buildInvite());
    const membershipRepository = createMembershipRepository({
      id: 'membership-1',
    });

    const result = await loadInviteAcceptanceView('token-1', {
      inviteRepository,
      membershipRepository,
      auth: async () => ({
        ok: true,
        status: 200,
        userId: 'user-1',
        userEmail: 'staff@example.com',
        isAdmin: false,
      }),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        viewer: {
          state: 'already_member',
        },
      },
    });
  });

  it('returns empty state for missing or unknown tokens', async () => {
    await expect(loadInviteAcceptanceView('')).resolves.toEqual({
      state: 'empty',
      data: null,
      message: 'Invite token is missing.',
    });

    await expect(
      loadInviteAcceptanceView('missing-token', {
        inviteRepository: createInviteRepository(null),
      })
    ).resolves.toEqual({
      state: 'empty',
      data: null,
      message: 'Invite was not found.',
    });
  });

  it('returns error state for repository failures', async () => {
    const result = await loadInviteAcceptanceView('token-1', {
      inviteRepository: {
        getInviteByToken: vi.fn(async () => {
          throw new Error('invite lookup failed');
        }),
      },
    });

    expect(result).toEqual({
      state: 'error',
      data: null,
      message: 'invite lookup failed',
    });
  });
});
