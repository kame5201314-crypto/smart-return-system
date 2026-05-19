import { describe, expect, it } from 'vitest';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import {
  getOrgAIUsageLimit,
  getSaaSPlanDefinition,
  SAAS_PLAN_DEFINITIONS,
} from '@/lib/config/saas-plans';

describe('SaaS commercial configuration', () => {
  it('defines the approved plan prices and AI limits', () => {
    expect(SAAS_PLAN_DEFINITIONS.basic).toMatchObject({
      monthlyPriceTwd: 1490,
      aiMonthlyLimit: 5,
    });
    expect(SAAS_PLAN_DEFINITIONS.growth).toMatchObject({
      monthlyPriceTwd: 2990,
      aiMonthlyLimit: 30,
    });
    expect(SAAS_PLAN_DEFINITIONS.pro).toMatchObject({
      monthlyPriceTwd: 7990,
      aiMonthlyLimit: 100,
    });
    expect(SAAS_PLAN_DEFINITIONS.enterprise).toMatchObject({
      monthlyPriceTwd: null,
      aiMonthlyLimit: null,
      billingRequired: false,
    });
  });

  it('resolves AI quota from org.plan instead of APP_MODE', () => {
    expect(getOrgAIUsageLimit({ plan: 'basic' })).toBe(5);
    expect(getOrgAIUsageLimit({ plan: 'growth' })).toBe(30);
    expect(getOrgAIUsageLimit({ plan: 'pro' })).toBe(100);
    expect(getOrgAIUsageLimit({ plan: 'enterprise' })).toBeNull();
  });

  it('falls back to the Basic plan for unknown plan values', () => {
    expect(getSaaSPlanDefinition('unknown')).toBe(SAAS_PLAN_DEFINITIONS.basic);
  });

  it('keeps risky SaaS feature flags closed by default', () => {
    expect(resolveSaaSFeatureFlags({ env: {}, orgPlan: 'basic' })).toMatchObject({
      public_signup: false,
      billing: false,
      subscription_plan: false,
      ai_usage_limit: true,
      advanced_analytics: false,
      multi_tenant_admin: false,
      image_ai: false,
    });
  });

  it('allows org flags but still gates advanced features by plan', () => {
    expect(
      resolveSaaSFeatureFlags({
        env: {},
        orgPlan: 'growth',
        orgFeatureFlags: {
          advanced_analytics: true,
          multi_tenant_admin: true,
          billing: true,
        },
      })
    ).toMatchObject({
      billing: true,
      advanced_analytics: false,
      multi_tenant_admin: false,
    });

    expect(
      resolveSaaSFeatureFlags({
        env: {},
        orgPlan: 'enterprise',
        orgFeatureFlags: {
          advanced_analytics: true,
          multi_tenant_admin: true,
        },
      })
    ).toMatchObject({
      advanced_analytics: true,
      multi_tenant_admin: true,
    });
  });
});
