import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  buildTeamSettingsViewInput,
  createSettingsTeamDataRepository,
  type SettingsTeamQueryBuilder,
  type SettingsTeamQueryClient,
} from '@/lib/saas/settings-team-data';
import { buildTeamSettingsView } from '@/lib/saas/ui-backend-contracts';

interface QueryResult {
  data: unknown;
  error: { message?: string } | null;
}

interface TestQueryBuilder extends SettingsTeamQueryBuilder {
  select: Mock<(columns: string) => SettingsTeamQueryBuilder>;
  eq: Mock<(column: string, value: unknown) => SettingsTeamQueryBuilder>;
  order: Mock<(column: string, options: { ascending: boolean }) => SettingsTeamQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
}

function createChain(data: unknown, error: { message?: string } | null = null): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;
  const result = { data, error };

  chain.select = vi.fn(() => chain) as Mock<(columns: string) => SettingsTeamQueryBuilder>;
  chain.eq = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsTeamQueryBuilder>;
  chain.order = vi.fn(() => chain) as Mock<(column: string, options: { ascending: boolean }) => SettingsTeamQueryBuilder>;
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = ((onfulfilled, onrejected) =>
    Promise.resolve(result).then(onfulfilled, onrejected)) as SettingsTeamQueryBuilder['then'];

  return chain;
}

describe('SaaS settings team data repository', () => {
  it('loads organization plan, members, and invites for team settings DTOs', async () => {
    const organizationChain = createChain({
      id: 'org-1',
      plan: 'basic',
    });
    const membersChain = createChain([
      {
        id: 'member-1',
        email: 'owner@example.com',
        role: 'owner',
        status: 'active',
        created_at: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'member-2',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        created_at: '2026-05-02T00:00:00.000Z',
      },
    ]);
    const invitesChain = createChain([
      {
        id: 'invite-1',
        email: 'staff@example.com',
        role: 'staff',
        expires_at: '2026-05-28T00:00:00.000Z',
        accepted_at: null,
        created_at: '2026-05-20T00:00:00.000Z',
      },
    ]);
    const from = vi
      .fn()
      .mockReturnValueOnce(organizationChain)
      .mockReturnValueOnce(membersChain)
      .mockReturnValueOnce(invitesChain);
    const repository = createSettingsTeamDataRepository({ from } as SettingsTeamQueryClient);

    const input = await buildTeamSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: {
        canInvite: true,
        canChangeRoles: true,
      },
      now: new Date('2026-05-21T00:00:00.000Z'),
    });

    expect(input).toMatchObject({
      orgId: 'org-1',
      plan: 'basic',
    });
    expect(input?.members[0]).toMatchObject({
      email: 'owner@example.com',
      role: 'owner',
      status: 'active',
    });
    expect(input?.invites[0]).toMatchObject({
      email: 'staff@example.com',
      role: 'staff',
      status: 'pending',
    });
    expect(buildTeamSettingsView(input!).actions).toEqual({
      canInvite: false,
      canChangeRoles: true,
      disabledReason: 'Seat limit has been reached for this plan.',
    });
    expect(from).toHaveBeenNthCalledWith(1, 'organizations');
    expect(from).toHaveBeenNthCalledWith(2, 'organization_members');
    expect(from).toHaveBeenNthCalledWith(3, 'organization_invites');
    expect(membersChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(invitesChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('derives accepted and expired invite statuses from invite timestamps', async () => {
    const repository = createSettingsTeamDataRepository({
      from: vi.fn(() =>
        createChain([
          {
            id: 'invite-accepted',
            email: 'accepted@example.com',
            role: 'viewer',
            expires_at: '2026-05-28T00:00:00.000Z',
            accepted_at: '2026-05-20T00:00:00.000Z',
          },
          {
            id: 'invite-expired',
            email: 'expired@example.com',
            role: 'staff',
            expires_at: '2026-05-01T00:00:00.000Z',
            accepted_at: null,
          },
        ])
      ),
    } as SettingsTeamQueryClient);

    await expect(
      repository.listInvites({
        orgId: 'org-1',
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject([
      {
        status: 'accepted',
      },
      {
        status: 'expired',
      },
    ]);
  });

  it('returns null when organization team plan data is missing', async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(createChain(null))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));
    const repository = createSettingsTeamDataRepository({ from } as SettingsTeamQueryClient);

    await expect(
      buildTeamSettingsViewInput(repository, {
        orgId: 'missing-org',
        actions: {
          canInvite: false,
          canChangeRoles: false,
        },
      })
    ).resolves.toBeNull();
  });

  it('surfaces repository query errors instead of serving partial team data', async () => {
    const repository = createSettingsTeamDataRepository({
      from: vi.fn(() =>
        createChain(null, {
          message: 'team query failed',
        })
      ),
    } as SettingsTeamQueryClient);

    await expect(
      repository.getOrganizationPlan({
        orgId: 'org-1',
      })
    ).rejects.toThrow('team query failed');
  });
});
