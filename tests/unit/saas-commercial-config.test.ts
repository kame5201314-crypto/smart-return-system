import { describe, expect, it } from 'vitest';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import {
  getOrgAIUsageLimit,
  getOrgMonthlyReturnSoftLimit,
  getOrgSeatLimit,
  getSaaSPlanDefinition,
  orgHasAdvancedAnalytics,
  orgHasApiAccess,
  SAAS_PLAN_DEFINITIONS,
} from '@/lib/config/saas-plans';

describe('SaaS commercial configuration', () => {
  it('defines the approved plan matrix', () => {
    expect(SAAS_PLAN_DEFINITIONS).toMatchInlineSnapshot(`
      {
        "basic": {
          "aiMonthlyLimit": 10,
          "billingRequired": true,
          "code": "basic",
          "hasAdvancedAnalytics": false,
          "hasApiAccess": false,
          "monthlyPriceTwd": 499,
          "monthlyReturnSoftLimit": 300,
          "name": "入門版",
          "seatLimit": 3,
        },
        "enterprise": {
          "aiMonthlyLimit": null,
          "billingRequired": false,
          "code": "enterprise",
          "hasAdvancedAnalytics": true,
          "hasApiAccess": true,
          "monthlyPriceTwd": null,
          "monthlyReturnSoftLimit": null,
          "name": "大量需求",
          "seatLimit": null,
        },
        "growth": {
          "aiMonthlyLimit": 25,
          "billingRequired": true,
          "code": "growth",
          "hasAdvancedAnalytics": true,
          "hasApiAccess": false,
          "monthlyPriceTwd": 699,
          "monthlyReturnSoftLimit": 800,
          "name": "成長版",
          "seatLimit": 5,
        },
      }
    `);
  });

  it('resolves quotas and commercial limits from org.plan instead of APP_MODE', () => {
    expect(getOrgAIUsageLimit({ plan: 'basic' })).toBe(10);
    expect(getOrgAIUsageLimit({ plan: 'growth' })).toBe(25);
    expect(getOrgAIUsageLimit({ plan: 'enterprise' })).toBeNull();
    expect(getOrgSeatLimit({ plan: 'basic' })).toBe(3);
    expect(getOrgSeatLimit({ plan: 'growth' })).toBe(5);
    expect(getOrgSeatLimit({ plan: 'enterprise' })).toBeNull();
    expect(getOrgMonthlyReturnSoftLimit({ plan: 'basic' })).toBe(300);
    expect(getOrgMonthlyReturnSoftLimit({ plan: 'growth' })).toBe(800);
    expect(getOrgMonthlyReturnSoftLimit({ plan: 'enterprise' })).toBeNull();
    expect(orgHasAdvancedAnalytics({ plan: 'growth' })).toBe(true);
    expect(orgHasApiAccess({ plan: 'growth' })).toBe(false);
    expect(orgHasApiAccess({ plan: 'enterprise' })).toBe(true);
  });

  it('falls back to the Basic plan for unknown plan values', () => {
    expect(getSaaSPlanDefinition('unknown')).toBe(SAAS_PLAN_DEFINITIONS.basic);
  });

  it('keeps risky SaaS feature flags closed by default', () => {
    expect(resolveSaaSFeatureFlags({ env: {}, orgPlan: 'basic' })).toMatchObject({
      public_signup: false,
      public_lead_capture: false,
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
        orgPlan: 'basic',
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
        orgPlan: 'growth',
        orgFeatureFlags: {
          advanced_analytics: true,
          multi_tenant_admin: true,
        },
      })
    ).toMatchObject({
      advanced_analytics: true,
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

  it('keeps ENABLE_IMAGE_AI=false as a global kill switch', () => {
    expect(
      resolveSaaSFeatureFlags({
        env: {
          ENABLE_IMAGE_AI: 'false',
        },
        orgPlan: 'growth',
        orgFeatureFlags: {
          image_ai: true,
        },
      })
    ).toMatchObject({
      image_ai: false,
    });
  });
});
