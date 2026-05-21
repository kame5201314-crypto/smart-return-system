import { describe, expect, it, vi } from 'vitest';

import {
  acceptSaaSInvite,
  SaaSInviteAcceptanceError,
  type SaaSInviteAcceptanceRepository,
} from '@/lib/saas/invite-acceptance';
import type { SaaSInviteStatus } from '@/lib/saas/invite-policy';
import type { SaaSInviteTokenData } from '@/lib/saas/invite-token-data';

function buildInvite(
  overrides: Partial<SaaSInviteTokenData> = {}
): SaaSInviteTokenData {
  return {
    id: 'invite-1',
    orgId: 'org-1',
    email: 'staff@example.com',
    role: 'staff',
    token: 'token-1',
    expiresAt: '2026-05-28T00:00:00.000Z',
    acceptedAt: null,
    status: 'pending',
    canAccept: true,
    organization: {
      id: 'org-1',
      name: 'Morning Shop',
      slug: 'morning-shop',
      plan: 'growth',
      status: 'trialing',
    },
    ...overrides,
  };
}

function createRepository(
  invite: SaaSInviteTokenData | null,
  options: {
    acceptError?: Error;
    membershipId?: string | null;
  } = {}
): SaaSInviteAcceptanceRepository {
  return {
    getInviteByToken: vi.fn(async () => invite),
    acceptInvite: vi.fn(async () => {
      if (options.acceptError) {
        throw options.acceptError;
      }

      return {
        membershipId: options.membershipId ?? 'membership-1',
      };
    }),
  };
}

describe('SaaS invite acceptance service', () => {
  it('accepts a pending invite through an injected repository', async () => {
    const now = new Date('2026-05-21T08:00:00.000Z');
    const repository = createRepository(buildInvite());

    await expect(
      acceptSaaSInvite(
        {
          token: ' token-1 ',
          userId: 'user-1',
          userEmail: 'STAFF@EXAMPLE.COM',
          now,
        },
        repository
      )
    ).resolves.toEqual({
      accepted: true,
      inviteId: 'invite-1',
      orgId: 'org-1',
      membershipId: 'membership-1',
      role: 'staff',
      acceptedAt: '2026-05-21T08:00:00.000Z',
    });

    expect(repository.getInviteByToken).toHaveBeenCalledWith({
      token: 'token-1',
      now,
    });
    expect(repository.acceptInvite).toHaveBeenCalledWith({
      inviteId: 'invite-1',
      orgId: 'org-1',
      userId: 'user-1',
      userEmail: 'staff@example.com',
      role: 'staff',
      acceptedAt: '2026-05-21T08:00:00.000Z',
    });
  });

  it('validates input before loading or accepting an invite', async () => {
    const repository = createRepository(buildInvite());

    await expect(
      acceptSaaSInvite(
        {
          token: '',
          userId: 'user-1',
          userEmail: 'staff@example.com',
        },
        repository
      )
    ).rejects.toMatchObject({
      code: 'invalid_request',
      status: 400,
    });

    expect(repository.getInviteByToken).not.toHaveBeenCalled();
    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('returns not found when the invite token cannot be loaded', async () => {
    const repository = createRepository(null);

    await expect(
      acceptSaaSInvite(
        {
          token: 'missing-token',
          userId: 'user-1',
          userEmail: 'staff@example.com',
        },
        repository
      )
    ).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    });

    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('requires the signed-in user email to match the invite email', async () => {
    const repository = createRepository(buildInvite());

    await expect(
      acceptSaaSInvite(
        {
          token: 'token-1',
          userId: 'user-1',
          userEmail: 'other@example.com',
        },
        repository
      )
    ).rejects.toMatchObject({
      code: 'email_mismatch',
      status: 403,
    });

    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('rejects invite records without an acceptable member role', async () => {
    const repository = createRepository(buildInvite({ role: null }));

    await expect(
      acceptSaaSInvite(
        {
          token: 'token-1',
          userId: 'user-1',
          userEmail: 'staff@example.com',
        },
        repository
      )
    ).rejects.toMatchObject({
      code: 'invalid_role',
      status: 400,
    });

    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it.each([
    ['accepted', 'invite_already_accepted', 409],
    ['expired', 'invite_expired', 410],
    ['revoked', 'invite_revoked', 410],
  ] as Array<[SaaSInviteStatus, string, number]>)(
    'blocks %s invites before repository writes',
    async (status, code, httpStatus) => {
      const repository = createRepository(
        buildInvite({
          status,
          canAccept: false,
        })
      );

      await expect(
        acceptSaaSInvite(
          {
            token: 'token-1',
            userId: 'user-1',
            userEmail: 'staff@example.com',
          },
          repository
        )
      ).rejects.toMatchObject({
        code,
        status: httpStatus,
      });

      expect(repository.acceptInvite).not.toHaveBeenCalled();
    }
  );

  it('wraps repository write failures as invite acceptance failures', async () => {
    const repository = createRepository(buildInvite(), {
      acceptError: new Error('RPC failed'),
    });
    const attempt = acceptSaaSInvite(
      {
        token: 'token-1',
        userId: 'user-1',
        userEmail: 'staff@example.com',
        now: new Date('2026-05-21T08:00:00.000Z'),
      },
      repository
    );

    await expect(attempt).rejects.toBeInstanceOf(SaaSInviteAcceptanceError);
    await expect(attempt).rejects.toMatchObject({
      code: 'accept_failed',
      status: 500,
    });
  });
});
