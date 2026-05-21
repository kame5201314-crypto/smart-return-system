import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  createInviteTokenDataRepository,
  type InviteTokenQueryBuilder,
  type InviteTokenQueryClient,
} from '@/lib/saas/invite-token-data';

interface QueryResult {
  data: unknown;
  error: { message?: string } | null;
}

interface TestQueryBuilder extends InviteTokenQueryBuilder {
  select: Mock<(columns: string) => InviteTokenQueryBuilder>;
  eq: Mock<(column: string, value: unknown) => InviteTokenQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
}

function createChain(data: unknown, error: { message?: string } | null = null): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;
  const result = { data, error };

  chain.select = vi.fn(() => chain) as Mock<(columns: string) => InviteTokenQueryBuilder>;
  chain.eq = vi.fn(() => chain) as Mock<(column: string, value: unknown) => InviteTokenQueryBuilder>;
  chain.maybeSingle = vi.fn(async () => result);

  return chain;
}

describe('SaaS invite token data repository', () => {
  it('loads a pending invite by token with organization context', async () => {
    const chain = createChain({
      id: 'invite-1',
      org_id: 'org-1',
      email: 'staff@example.com',
      role: 'staff',
      token: 'token-1',
      expires_at: '2026-05-28T00:00:00.000Z',
      accepted_at: null,
      organizations: {
        id: 'org-1',
        name: 'Morning Shop',
        slug: 'morning-shop',
        plan: 'growth',
        status: 'trialing',
      },
    });
    const from = vi.fn(() => chain);
    const repository = createInviteTokenDataRepository({ from } as InviteTokenQueryClient);

    await expect(
      repository.getInviteByToken({
        token: 'token-1',
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toEqual({
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
    });
    expect(from).toHaveBeenCalledWith('organization_invites');
    expect(chain.select).toHaveBeenCalledWith(
      'id, org_id, email, role, token, expires_at, accepted_at, organizations(id, name, slug, plan, status)'
    );
    expect(chain.eq).toHaveBeenCalledWith('token', 'token-1');
  });

  it('marks expired and accepted invites as not acceptable', async () => {
    const repository = createInviteTokenDataRepository({
      from: vi
        .fn()
        .mockReturnValueOnce(
          createChain({
            id: 'invite-expired',
            org_id: 'org-1',
            email: 'expired@example.com',
            role: 'viewer',
            token: 'token-expired',
            expires_at: '2026-05-01T00:00:00.000Z',
            accepted_at: null,
          })
        )
        .mockReturnValueOnce(
          createChain({
            id: 'invite-accepted',
            org_id: 'org-1',
            email: 'accepted@example.com',
            role: 'admin',
            token: 'token-accepted',
            expires_at: '2026-05-28T00:00:00.000Z',
            accepted_at: '2026-05-20T00:00:00.000Z',
          })
        ),
    } as InviteTokenQueryClient);

    await expect(
      repository.getInviteByToken({
        token: 'token-expired',
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      status: 'expired',
      canAccept: false,
    });

    await expect(
      repository.getInviteByToken({
        token: 'token-accepted',
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      status: 'accepted',
      canAccept: false,
    });
  });

  it('rejects invalid invite roles while preserving the invite record', async () => {
    const repository = createInviteTokenDataRepository({
      from: vi.fn(() =>
        createChain({
          id: 'invite-owner',
          org_id: 'org-1',
          email: 'owner@example.com',
          role: 'owner',
          token: 'token-owner',
          expires_at: '2026-05-28T00:00:00.000Z',
          accepted_at: null,
          organizations: [
            {
              id: 'org-1',
              name: 'Morning Shop',
              slug: 'morning-shop',
              plan: 'basic',
              status: 'active',
            },
          ],
        })
      ),
    } as InviteTokenQueryClient);

    await expect(
      repository.getInviteByToken({
        token: 'token-owner',
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      role: null,
      status: 'pending',
      canAccept: false,
      organization: {
        id: 'org-1',
      },
    });
  });

  it('returns null for missing or malformed invite tokens', async () => {
    const from = vi.fn(() => createChain(null));
    const repository = createInviteTokenDataRepository({ from } as InviteTokenQueryClient);

    await expect(repository.getInviteByToken({ token: '' })).resolves.toBeNull();
    await expect(repository.getInviteByToken({ token: 'missing-token' })).resolves.toBeNull();

    expect(from).toHaveBeenCalledTimes(1);
  });

  it('surfaces repository query errors instead of serving stale invite data', async () => {
    const repository = createInviteTokenDataRepository({
      from: vi.fn(() =>
        createChain(null, {
          message: 'invite token query failed',
        })
      ),
    } as InviteTokenQueryClient);

    await expect(
      repository.getInviteByToken({
        token: 'token-1',
      })
    ).rejects.toThrow('invite token query failed');
  });
});
