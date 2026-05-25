import { describe, expect, it, vi } from 'vitest';

import {
  buildSaaSOrgContext,
  createSupabaseOrgMembershipRepository,
  getOrgContext,
  normalizeMembershipRow,
  normalizeSaaSOrgRole,
  normalizeSaaSOrgStatus,
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
      role: 'admin',
      plan: 'growth',
      isPlatformAdmin: false,
    });
    expect(context.planDefinition.aiMonthlyLimit).toBe(30);
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

    expect(context.planDefinition.name).toBe('Basic');
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
            plan: 'pro',
            status: 'active',
          },
        ],
      })
    ).toEqual({
      orgId: 'org-1',
      role: 'staff',
      organization: {
        id: 'org-1',
        plan: 'pro',
        status: 'active',
      },
    });

    expect(normalizeMembershipRow({ org_id: 'org-1', role: 'staff' })).toBeNull();
  });

  it('wraps the Supabase membership query without using service-role access', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        org_id: 'org-1',
        role: 'owner',
        organizations: {
          id: 'org-1',
          plan: 'pro',
          status: 'active',
        },
      },
      error: null,
    }));
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle,
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
      'org_id, role, organizations!inner(id, name, slug, plan, status, feature_flags)'
    );
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it('raises a typed lookup error when the membership query fails', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
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
