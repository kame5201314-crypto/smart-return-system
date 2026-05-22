/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleAcceptSaaSInviteRequest } from '@/app/api/saas/invite/accept/route';
import {
  acceptSaaSInviteFromRequest,
  type SaaSInviteAcceptRouteDependencies,
} from '@/lib/saas/invite-accept-route';
import type { SaaSInviteAcceptanceRepository } from '@/lib/saas/invite-acceptance';
import type { SaaSInviteTokenData } from '@/lib/saas/invite-token-data';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/invite/accept', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

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

function createRepository(invite = buildInvite()): SaaSInviteAcceptanceRepository {
  return {
    getInviteByToken: vi.fn(async () => invite),
    acceptInvite: vi.fn(async () => ({
      membershipId: 'membership-1',
    })),
  };
}

function createDeps(
  overrides: Partial<SaaSInviteAcceptRouteDependencies> = {}
): SaaSInviteAcceptRouteDependencies {
  return {
    auth: vi.fn(async () => ({
      ok: true,
      status: 200,
      userId: 'user-1',
      userEmail: 'STAFF@EXAMPLE.COM',
      isAdmin: false,
    })),
    repository: createRepository(),
    now: new Date('2026-05-22T08:00:00.000Z'),
    ...overrides,
  };
}

describe('SaaS invite accept API route', () => {
  it('accepts an invite for the signed-in matching email through injected repositories', async () => {
    const deps = createDeps();
    const response = await handleAcceptSaaSInviteRequest(
      buildRequest({
        token: ' token-1 ',
      }),
      deps
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        accepted: true,
        inviteId: 'invite-1',
        orgId: 'org-1',
        membershipId: 'membership-1',
        role: 'staff',
        acceptedAt: '2026-05-22T08:00:00.000Z',
      },
    });
    expect(deps.repository?.getInviteByToken).toHaveBeenCalledWith({
      token: 'token-1',
      now: new Date('2026-05-22T08:00:00.000Z'),
    });
    expect(deps.repository?.acceptInvite).toHaveBeenCalledWith({
      inviteId: 'invite-1',
      orgId: 'org-1',
      userId: 'user-1',
      userEmail: 'staff@example.com',
      role: 'staff',
      acceptedAt: '2026-05-22T08:00:00.000Z',
    });
  });

  it('blocks unauthenticated users before loading invite records', async () => {
    const repository = createRepository();
    const response = await handleAcceptSaaSInviteRequest(
      buildRequest({
        token: 'token-1',
      }),
      createDeps({
        auth: vi.fn(async () => ({
          ok: false,
          status: 401,
          error: 'Unauthorized',
          isAdmin: false,
        })),
        repository,
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'unauthenticated',
    });
    expect(repository.getInviteByToken).not.toHaveBeenCalled();
    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON and invalid token payloads', async () => {
    const deps = createDeps();
    const invalidJson = await handleAcceptSaaSInviteRequest(
      new NextRequest('http://localhost/api/saas/invite/accept', {
        method: 'POST',
        body: '{bad json',
      }),
      deps
    );

    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toMatchObject({
      success: false,
      code: 'invalid_request',
    });

    const invalidToken = await handleAcceptSaaSInviteRequest(buildRequest({ token: '' }), deps);

    expect(invalidToken.status).toBe(400);
    expect(await invalidToken.json()).toMatchObject({
      success: false,
      code: 'invalid_request',
    });
  });

  it('maps invite acceptance errors to stable response codes', async () => {
    const response = await handleAcceptSaaSInviteRequest(
      buildRequest({
        token: 'token-1',
      }),
      createDeps({
        repository: createRepository(
          buildInvite({
            email: 'other@example.com',
          })
        ),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'email_mismatch',
    });
  });

  it('can be called as a pure route use-case', async () => {
    await expect(
      acceptSaaSInviteFromRequest(
        {
          token: 'token-1',
        },
        createDeps()
      )
    ).resolves.toMatchObject({
      accepted: true,
      orgId: 'org-1',
      role: 'staff',
    });
  });
});
