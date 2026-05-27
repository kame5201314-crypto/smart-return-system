/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import {
  buildOnboardingUsagePeriod,
  buildSaaSOnboardingViewInputFromRepository,
  createOnboardingDataRepository,
  loadSaaSOnboardingView,
  type OnboardingDataRepository,
} from '@/lib/saas/onboarding-live-data';
import { SaaSOrgContextError, type SaaSOrgContext } from '@/lib/saas/org-context';

const orgId = '11111111-1111-4111-8111-111111111111';

function buildContext(overrides: Partial<SaaSOrgContext> = {}): SaaSOrgContext {
  return {
    userId: '22222222-2222-4222-8222-222222222222',
    orgId,
    orgName: 'Demo Store',
    orgSlug: 'demo-store',
    orgStatus: 'active',
    role: 'owner',
    plan: 'growth',
    planDefinition: getSaaSPlanDefinition('growth'),
    featureFlags: {
      public_signup: false,
      billing: false,
      subscription_plan: false,
      ai_usage_limit: true,
      advanced_analytics: true,
      multi_tenant_admin: false,
      image_ai: false,
    },
    isPlatformAdmin: false,
    ...overrides,
  };
}

function createRepository(
  overrides: Partial<OnboardingDataRepository> = {}
): OnboardingDataRepository {
  return {
    getOrganization: vi.fn(async () => ({
      id: orgId,
      name: 'Demo Store',
      onboardingCompletedAt: null,
    })),
    hasReturnPolicy: vi.fn(async () => true),
    listMembers: vi.fn(async () => [
      {
        id: 'member-1',
        status: 'active',
      },
      {
        id: 'member-2',
        status: 'disabled',
      },
    ]),
    listInvites: vi.fn(async () => [
      {
        id: 'invite-1',
        status: 'pending' as const,
      },
    ]),
    listReturns: vi.fn(async () => [{ id: 'return-1' }]),
    listAIUsage: vi.fn(async () => [{ id: 'ai-1' }]),
    ...overrides,
  };
}

describe('SaaS onboarding live data loader', () => {
  it('treats legacy users RLS recursion on return policy lookup as an incomplete optional signal', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      gte: vi.fn(() => query),
      lt: vi.fn(() => query),
      order: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: null,
        error: {
          message: 'infinite recursion detected in policy for relation "users"',
        },
      })),
      then: vi.fn(),
    };
    const repository = createOnboardingDataRepository({
      from: vi.fn(() => query),
    });

    await expect(repository.hasReturnPolicy({ orgId })).resolves.toBe(false);
  });

  it('builds onboarding progress input from real org-scoped repositories', async () => {
    const now = new Date('2026-05-26T10:00:00.000Z');
    const repository = createRepository();

    const input = await buildSaaSOnboardingViewInputFromRepository(repository, {
      context: buildContext(),
      now,
    });

    expect(input).toEqual({
      org: {
        id: orgId,
        name: 'Demo Store',
        onboardingCompletedAt: null,
      },
      signals: {
        returnPolicyConfigured: true,
        memberCount: 1,
        pendingInviteCount: 1,
        returnCount: 1,
        aiUsageCount: 1,
      },
      actions: {
        canComplete: true,
        disabledReason: null,
      },
    });
    expect(repository.listReturns).toHaveBeenCalledWith({
      orgId,
      period: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
    });
    expect(repository.listAIUsage).toHaveBeenCalledWith({
      orgId,
      period: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
    });
  });

  it('loads a ready onboarding view with progress and action state', async () => {
    const result = await loadSaaSOnboardingView({
      getContext: vi.fn(async () => buildContext()),
      repository: createRepository(),
      now: new Date('2026-05-26T10:00:00.000Z'),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        summary: {
          totalSteps: 6,
          completedSteps: 5,
          currentStepId: 'complete',
        },
        actions: {
          canComplete: true,
        },
      },
      context: {
        orgId,
        role: 'owner',
        plan: 'growth',
      },
    });
  });

  it('disables completion for viewers while still returning read-only progress', async () => {
    const result = await loadSaaSOnboardingView({
      getContext: vi.fn(async () => buildContext({ role: 'viewer' })),
      repository: createRepository(),
    });

    expect(result).toMatchObject({
      state: 'ready',
      data: {
        actions: {
          canComplete: false,
          disabledReason: 'Owner or admin role is required to complete onboarding.',
        },
      },
    });
  });

  it('returns empty state instead of serving fake onboarding data when org is missing', async () => {
    const result = await loadSaaSOnboardingView({
      getContext: vi.fn(async () => buildContext()),
      repository: createRepository({
        getOrganization: vi.fn(async () => null),
      }),
    });

    expect(result).toEqual({
      state: 'empty',
      data: null,
      message: 'No onboarding data was found for this organization.',
      context: {
        orgId,
        role: 'owner',
        plan: 'growth',
        orgStatus: 'active',
      },
    });
  });

  it('maps auth context errors to gated states before querying repositories', async () => {
    const repository = createRepository();
    const result = await loadSaaSOnboardingView({
      getContext: vi.fn(async () => {
        throw new SaaSOrgContextError(
          'membership_required',
          403,
          'A SaaS organization membership is required for this action.'
        );
      }),
      repository,
    });

    expect(result).toEqual({
      state: 'gated',
      data: null,
      gated: {
        reason: 'role_required',
        message: 'A SaaS organization membership is required for this action.',
      },
    });
    expect(repository.getOrganization).not.toHaveBeenCalled();
  });

  it('maps repository failures to error state', async () => {
    const result = await loadSaaSOnboardingView({
      getContext: vi.fn(async () => buildContext()),
      repository: createRepository({
        hasReturnPolicy: vi.fn(async () => {
          throw new Error('policy query failed');
        }),
      }),
    });

    expect(result).toEqual({
      state: 'error',
      data: null,
      message: 'policy query failed',
    });
  });

  it('builds month boundaries in UTC', () => {
    expect(buildOnboardingUsagePeriod(new Date('2026-05-31T23:59:59.000Z'))).toEqual({
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
    });
  });
});
