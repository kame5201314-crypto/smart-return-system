import { describe, expect, it, vi } from 'vitest';

import { getSaaSPlanDefinition } from '@/lib/config/saas-plans';
import {
  assertAIQuotaAvailable,
  buildCurrentAIUsageWindow,
  getMonthlyAIUsageCount,
  resolveAIQuotaDecision,
  SaaSAIQuotaError,
  shouldCountAIUsageEvent,
  type AIQuotaQueryClient,
  type AIQuotaQueryResult,
} from '@/lib/saas/ai-quota';
import type { SaaSOrgContext } from '@/lib/saas/org-context';

function buildContext(input: {
  plan: 'basic' | 'growth' | 'enterprise';
  aiUsageLimitEnabled?: boolean;
}): SaaSOrgContext {
  return {
    userId: 'user-1',
    orgId: 'org-1',
    orgName: 'Demo Org',
    orgSlug: 'demo-org',
    orgStatus: 'active',
    role: 'admin',
    plan: input.plan,
    planDefinition: getSaaSPlanDefinition(input.plan),
    featureFlags: {
      public_signup: false,
      billing: false,
      subscription_plan: false,
      ai_usage_limit: input.aiUsageLimitEnabled ?? true,
      advanced_analytics: false,
      multi_tenant_admin: false,
      image_ai: false,
    },
    isPlatformAdmin: false,
  };
}

function createQuotaClient(result: AIQuotaQueryResult) {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const builder = {
    select: vi.fn(function select(...args: unknown[]) {
      calls.push({ method: 'select', args });
      return builder;
    }),
    eq: vi.fn(function eq(...args: unknown[]) {
      calls.push({ method: 'eq', args });
      return builder;
    }),
    gte: vi.fn(function gte(...args: unknown[]) {
      calls.push({ method: 'gte', args });
      return builder;
    }),
    lt: vi.fn(function lt(...args: unknown[]) {
      calls.push({ method: 'lt', args });
      return builder;
    }),
    then: vi.fn((onfulfilled?: (value: AIQuotaQueryResult) => unknown) =>
      Promise.resolve(onfulfilled ? onfulfilled(result) : result)
    ),
  };

  return {
    calls,
    client: {
      from: vi.fn((table: string) => {
        calls.push({ method: 'from', args: [table] });
        return builder;
      }),
    } as AIQuotaQueryClient,
  };
}

describe('SaaS AI quota', () => {
  it('counts only non-cached successful AI usage events', () => {
    expect(shouldCountAIUsageEvent({ cached: false, success: true })).toBe(true);
    expect(shouldCountAIUsageEvent({ cached: true, success: true })).toBe(false);
    expect(shouldCountAIUsageEvent({ cached: false, success: false })).toBe(false);
  });

  it('builds the current monthly usage window in UTC', () => {
    expect(buildCurrentAIUsageWindow(new Date('2026-05-21T03:00:00.000Z'))).toEqual({
      periodStartIso: '2026-05-01T00:00:00.000Z',
      periodEndIso: '2026-06-01T00:00:00.000Z',
    });
  });

  it('allows usage when the org feature flag disables hard limits', () => {
    expect(
      resolveAIQuotaDecision({
        context: buildContext({ plan: 'basic', aiUsageLimitEnabled: false }),
        used: 999,
      })
    ).toMatchObject({
      allowed: true,
      limit: null,
      reason: 'feature_disabled',
    });
  });

  it('allows Enterprise unlimited usage and blocks Basic when the monthly limit is reached', () => {
    expect(
      resolveAIQuotaDecision({
        context: buildContext({ plan: 'enterprise' }),
        used: 999,
      })
    ).toMatchObject({
      allowed: true,
      limit: null,
      reason: 'unlimited',
    });

    expect(
      resolveAIQuotaDecision({
        context: buildContext({ plan: 'basic' }),
        used: 10,
      })
    ).toMatchObject({
      allowed: false,
      limit: 10,
      used: 10,
      remaining: 0,
      reason: 'limit_reached',
    });
  });

  it('loads monthly AI usage with org, feature, cache, success, and period filters', async () => {
    const window = buildCurrentAIUsageWindow(new Date('2026-05-21T03:00:00.000Z'));
    const { client, calls } = createQuotaClient({
      data: null,
      count: 4,
      error: null,
    });

    await expect(
      getMonthlyAIUsageCount({
        client,
        orgId: 'org-1',
        window,
      })
    ).resolves.toBe(4);

    expect(calls).toEqual([
      { method: 'from', args: ['ai_usage_events'] },
      { method: 'select', args: ['id', { count: 'exact', head: true }] },
      { method: 'eq', args: ['org_id', 'org-1'] },
      { method: 'eq', args: ['feature', 'return_ai_analysis'] },
      { method: 'eq', args: ['cached', false] },
      { method: 'eq', args: ['success', true] },
      { method: 'gte', args: ['created_at', '2026-05-01T00:00:00.000Z'] },
      { method: 'lt', args: ['created_at', '2026-06-01T00:00:00.000Z'] },
    ]);
  });

  it('throws a typed quota error when the current plan limit is exhausted', async () => {
    const { client } = createQuotaClient({
      data: null,
      count: 10,
      error: null,
    });

    await expect(
      assertAIQuotaAvailable({
        client,
        context: buildContext({ plan: 'basic' }),
      })
    ).rejects.toBeInstanceOf(SaaSAIQuotaError);
  });
});
