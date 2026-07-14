/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import type { SaaSOrgContext } from '@/lib/saas/org-context';
import {
  buildTeamInviteActionFlags,
  buildTeamMemberActionFlags,
  changeTeamMemberRole,
  disableTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
  TeamManagementError,
  type TeamInviteManagementRecord,
  type TeamManagementRepository,
  type TeamMemberManagementRecord,
} from '@/lib/saas/team-management';

function buildContext(overrides: Partial<SaaSOrgContext> = {}): SaaSOrgContext {
  return {
    userId: 'owner-user',
    orgId: 'org-1',
    orgName: 'Demo Store',
    orgSlug: 'demo-store',
    orgStatus: 'active',
    role: 'owner',
    plan: 'basic',
    planDefinition: getSaaSPlanDefinition('basic'),
    featureFlags: {
      public_signup: false,
      public_lead_capture: false,
      google_auth: false,
      google_trial_signup: false,
      billing: false,
      subscription_plan: false,
      ai_usage_limit: true,
      advanced_analytics: false,
      multi_tenant_admin: false,
      image_ai: false,
    },
    isPlatformAdmin: false,
    ...overrides,
  };
}

function member(
  overrides: Partial<TeamMemberManagementRecord> = {}
): TeamMemberManagementRecord {
  return {
    id: 'member-1',
    orgId: 'org-1',
    userId: 'member-user',
    email: 'member@example.com',
    role: 'staff',
    status: 'active',
    joinedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function invite(
  overrides: Partial<TeamInviteManagementRecord> = {}
): TeamInviteManagementRecord {
  return {
    id: 'invite-1',
    orgId: 'org-1',
    email: 'staff@example.com',
    role: 'staff',
    status: 'pending',
    token: 'old-token',
    expiresAt: '2026-06-30T00:00:00.000Z',
    acceptedAt: null,
    ...overrides,
  };
}

function createRepository(input: {
  members?: TeamMemberManagementRecord[];
  invites?: TeamInviteManagementRecord[];
} = {}): TeamManagementRepository & {
  audit: Array<Record<string, unknown>>;
} {
  const state = {
    members: input.members ?? [
      member({
        id: 'owner-member',
        userId: 'owner-user',
        email: 'owner@example.com',
        role: 'owner',
      }),
      member(),
    ],
    invites: input.invites ?? [invite()],
    audit: [] as Array<Record<string, unknown>>,
  };

  return {
    audit: state.audit,
    async getMember({ orgId, memberId }) {
      return state.members.find((row) => row.orgId === orgId && row.id === memberId) ?? null;
    },
    async listMembers({ orgId }) {
      return state.members.filter((row) => row.orgId === orgId);
    },
    async updateMemberRole({ orgId, memberId, role }) {
      const row = state.members.find((item) => item.orgId === orgId && item.id === memberId);
      if (!row) {
        return null;
      }
      row.role = role;
      return row;
    },
    async disableMember({ orgId, memberId }) {
      const row = state.members.find((item) => item.orgId === orgId && item.id === memberId);
      if (!row) {
        return null;
      }
      row.status = 'disabled';
      return row;
    },
    async getInvite({ orgId, inviteId }) {
      return state.invites.find((row) => row.orgId === orgId && row.id === inviteId) ?? null;
    },
    async getSeatUsage({ orgId, excludeInviteId }) {
      return {
        activeMemberCount: state.members.filter(
          (row) => row.orgId === orgId && row.status !== 'disabled'
        ).length,
        pendingInviteCount: state.invites.filter(
          (row) => row.orgId === orgId && row.id !== excludeInviteId && row.status === 'pending'
        ).length,
      };
    },
    async revokeInvite({ orgId, inviteId, revokedAt }) {
      const row = state.invites.find((item) => item.orgId === orgId && item.id === inviteId);
      if (!row) {
        return null;
      }
      row.status = 'revoked';
      row.expiresAt = revokedAt;
      return row;
    },
    async resendInvite({ orgId, inviteId, token, expiresAt }) {
      const row = state.invites.find((item) => item.orgId === orgId && item.id === inviteId);
      if (!row) {
        return null;
      }
      row.status = 'pending';
      row.token = token;
      row.expiresAt = expiresAt;
      row.acceptedAt = null;
      return row;
    },
    async insertAuditLog(input) {
      state.audit.push(input);
    },
  };
}

describe('SaaS team management P1 backend contract', () => {
  it('lets owners change managed member roles and records org-scoped audit', async () => {
    const repository = createRepository();
    const getContext = vi.fn(async () => buildContext());

    const result = await changeTeamMemberRole(
      {
        memberId: 'member-1',
        role: 'viewer',
      },
      {
        getContext,
        repository,
      }
    );

    expect(getContext).toHaveBeenCalledWith({
      requirements: {
        roles: ['owner', 'admin'],
        writable: true,
      },
    });
    expect(result.member).toMatchObject({
      id: 'member-1',
      orgId: 'org-1',
      role: 'viewer',
    });
    expect(result.actions).toMatchObject({
      canChangeRole: true,
      canDisable: true,
    });
    expect(repository.audit).toEqual([
      expect.objectContaining({
        orgId: 'org-1',
        actorUserId: 'owner-user',
        action: 'member.role_changed',
        targetType: 'organization_member',
        targetId: 'member-1',
      }),
    ]);
  });

  it('prevents admins from managing owners or other admins', async () => {
    const repository = createRepository({
      members: [
        member({
          id: 'owner-member',
          userId: 'owner-user',
          role: 'owner',
        }),
        member({
          id: 'admin-member',
          userId: 'admin-user',
          role: 'admin',
        }),
      ],
    });

    await expect(
      changeTeamMemberRole(
        {
          memberId: 'owner-member',
          role: 'viewer',
        },
        {
          getContext: vi.fn(async () => buildContext({ userId: 'admin-user', role: 'admin' })),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'last_owner',
    });

    await expect(
      disableTeamMember(
        {
          memberId: 'admin-member',
        },
        {
          getContext: vi.fn(async () => buildContext({ userId: 'other-admin', role: 'admin' })),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'role_forbidden',
    });
  });

  it('blocks disabling self and the last active owner', async () => {
    const repository = createRepository({
      members: [
        member({
          id: 'owner-member',
          userId: 'owner-user',
          role: 'owner',
        }),
        member({
          id: 'staff-member',
          userId: 'staff-user',
          role: 'staff',
        }),
      ],
    });

    await expect(
      disableTeamMember(
        {
          memberId: 'owner-member',
        },
        {
          getContext: vi.fn(async () => buildContext()),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'self_disable',
    });

    await expect(
      changeTeamMemberRole(
        {
          memberId: 'owner-member',
          role: 'viewer',
        },
        {
          getContext: vi.fn(async () => buildContext({ userId: 'other-owner' })),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'last_owner',
    });
  });

  it('scopes target lookup by org id and member id before writes', async () => {
    const repository = createRepository({
      members: [
        member({
          id: 'member-1',
          orgId: 'other-org',
        }),
      ],
    });

    await expect(
      changeTeamMemberRole(
        {
          memberId: 'member-1',
          role: 'viewer',
        },
        {
          getContext: vi.fn(async () => buildContext()),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'not_found',
    });
    expect(repository.audit).toEqual([]);
  });

  it('revokes only pending invites and makes revoked invites non-actionable', async () => {
    const repository = createRepository();

    const result = await revokeTeamInvite(
      {
        inviteId: 'invite-1',
      },
      {
        getContext: vi.fn(async () => buildContext()),
        repository,
        now: new Date('2026-06-15T00:00:00.000Z'),
      }
    );

    expect(result.invite).toMatchObject({
      id: 'invite-1',
      status: 'revoked',
    });
    expect(result.actions).toMatchObject({
      canRevoke: false,
      canResend: false,
      disabledReason: 'Invite has been revoked.',
    });
    expect(repository.audit[0]).toMatchObject({
      action: 'invite.revoked',
      targetId: 'invite-1',
    });

    expect(
      buildTeamInviteActionFlags({
        actorRole: 'owner',
        invite: result.invite,
      })
    ).toMatchObject({
      canRevoke: false,
      canResend: false,
    });
  });

  it('resends pending or expired invites with a new token and seat-limit guard', async () => {
    const repository = createRepository({
      invites: [
        invite({
          id: 'invite-expired',
          status: 'expired',
          expiresAt: '2026-06-01T00:00:00.000Z',
        }),
      ],
    });

    const result = await resendTeamInvite(
      {
        inviteId: 'invite-expired',
      },
      {
        getContext: vi.fn(async () => buildContext({
          plan: 'growth',
          planDefinition: getSaaSPlanDefinition('growth'),
        })),
        repository,
        token: 'new-token',
        now: new Date('2026-06-15T00:00:00.000Z'),
      }
    );

    expect(result.invite).toMatchObject({
      id: 'invite-expired',
      status: 'pending',
      token: 'new-token',
      expiresAt: '2026-06-22T00:00:00.000Z',
    });
    expect(repository.audit[0]).toMatchObject({
      action: 'invite.resent',
      targetId: 'invite-expired',
    });

    const fullRepository = createRepository({
      members: [
        member({ id: 'owner-member', role: 'owner', userId: 'owner-user' }),
        member({ id: 'admin-member', role: 'admin', userId: 'admin-user' }),
      ],
      invites: [invite({ id: 'invite-1', status: 'expired' })],
    });
    await expect(
      resendTeamInvite(
        {
          inviteId: 'invite-1',
        },
        {
          getContext: vi.fn(async () => buildContext()),
          repository: fullRepository,
          now: new Date('2026-06-15T00:00:00.000Z'),
        }
      )
    ).rejects.toBeInstanceOf(TeamManagementError);
  });

  it('exposes stable row action flags for Claude UI without UI-side role rules', () => {
    expect(
      buildTeamMemberActionFlags({
        actorUserId: 'owner-user',
        actorRole: 'owner',
        target: member({
          userId: 'staff-user',
          role: 'staff',
        }),
        activeOwnerCount: 1,
      })
    ).toEqual({
      canChangeRole: true,
      canDisable: true,
    });

    expect(
      buildTeamMemberActionFlags({
        actorUserId: 'admin-user',
        actorRole: 'admin',
        target: member({
          userId: 'owner-user',
          role: 'owner',
        }),
        activeOwnerCount: 1,
      })
    ).toMatchObject({
      canChangeRole: false,
      canDisable: false,
      disabledReason: 'At least one active owner must remain.',
    });
  });
});
