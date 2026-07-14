/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import {
  buildCompleteSaaSOnboardingRpcArgs,
  buildSaaSOnboardingView,
  completeSaaSOnboarding,
  createSaaSOnboardingRepository,
  normalizeSaaSOnboardingCompletionRequest,
  SaaSOnboardingError,
  type SaaSOnboardingRepository,
} from '@/lib/saas/onboarding';
import type { SaaSOrgContext } from '@/lib/saas/org-context';

const orgId = '11111111-1111-4111-8111-111111111111';
const actorUserId = '22222222-2222-4222-8222-222222222222';

function buildContext(overrides: Partial<SaaSOrgContext> = {}): SaaSOrgContext {
  return {
    userId: actorUserId,
    orgId,
    orgName: 'Demo Store',
    orgSlug: 'demo-store',
    orgStatus: 'active',
    role: 'owner',
    plan: 'growth',
    planDefinition: getSaaSPlanDefinition('growth'),
    featureFlags: {
      public_signup: false,
      public_lead_capture: false,
      google_auth: false,
      google_trial_signup: false,
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

function createRepository(): SaaSOnboardingRepository {
  return {
    completeOnboarding: vi.fn(async (input) => ({
      orgId: input.orgId,
      onboardingCompletedAt: input.completedAt,
      auditLogId: '33333333-3333-4333-8333-333333333333',
    })),
  };
}

describe('SaaS onboarding backend foundation', () => {
  it('builds onboarding progress with current, pending, and completion states', () => {
    const view = buildSaaSOnboardingView({
      org: {
        id: orgId,
        name: 'Demo Store',
        onboardingCompletedAt: null,
      },
      signals: {
        returnPolicyConfigured: true,
        memberCount: 1,
        pendingInviteCount: 1,
        returnCount: 0,
        aiUsageCount: 0,
      },
      actions: {
        canComplete: true,
      },
    });

    expect(view.summary).toMatchObject({
      totalSteps: 6,
      completedSteps: 3,
      percentComplete: 50,
      currentStepId: 'first_return',
    });
    expect(view.steps.map((step) => [step.id, step.status])).toEqual([
      ['organization_profile', 'complete'],
      ['return_policy', 'complete'],
      ['team_setup', 'complete'],
      ['first_return', 'current'],
      ['ai_review', 'pending'],
      ['complete', 'pending'],
    ]);
    expect(view.actions).toMatchObject({
      canComplete: false,
      disabledReason: 'Complete the required onboarding steps first.',
    });
  });

  it('allows completion only when all required onboarding signals are complete', () => {
    const view = buildSaaSOnboardingView({
      org: {
        id: orgId,
        name: 'Demo Store',
        onboardingCompletedAt: null,
      },
      signals: {
        returnPolicyConfigured: true,
        memberCount: 2,
        pendingInviteCount: 0,
        returnCount: 1,
        aiUsageCount: 1,
      },
      actions: {
        canComplete: true,
      },
    });

    expect(view.summary).toMatchObject({
      completedSteps: 5,
      currentStepId: 'complete',
    });
    expect(view.steps.at(-1)).toMatchObject({
      id: 'complete',
      status: 'current',
      complete: false,
    });
    expect(view.actions).toEqual({
      canComplete: true,
    });
  });

  it('normalizes completion requests and maps them to RPC args', () => {
    const input = normalizeSaaSOnboardingCompletionRequest(
      {
        completedAt: '2026-05-25T04:00:00.000Z',
        metadata: {
          source: 'onboarding_checklist',
        },
      },
      buildContext(),
      new Date('2026-05-25T00:00:00.000Z')
    );

    expect(input).toEqual({
      orgId,
      actorUserId,
      completedAt: '2026-05-25T04:00:00.000Z',
      metadata: {
        source: 'onboarding_checklist',
      },
    });
    expect(buildCompleteSaaSOnboardingRpcArgs(input)).toEqual({
      p_org_id: orgId,
      p_actor_user_id: actorUserId,
      p_completed_at: '2026-05-25T04:00:00.000Z',
      p_metadata: {
        source: 'onboarding_checklist',
      },
    });
  });

  it('blocks viewer and inactive subscription contexts before repository writes', async () => {
    const repository = createRepository();

    await expect(
      completeSaaSOnboarding(
        {},
        {
          context: buildContext({ role: 'viewer' }),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'role_forbidden',
      status: 403,
    });

    await expect(
      completeSaaSOnboarding(
        {},
        {
          context: buildContext({ orgStatus: 'past_due' }),
          repository,
        }
      )
    ).rejects.toMatchObject({
      code: 'subscription_inactive',
      status: 402,
    });

    expect(repository.completeOnboarding).not.toHaveBeenCalled();
  });

  it('completes onboarding through the injected repository for owner/admin contexts', async () => {
    const repository = createRepository();
    const result = await completeSaaSOnboarding(
      {
        completedAt: '2026-05-25T04:00:00.000Z',
      },
      {
        context: buildContext({ role: 'admin' }),
        repository,
      }
    );

    expect(result).toEqual({
      orgId,
      onboardingCompletedAt: '2026-05-25T04:00:00.000Z',
      auditLogId: '33333333-3333-4333-8333-333333333333',
    });
    expect(repository.completeOnboarding).toHaveBeenCalledWith({
      orgId,
      actorUserId,
      completedAt: '2026-05-25T04:00:00.000Z',
      metadata: {},
    });
  });

  it('persists completion through the Supabase RPC wrapper', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        org_id: orgId,
        onboarding_completed_at: '2026-05-25T04:00:00.000Z',
        audit_log_id: '33333333-3333-4333-8333-333333333333',
      },
      error: null,
    }));
    const repository = createSaaSOnboardingRepository({ rpc });

    await expect(
      repository.completeOnboarding({
        orgId,
        actorUserId,
        completedAt: '2026-05-25T04:00:00.000Z',
        metadata: {},
      })
    ).resolves.toEqual({
      orgId,
      onboardingCompletedAt: '2026-05-25T04:00:00.000Z',
      auditLogId: '33333333-3333-4333-8333-333333333333',
    });
    expect(rpc).toHaveBeenCalledWith('complete_organization_onboarding', {
      p_org_id: orgId,
      p_actor_user_id: actorUserId,
      p_completed_at: '2026-05-25T04:00:00.000Z',
      p_metadata: {},
    });
  });

  it('surfaces RPC failures as onboarding operation errors', async () => {
    const repository = createSaaSOnboardingRepository({
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          message: 'function complete_organization_onboarding does not exist',
        },
      })),
    });

    await expect(
      repository.completeOnboarding({
        orgId,
        actorUserId,
        completedAt: '2026-05-25T04:00:00.000Z',
        metadata: {},
      })
    ).rejects.toBeInstanceOf(SaaSOnboardingError);
  });
});
