import { describe, expect, it } from 'vitest';

import {
  PAST_DUE_GRACE_DAYS,
  SUSPENDED_RETENTION_DAYS,
  resolveSaaSSubscriptionTimedStatus,
} from '@/lib/saas/subscription-lifecycle';

const now = '2026-05-21T00:00:00.000Z';

describe('SaaS subscription lifecycle timing', () => {
  it('keeps indefinite Beta trials open when trialEnd is missing', () => {
    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'trialing',
        now,
        trialEnd: null,
      })
    ).toMatchObject({
      currentStatus: 'trialing',
      nextStatus: 'trialing',
      reason: 'unchanged',
      changed: false,
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

  it('cancels active subscriptions at period end only when cancelAtPeriodEnd is true', () => {
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

    expect(
      resolveSaaSSubscriptionTimedStatus({
        status: 'active',
        now,
        currentPeriodEnd: now,
        cancelAtPeriodEnd: false,
      })
    ).toMatchObject({
      nextStatus: 'active',
      reason: 'unchanged',
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
