import { describe, expect, it } from 'vitest';

import {
  canCreateSaaSData,
  canExportSaaSData,
  canUseSaaSAI,
  getSaaSSubscriptionAccessPolicy,
  normalizeSaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';

describe('SaaS subscription access policy', () => {
  it('allows trialing and active organizations to use the core product', () => {
    for (const status of ['trialing', 'active']) {
      expect(getSaaSSubscriptionAccessPolicy(status)).toEqual({
        canLogin: true,
        canViewData: true,
        canCreateData: true,
        canUseAI: true,
        canExport: true,
        canManageBilling: true,
      });
    }
  });

  it('keeps past_due read-only while billing recovery remains available', () => {
    expect(getSaaSSubscriptionAccessPolicy('past_due')).toEqual({
      canLogin: true,
      canViewData: true,
      canCreateData: false,
      canUseAI: false,
      canExport: false,
      canManageBilling: true,
    });
    expect(canCreateSaaSData('past_due')).toBe(false);
    expect(canUseSaaSAI('past_due')).toBe(false);
    expect(canExportSaaSData('past_due')).toBe(false);
  });

  it('keeps suspended and cancelled organizations read-only', () => {
    for (const status of ['suspended', 'cancelled']) {
      expect(getSaaSSubscriptionAccessPolicy(status)).toMatchObject({
        canLogin: true,
        canViewData: true,
        canCreateData: false,
        canUseAI: false,
        canExport: false,
        canManageBilling: true,
      });
    }
  });

  it('normalizes unknown statuses to suspended', () => {
    expect(normalizeSaaSSubscriptionStatus(' ACTIVE ')).toBe('active');
    expect(normalizeSaaSSubscriptionStatus('unexpected')).toBe('suspended');
    expect(getSaaSSubscriptionAccessPolicy(null)).toEqual(
      getSaaSSubscriptionAccessPolicy('suspended')
    );
  });
});
