/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleCreateSaaSTeamInviteRequest } from '@/app/api/saas/team/invites/route';
import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import { SaaSOrgContextError, type SaaSOrgContext } from '@/lib/saas/org-context';
import {
  createSaaSTeamInviteFromRequest,
  type SaaSTeamInviteRouteDependencies,
} from '@/lib/saas/team-invite-route';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/team/invites', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function buildContext(overrides: Partial<SaaSOrgContext> = {}): SaaSOrgContext {
  return {
    userId: 'owner-1',
    orgId: 'org-1',
    orgName: 'Demo Store',
    orgSlug: 'demo-store',
    orgStatus: 'active',
    role: 'owner',
    plan: 'basic',
    planDefinition: getSaaSPlanDefinition('basic'),
    featureFlags: {
      public_signup: false,
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

function createDeps(
  overrides: Partial<SaaSTeamInviteRouteDependencies> = {}
): SaaSTeamInviteRouteDependencies {
  return {
    getContext: vi.fn(async () => buildContext()),
    teamRepository: {
      listMembers: vi.fn(async () => [
        {
          id: 'member-1',
          email: 'owner@example.com',
          displayName: null,
          role: 'owner',
          status: 'active',
          joinedAt: '2026-05-01T00:00:00.000Z',
        },
      ]),
      listInvites: vi.fn(async () => []),
    },
    inviteRepository: {
      createInvite: vi.fn(async (input) => ({
        inviteId: 'invite-1',
        token: input.token,
      })),
    },
    now: new Date('2026-05-22T08:00:00.000Z'),
    ...overrides,
  };
}

describe('SaaS team invite API foundation', () => {
  it('creates a team invite for owner/admin org context through injected repositories', async () => {
    const deps = createDeps();

    const response = await handleCreateSaaSTeamInviteRequest(
      buildRequest({
        email: 'STAFF@EXAMPLE.COM',
        role: 'staff',
      }),
      deps
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        created: true,
        inviteId: 'invite-1',
        orgId: 'org-1',
        email: 'staff@example.com',
        role: 'staff',
        expiresAt: '2026-05-29T08:00:00.000Z',
        createdAt: '2026-05-22T08:00:00.000Z',
      },
    });
    expect(deps.getContext).toHaveBeenCalledWith({
      requirements: {
        roles: ['owner', 'admin'],
        writable: true,
      },
    });
    expect(deps.teamRepository?.listMembers).toHaveBeenCalledWith({
      orgId: 'org-1',
    });
    expect(deps.teamRepository?.listInvites).toHaveBeenCalledWith({
      orgId: 'org-1',
      now: new Date('2026-05-22T08:00:00.000Z'),
    });
    expect(deps.inviteRepository?.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        email: 'staff@example.com',
        role: 'staff',
        invitedBy: 'owner-1',
        expiresAt: '2026-05-29T08:00:00.000Z',
      })
    );
  });

  it('blocks unauthenticated or non-member requests before querying team data', async () => {
    const deps = createDeps({
      getContext: vi.fn(async () => {
        throw new SaaSOrgContextError(
          'membership_required',
          403,
          'A SaaS organization membership is required for this action.'
        );
      }),
    });

    const response = await handleCreateSaaSTeamInviteRequest(
      buildRequest({
        email: 'staff@example.com',
        role: 'staff',
      }),
      deps
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'membership_required',
    });
    expect(deps.teamRepository?.listMembers).not.toHaveBeenCalled();
    expect(deps.inviteRepository?.createInvite).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON request bodies', async () => {
    const deps = createDeps();
    const response = await handleCreateSaaSTeamInviteRequest(
      new NextRequest('http://localhost/api/saas/team/invites', {
        method: 'POST',
        body: '{bad json',
      }),
      deps
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'invalid_request',
    });
    expect(deps.getContext).not.toHaveBeenCalled();
    expect(deps.inviteRepository?.createInvite).not.toHaveBeenCalled();
  });

  it('enforces plan seat limits before invite writes', async () => {
    const deps = createDeps({
      teamRepository: {
        listMembers: vi.fn(async () => [
          {
            id: 'member-1',
            email: 'owner@example.com',
            displayName: null,
            role: 'owner',
            status: 'active',
            joinedAt: null,
          },
          {
            id: 'member-2',
            email: 'admin@example.com',
            displayName: null,
            role: 'admin',
            status: 'active',
            joinedAt: null,
          },
        ]),
        listInvites: vi.fn(async () => [
          {
            id: 'invite-1',
            email: 'pending@example.com',
            role: 'staff',
            status: 'pending',
            expiresAt: '2026-05-29T08:00:00.000Z',
          },
        ]),
      },
    });

    const response = await handleCreateSaaSTeamInviteRequest(
      buildRequest({
        email: 'new@example.com',
        role: 'viewer',
      }),
      deps
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'seat_limit_reached',
    });
    expect(deps.inviteRepository?.createInvite).not.toHaveBeenCalled();
  });

  it('rejects unsupported invite roles before invite writes', async () => {
    const deps = createDeps();

    const response = await handleCreateSaaSTeamInviteRequest(
      buildRequest({
        email: 'owner@example.com',
        role: 'owner',
      }),
      deps
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'invalid_role',
    });
    expect(deps.inviteRepository?.createInvite).not.toHaveBeenCalled();
  });

  it('uses active members plus pending invites when called as a pure use-case', async () => {
    const deps = createDeps();

    await expect(
      createSaaSTeamInviteFromRequest(
        {
          email: 'staff@example.com',
          role: 'staff',
        },
        deps
      )
    ).resolves.toMatchObject({
      created: true,
      email: 'staff@example.com',
      role: 'staff',
    });

    expect(deps.inviteRepository?.createInvite).toHaveBeenCalledOnce();
  });
});
