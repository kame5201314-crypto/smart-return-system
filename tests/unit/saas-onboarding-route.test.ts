/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleCompleteSaaSOnboardingRequest } from '@/app/api/saas/onboarding/complete/route';
import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import { SaaSOrgContextError, type SaaSOrgContext } from '@/lib/saas/org-context';
import {
  completeSaaSOnboardingFromRequest,
  type SaaSOnboardingRouteDependencies,
} from '@/lib/saas/onboarding-route';

const orgId = '11111111-1111-4111-8111-111111111111';
const actorUserId = '22222222-2222-4222-8222-222222222222';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/onboarding/complete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

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
      google_auth_ui: false,
      google_trial_signup: false,
      email_otp_signup: false,
      phone_otp_signup: false,
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

function createDeps(
  overrides: Partial<SaaSOnboardingRouteDependencies> = {}
): SaaSOnboardingRouteDependencies {
  return {
    getContext: vi.fn(async () => buildContext()),
    repository: {
      completeOnboarding: vi.fn(async (input) => ({
        orgId: input.orgId,
        onboardingCompletedAt: input.completedAt,
        auditLogId: '33333333-3333-4333-8333-333333333333',
      })),
    },
    now: new Date('2026-05-26T08:00:00.000Z'),
    ...overrides,
  };
}

describe('SaaS onboarding completion API foundation', () => {
  it('completes onboarding for owner/admin writable org context', async () => {
    const deps = createDeps();

    const response = await handleCompleteSaaSOnboardingRequest(
      buildRequest({
        completedAt: '2026-05-26T09:30:00.000Z',
        metadata: {
          source: 'onboarding_checklist',
        },
      }),
      deps
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        orgId,
        onboardingCompletedAt: '2026-05-26T09:30:00.000Z',
        auditLogId: '33333333-3333-4333-8333-333333333333',
      },
    });
    expect(deps.getContext).toHaveBeenCalledWith({
      requirements: {
        roles: ['owner', 'admin'],
        writable: true,
      },
    });
    expect(deps.repository?.completeOnboarding).toHaveBeenCalledWith({
      orgId,
      actorUserId,
      completedAt: '2026-05-26T09:30:00.000Z',
      metadata: {
        source: 'onboarding_checklist',
      },
    });
  });

  it('blocks unauthenticated or non-member requests before repository writes', async () => {
    const deps = createDeps({
      getContext: vi.fn(async () => {
        throw new SaaSOrgContextError(
          'membership_required',
          403,
          'A SaaS organization membership is required for this action.'
        );
      }),
    });

    const response = await handleCompleteSaaSOnboardingRequest(buildRequest({}), deps);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'membership_required',
    });
    expect(deps.repository?.completeOnboarding).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON request bodies', async () => {
    const deps = createDeps();
    const response = await handleCompleteSaaSOnboardingRequest(
      new NextRequest('http://localhost/api/saas/onboarding/complete', {
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
    expect(deps.repository?.completeOnboarding).not.toHaveBeenCalled();
  });

  it('keeps service-level role and subscription guards in the route use-case', async () => {
    const repository = {
      completeOnboarding: vi.fn(),
    };
    const deps = createDeps({
      getContext: vi.fn(async () =>
        buildContext({
          role: 'viewer',
        })
      ),
      repository,
    });

    await expect(completeSaaSOnboardingFromRequest({}, deps)).rejects.toMatchObject({
      code: 'role_forbidden',
      status: 403,
    });
    expect(repository.completeOnboarding).not.toHaveBeenCalled();
  });
});
