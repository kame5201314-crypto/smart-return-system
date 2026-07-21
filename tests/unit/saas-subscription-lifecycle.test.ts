import { describe, expect, it } from 'vitest';

import {
  PAST_DUE_GRACE_DAYS,
  SUSPENDED_RETENTION_DAYS,
  resolveSaaSSubscriptionTimedStatus,
} from '@/lib/saas/subscription-lifecycle';

const now = '2026-05-21T00:00:00.000Z';

describe('SaaS subscription lifecycle timing', () => {
  it('fails closed when a trial expiry is missing', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'trialing',
        now,
        trialEnd: null,
      })
    ).toMatchObject({
      currentStatus: 'trialing',
      nextStatus: 'suspended',
      reason: 'trial_expiry_unavailable',
      changed: true,
    });
  });

  it('suspends unpaid trials when the trial end has passed', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'trialing',
        now,
        trialEnd: '2026-05-20T23:59:59.000Z',
      })
    ).toMatchObject({
      currentStatus: 'trialing',
      nextStatus: 'suspended',
      reason: 'trial_expired',
      changed: true,
    });
  });

  it('cancels recurring subscriptions at period end when cancelAtPeriodEnd is true', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: now,
        cancelAtPeriodEnd: true,
      })
    ).toMatchObject({
      nextStatus: 'cancelled',
      reason: 'cancelled_at_period_end',
    });
  });

  it('suspends prepaid subscriptions as soon as their paid period ends', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: now,
        cancelAtPeriodEnd: false,
      })
    ).toMatchObject({
      currentStatus: 'active',
      nextStatus: 'suspended',
      reason: 'prepaid_period_expired',
      changed: true,
    });
  });

  it('keeps active subscriptions open before the period end or without a legacy period', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: '2026-05-21T00:00:00.001Z',
        cancelAtPeriodEnd: false,
      })
    ).toMatchObject({ nextStatus: 'active', reason: 'unchanged', changed: false });

    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      })
    ).toMatchObject({ nextStatus: 'active', reason: 'unchanged', changed: false });
  });

  it('fails closed when an active subscription has a non-empty invalid period end', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: 'not-a-date',
        cancelAtPeriodEnd: false,
      })
    ).toMatchObject({
      nextStatus: 'suspended',
      reason: 'prepaid_period_expiry_unavailable',
      changed: true,
    });
  });

  it('requires a period end for fixed-term providers and suspends them consistently', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: null,
        requiresCurrentPeriodEnd: true,
      })
    ).toMatchObject({
      nextStatus: 'suspended',
      reason: 'prepaid_period_expiry_unavailable',
    });

    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: now,
        cancelAtPeriodEnd: true,
        requiresCurrentPeriodEnd: true,
      })
    ).toMatchObject({
      nextStatus: 'suspended',
      reason: 'prepaid_period_expired',
    });
  });

  it('keeps past_due subscriptions open during the 7 day grace period', () => {
    expect(PAST_DUE_GRACE_DAYS).toBe(7);
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'past_due',
        now,
        pastDueSince: '2026-05-14T00:00:01.000Z',
      })
    ).toMatchObject({
      nextStatus: 'past_due',
      reason: 'unchanged',
    });
  });

  it('suspends past_due subscriptions after the 7 day grace period', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'past_due',
        now,
        pastDueSince: '2026-05-14T00:00:00.000Z',
      })
    ).toMatchObject({
      currentStatus: 'past_due',
      nextStatus: 'suspended',
      reason: 'past_due_grace_expired',
      changed: true,
    });
  });

  it('uses currentPeriodEnd as the past_due grace anchor when pastDueSince is missing', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'past_due',
        now,
        currentPeriodEnd: '2026-05-14T00:00:00.000Z',
      })
    ).toMatchObject({
      nextStatus: 'suspended',
      reason: 'past_due_grace_expired',
    });
  });

  it('cancels suspended subscriptions after the 30 day retention window', () => {
    expect(SUSPENDED_RETENTION_DAYS).toBe(30);
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'suspended',
        now,
        suspendedAt: '2026-04-21T00:00:00.000Z',
      })
    ).toMatchObject({
      currentStatus: 'suspended',
      nextStatus: 'cancelled',
      reason: 'suspended_retention_expired',
      changed: true,
    });
  });

  it('keeps cancelled subscriptions terminal', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'cancelled',
        now,
        suspendedAt: '2026-01-01T00:00:00.000Z',
      })
    ).toMatchObject({
      currentStatus: 'cancelled',
      nextStatus: 'cancelled',
      reason: 'unchanged',
      changed: false,
    });
  });
});
