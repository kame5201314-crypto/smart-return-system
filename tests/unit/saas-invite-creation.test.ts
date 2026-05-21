import { describe, expect, it, vi } from 'vitest';

import {
  buildCreateOrganizationInviteRpcArgs,
  createSaaSInvite,
  createSaaSInviteCreationRepository,
  generateSaaSInviteToken,
  SaaSInviteCreationError,
  type SaaSInviteCreationRepository,
} from '@/lib/saas/invite-creation';

function createRepository(options: { error?: Error } = {}): SaaSInviteCreationRepository {
  return {
    createInvite: vi.fn(async (input) => {
      if (options.error) {
        throw options.error;
      }

      return {
        inviteId: 'invite-1',
        token: input.token,
      };
    }),
  };
}

describe('SaaS invite creation service', () => {
  const now = new Date('2026-05-21T08:00:00.000Z');

  it('creates a pending invite through an injected repository', async () => {
    const repository = createRepository();

    await expect(
      createSaaSInvite(
        {
          orgId: 'org-1',
          email: ' STAFF@EXAMPLE.COM ',
          role: 'staff',
          invitedBy: 'owner-1',
          seatLimit: 3,
          activeMemberCount: 1,
          pendingInviteCount: 1,
          now,
          token: 'token-1',
        },
        repository
      )
    ).resolves.toEqual({
      created: true,
      inviteId: 'invite-1',
      orgId: 'org-1',
      email: 'staff@example.com',
      role: 'staff',
      token: 'token-1',
      expiresAt: '2026-05-28T08:00:00.000Z',
      createdAt: '2026-05-21T08:00:00.000Z',
    });

    expect(repository.createInvite).toHaveBeenCalledWith({
      orgId: 'org-1',
      email: 'staff@example.com',
      role: 'staff',
      token: 'token-1',
      invitedBy: 'owner-1',
      expiresAt: '2026-05-28T08:00:00.000Z',
      createdAt: '2026-05-21T08:00:00.000Z',
    });
  });

  it('blocks invite creation when the plan seat limit is full', async () => {
    const repository = createRepository();

    await expect(
      createSaaSInvite(
        {
          orgId: 'org-1',
          email: 'staff@example.com',
          role: 'staff',
          invitedBy: 'owner-1',
          seatLimit: 3,
          activeMemberCount: 2,
          pendingInviteCount: 1,
          now,
        },
        repository
      )
    ).rejects.toMatchObject({
      code: 'seat_limit_reached',
      status: 409,
    });

    expect(repository.createInvite).not.toHaveBeenCalled();
  });

  it('allows enterprise unlimited seat limits', async () => {
    const repository = createRepository();

    await expect(
      createSaaSInvite(
        {
          orgId: 'org-1',
          email: 'admin@example.com',
          role: 'admin',
          invitedBy: 'owner-1',
          seatLimit: null,
          activeMemberCount: 100,
          pendingInviteCount: 20,
          now,
          token: 'token-1',
        },
        repository
      )
    ).resolves.toMatchObject({
      created: true,
      role: 'admin',
    });
  });

  it.each(['owner', 'member', '', null])(
    'rejects %s invite roles before repository writes',
    async (role) => {
      const repository = createRepository();

      await expect(
        createSaaSInvite(
          {
            orgId: 'org-1',
            email: 'staff@example.com',
            role,
            invitedBy: 'owner-1',
            seatLimit: 3,
            activeMemberCount: 1,
            now,
          },
          repository
        )
      ).rejects.toMatchObject({
        code: 'invalid_role',
        status: 400,
      });

      expect(repository.createInvite).not.toHaveBeenCalled();
    }
  );

  it('wraps repository failures as create failures', async () => {
    const repository = createRepository({
      error: new Error('RPC failed'),
    });
    const attempt = createSaaSInvite(
      {
        orgId: 'org-1',
        email: 'staff@example.com',
        role: 'staff',
        invitedBy: 'owner-1',
        seatLimit: 3,
        activeMemberCount: 1,
        now,
      },
      repository
    );

    await expect(attempt).rejects.toBeInstanceOf(SaaSInviteCreationError);
    await expect(attempt).rejects.toMatchObject({
      code: 'create_failed',
      status: 500,
    });
  });

  it('generates URL-safe invite tokens', () => {
    const token = generateSaaSInviteToken(32);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it('maps invite creation input to the create_organization_invite RPC args', () => {
    expect(
      buildCreateOrganizationInviteRpcArgs({
        orgId: 'org-1',
        email: 'STAFF@EXAMPLE.COM',
        role: 'staff',
        token: 'token-1',
        invitedBy: 'owner-1',
        expiresAt: '2026-05-28T08:00:00.000Z',
        createdAt: '2026-05-21T08:00:00.000Z',
      })
    ).toEqual({
      p_org_id: 'org-1',
      p_email: 'staff@example.com',
      p_role: 'staff',
      p_token: 'token-1',
      p_invited_by: 'owner-1',
      p_expires_at: '2026-05-28T08:00:00.000Z',
      p_created_at: '2026-05-21T08:00:00.000Z',
    });
  });

  it('persists invite creation through the RPC-backed repository wrapper', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        invite_id: 'invite-1',
        token: 'token-1',
        audit_log_id: 'audit-1',
      },
      error: null,
    }));
    const repository = createSaaSInviteCreationRepository({
      rpc,
    });

    await expect(
      repository.createInvite({
        orgId: 'org-1',
        email: 'staff@example.com',
        role: 'staff',
        token: 'token-1',
        invitedBy: 'owner-1',
        expiresAt: '2026-05-28T08:00:00.000Z',
        createdAt: '2026-05-21T08:00:00.000Z',
      })
    ).resolves.toEqual({
      inviteId: 'invite-1',
      token: 'token-1',
    });
    expect(rpc).toHaveBeenCalledWith('create_organization_invite', {
      p_org_id: 'org-1',
      p_email: 'staff@example.com',
      p_role: 'staff',
      p_token: 'token-1',
      p_invited_by: 'owner-1',
      p_expires_at: '2026-05-28T08:00:00.000Z',
      p_created_at: '2026-05-21T08:00:00.000Z',
    });
  });

  it('wraps RPC-backed repository errors as create failures', async () => {
    const repository = createSaaSInviteCreationRepository({
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          message: 'Seat limit reached.',
        },
      })),
    });

    await expect(
      repository.createInvite({
        orgId: 'org-1',
        email: 'staff@example.com',
        role: 'staff',
        token: 'token-1',
        invitedBy: 'owner-1',
        expiresAt: '2026-05-28T08:00:00.000Z',
        createdAt: '2026-05-21T08:00:00.000Z',
      })
    ).rejects.toMatchObject({
      code: 'create_failed',
      status: 500,
      message: 'Seat limit reached.',
    });
  });
});
