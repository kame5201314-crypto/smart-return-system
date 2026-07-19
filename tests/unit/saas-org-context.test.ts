import { describe, expect, it, vi } from 'vitest';

import {
  buildSaaSOrgContext,
  createSupabaseOrgMembershipRepository,
  getOrgContext,
  normalizeMembershipRow,
  normalizeSaaSOrgRole,
  normalizeSaaSOrgStatus,
  selectPreferredSaaSOrgMembership,
  SaaSOrgContextError,
  canExportSaaSOrgData,
  canWriteSaaSOrgData,
  type SaaSOrgMembershipRecord,
  type SaaSOrgMembershipRepository,
} from '@/lib/saas/org-context';

const authOk = async () => ({
  ok: true,
  status: 200,
  userId: 'user-1',
  isAdmin: false,
});

function createRepository(
  record: SaaSOrgMembershipRecord = {
    orgId: 'org-1',
    role: 'owner',
    organization: {
      id: 'org-1',
      name: 'Demo Org',
      slug: 'demo',
      plan: 'growth',
      status: 'active',
      feature_flags: {
        advanced_analytics: true,
        billing: true,
      },
    },
  }
): SaaSOrgMembershipRepository {
  return {
    findMembership: vi.fn(async () => record),
  };
}

describe('SaaS org context', () => {
  it('builds org, plan, role, and feature flag context from membership data', () => {
    const context = buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        orgId: 'org-1',
        role: 'admin',
        organization: {
          id: 'org-1',
          name: 'Growth Store',
          slug: 'growth-store',
          plan: 'growth',
          status: 'active',
          feature_flags: {
            advanced_analytics: true,
            billing: true,
            image_ai: true,
          },
        },
      },
      env: {
        ENABLE_IMAGE_AI: 'false',
      },
    });

    expect(context).toMatchObject({
      userId: 'user-1',
      orgId: 'org-1',
      orgName: 'Growth Store',
      orgSlug: 'growth-store',
      orgStatus: 'active',
      suspensionSource: null,
      role: 'admin',
      plan: 'growth',
      isPlatformAdmin: false,
    });
    expect(context.planDefinition.aiMonthlyLimit).toBe(25);
    expect(context.featureFlags).toMatchObject({
      advanced_analytics: true,
      billing: true,
      image_ai: false,
    });
  });

  it('keeps Basic orgs from enabling plan-gated advanced analytics', () => {
    const context = buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        orgId: 'org-1',
        role: 'owner',
        organization: {
          id: 'org-1',
          plan: 'basic',
          status: 'active',
          feature_flags: {
            advanced_analytics: true,
          },
        },
      },
      env: {},
    });

    expect(context.planDefinition.name).toBe('入門版');
    expect(context.featureFlags.advanced_analytics).toBe(false);
  });

  it('normalizes legacy roles and unsafe status values conservatively', () => {
    expect(normalizeSaaSOrgRole('member')).toBe('staff');
    expect(normalizeSaaSOrgRole('unknown')).toBe('viewer');
    expect(normalizeSaaSOrgStatus('active')).toBe('active');
    expect(normalizeSaaSOrgStatus('unexpected')).toBe('suspended');
  });

  it('uses the subscription access policy for writable org actions', () => {
    const baseContext = buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        orgId: 'org-1',
        role: 'owner',
        organization: {
          id: 'org-1',
          plan: 'growth',
          status: 'active',
        },
      },
    });

    expect(canWriteSaaSOrgData(baseContext)).toBe(true);
    expect(canWriteSaaSOrgData({ ...baseContext, orgStatus: 'trialing' })).toBe(true);
    expect(canWriteSaaSOrgData({ ...baseContext, orgStatus: 'past_due' })).toBe(false);
    expect(canWriteSaaSOrgData({ ...baseContext, orgStatus: 'suspended' })).toBe(false);
    expect(canWriteSaaSOrgData({ ...baseContext, orgStatus: 'cancelled' })).toBe(false);
  });

  it('treats an expired trial as suspended while leaving an active plan active', () => {
    const trialMembership: SaaSOrgMembershipRecord = {
      orgId: 'org-trial',
      role: 'owner',
      organization: {
        id: 'org-trial',
        plan: 'basic',
        status: 'trialing',
        trialEnd: '2026-06-09T00:00:00.000Z',
      },
    };

    const expiredTrialContext = buildSaaSOrgContext({
      userId: 'user-1',
      membership: trialMembership,
      now: new Date('2026-07-18T00:00:00.000Z'),
    });
    expect(expiredTrialContext.orgStatus).toBe('suspended');
    expect(expiredTrialContext.suspensionSource).toBe('trial_expired');

    expect(buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        ...trialMembership,
        organization: {
          ...trialMembership.organization,
          status: 'active',
        },
      },
      now: new Date('2026-07-18T00:00:00.000Z'),
    }).orgStatus).toBe('active');
  });

  it('preserves the formal suspension source only for suspended organizations', () => {
    const suspendedContext = buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        orgId: 'org-1',
        role: 'owner',
        organization: {
          id: 'org-1',
          plan: 'basic',
          status: 'suspended',
          suspension_source: 'platform_admin',
        },
      },
    });

    expect(suspendedContext.suspensionSource).toBe('platform_admin');
    expect(buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        orgId: 'org-1',
        role: 'owner',
        organization: {
          id: 'org-1',
          plan: 'basic',
          status: 'active',
          suspension_source: 'platform_admin',
        },
      },
    }).suspensionSource).toBeNull();
  });

  it('uses the subscription access policy for export actions', () => {
    const baseContext = buildSaaSOrgContext({
      userId: 'user-1',
      membership: {
        orgId: 'org-1',
        role: 'admin',
        organization: {
          id: 'org-1',
          plan: 'growth',
          status: 'active',
        },
      },
    });

    expect(canExportSaaSOrgData(baseContext)).toBe(true);
    expect(canExportSaaSOrgData({ ...baseContext, orgStatus: 'trialing' })).toBe(true);
    expect(canExportSaaSOrgData({ ...baseContext, orgStatus: 'past_due' })).toBe(false);
    expect(canExportSaaSOrgData({ ...baseContext, orgStatus: 'suspended' })).toBe(false);
    expect(canExportSaaSOrgData({ ...baseContext, orgStatus: 'cancelled' })).toBe(false);
  });

  it('loads context through the injected repository and requested org id', async () => {
    const repository = createRepository();

    const context = await getOrgContext({
      auth: authOk,
      repository,
      orgId: 'org-1',
      requirements: {
        roles: ['owner'],
        feature: 'advanced_analytics',
        writable: true,
      },
      env: {},
    });

    expect(context.orgId).toBe('org-1');
    expect(repository.findMembership).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-1',
    });
  });

  it('rejects unauthenticated requests before querying membership', async () => {
    const repository = createRepository();

    await expect(
      getOrgContext({
        auth: async () => ({ ok: false, status: 401, error: 'Unauthorized', isAdmin: false }),
        repository,
      })
    ).rejects.toMatchObject({
      code: 'unauthenticated',
      status: 401,
    });
    expect(repository.findMembership).not.toHaveBeenCalled();
  });

  it('rejects local platform admin sessions before querying tenant membership', async () => {
    const repository = createRepository();

    await expect(
      getOrgContext({
        auth: async () => ({
          ok: true,
          status: 200,
          userId: '00000000-0000-0000-0000-000000000001',
          isAdmin: true,
        }),
        repository,
      })
    ).rejects.toMatchObject({
      code: 'membership_required',
      status: 403,
      message: 'A SaaS organization account is required for workspace settings. Sign in with a tenant user to manage an organization.',
    });
    expect(repository.findMembership).not.toHaveBeenCalled();
  });

  it('rejects users without an organization membership', async () => {
    await expect(
      getOrgContext({
        auth: authOk,
        repository: {
          findMembership: vi.fn(async () => null),
        },
      })
    ).rejects.toMatchObject({
      code: 'membership_required',
      status: 403,
    });
  });

  it('rejects insufficient roles, disabled features, and inactive subscriptions', async () => {
    await expect(
      getOrgContext({
        auth: authOk,
        repository: createRepository({
          orgId: 'org-1',
          role: 'viewer',
          organization: {
            id: 'org-1',
            plan: 'growth',
            status: 'active',
            feature_flags: {},
          },
        }),
        requirements: {
          roles: ['owner', 'admin'],
        },
        env: {},
      })
    ).rejects.toMatchObject({
      code: 'role_forbidden',
      status: 403,
    });

    await expect(
      getOrgContext({
        auth: authOk,
        repository: createRepository({
          orgId: 'org-1',
          role: 'owner',
          organization: {
            id: 'org-1',
            plan: 'basic',
            status: 'active',
            feature_flags: {
              advanced_analytics: true,
            },
          },
        }),
        requirements: {
          feature: 'advanced_analytics',
        },
        env: {},
      })
    ).rejects.toMatchObject({
      code: 'feature_forbidden',
      status: 403,
    });

    await expect(
      getOrgContext({
        auth: authOk,
        repository: createRepository({
          orgId: 'org-1',
          role: 'owner',
          organization: {
            id: 'org-1',
            plan: 'growth',
            status: 'suspended',
            feature_flags: {
              advanced_analytics: true,
            },
          },
        }),
        requirements: {
          writable: true,
        },
        env: {},
      })
    ).rejects.toMatchObject({
      code: 'subscription_inactive',
      status: 402,
    });

    await expect(
      getOrgContext({
        auth: authOk,
        repository: createRepository({
          orgId: 'org-1',
          role: 'owner',
          organization: {
            id: 'org-1',
            plan: 'growth',
            status: 'past_due',
            feature_flags: {},
          },
        }),
        requirements: {
          writable: true,
        },
        env: {},
      })
    ).rejects.toMatchObject({
      code: 'subscription_inactive',
      status: 402,
    });

    await expect(
      getOrgContext({
        auth: authOk,
        repository: createRepository({
          orgId: 'org-1',
          role: 'admin',
          organization: {
            id: 'org-1',
            plan: 'growth',
            status: 'past_due',
            feature_flags: {},
          },
        }),
        requirements: {
          exportable: true,
        },
        env: {},
      })
    ).rejects.toMatchObject({
      code: 'subscription_inactive',
      status: 402,
    });
  });

  it('normalizes Supabase joined membership rows', () => {
    expect(
      normalizeMembershipRow({
        org_id: 'org-1',
        role: 'staff',
        organizations: [
          {
            id: 'org-1',
            plan: 'enterprise',
            status: 'active',
          },
        ],
      })
    ).toEqual({
      orgId: 'org-1',
      role: 'staff',
      organization: {
        id: 'org-1',
        plan: 'enterprise',
        status: 'active',
      },
    });

    expect(normalizeMembershipRow({ org_id: 'org-1', role: 'staff' })).toBeNull();
  });

  it('prefers a usable workspace over an older expired workspace', () => {
    expect(selectPreferredSaaSOrgMembership([
      {
        org_id: 'org-old-trial',
        role: 'owner',
        status: 'active',
        organizations: {
          id: 'org-old-trial',
          plan: 'growth',
          status: 'trialing',
          subscriptions: [{ trial_end: '2026-06-09T00:00:00.000Z' }],
        },
      },
      {
        org_id: 'org-active',
        role: 'staff',
        status: 'active',
        organizations: {
          id: 'org-active',
          plan: 'basic',
          status: 'active',
          subscriptions: [{ trial_end: '2026-01-01T00:00:00.000Z' }],
        },
      },
    ], new Date('2026-07-18T00:00:00.000Z'))?.orgId).toBe('org-active');
  });

  it('wraps the Supabase membership query without using service-role access', async () => {
    const order = vi.fn(async () => ({
      data: [{
        org_id: 'org-1',
        role: 'owner',
        status: 'active',
        organizations: {
          id: 'org-1',
          plan: 'enterprise',
          status: 'active',
          subscriptions: [{ trial_end: null }],
        },
      }],
      error: null,
    }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order,
    };
    const client = {
      from: vi.fn(() => query),
    };

    const repository = createSupabaseOrgMembershipRepository(client);
    const membership = await repository.findMembership({
      userId: 'user-1',
      orgId: 'org-1',
    });

    expect(membership?.orgId).toBe('org-1');
    expect(client.from).toHaveBeenCalledWith('organization_members');
    expect(query.select).toHaveBeenCalledWith(
      'org_id, role, status, organizations!inner(id, name, slug, plan, status, suspension_source, feature_flags, subscriptions(trial_end))'
    );
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('raises a typed lookup error when the membership query fails', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(async () => ({
        data: null,
        error: { message: 'database unavailable' },
      })),
    };

    await expect(
      createSupabaseOrgMembershipRepository({
        from: vi.fn(() => query),
      }).findMembership({ userId: 'user-1' })
    ).rejects.toBeInstanceOf(SaaSOrgContextError);
  });
});
