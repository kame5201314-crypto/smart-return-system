import { describe, expect, it } from 'vitest';

import {
  canCreateSaaSData,
  canExportSaaSData,
  canUseSaaSAI,
  getSaaSSubscriptionAccessPolicy,
  normalizeSaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';
import { resolveSaaSSubscriptionTimedStatus } from '@/lib/saas/subscription-lifecycle';

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

  it('keeps an expired trial readable while blocking create, AI, and export operations', () => {
    const expiry = resolveSaaSSubscriptionTimedStatus({
      status: 'trialing',
      trialEnd: '2026-07-14T23:59:59.000Z',
      now: '2026-07-15T00:00:00.000Z',
    });

    expect(expiry).toMatchObject({
      changed: true,
      nextStatus: 'suspended',
      reason: 'trial_expired',
    });
    expect(getSaaSSubscriptionAccessPolicy(expiry.nextStatus)).toEqual({
      canLogin: true,
      canViewData: true,
      canCreateData: false,
      canUseAI: false,
      canExport: false,
      canManageBilling: true,
    });
    expect(canCreateSaaSData(expiry.nextStatus)).toBe(false);
    expect(canUseSaaSAI(expiry.nextStatus)).toBe(false);
    expect(canExportSaaSData(expiry.nextStatus)).toBe(false);
  });

  it('keeps an expired prepaid period readable while blocking create, AI, and export operations', () => {
    const expiry = resolveSaaSSubscriptionTimedStatus({
      status: 'active',
      currentPeriodEnd: '2026-07-15T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      now: '2026-07-15T00:00:00.000Z',
    });

    expect(expiry).toMatchObject({
      changed: true,
      nextStatus: 'suspended',
      reason: 'prepaid_period_expired',
    });
    expect(canCreateSaaSData(expiry.nextStatus)).toBe(false);
    expect(canUseSaaSAI(expiry.nextStatus)).toBe(false);
    expect(canExportSaaSData(expiry.nextStatus)).toBe(false);
  });

  it('normalizes unknown statuses to suspended', () => {
    expect(normalizeSaaSSubscriptionStatus(' ACTIVE ')).toBe('active');
    expect(normalizeSaaSSubscriptionStatus('unexpected')).toBe('suspended');
    expect(getSaaSSubscriptionAccessPolicy(null)).toEqual(
      getSaaSSubscriptionAccessPolicy('suspended')
    );
  });
});
