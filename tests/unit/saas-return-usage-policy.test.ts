import { describe, expect, it } from 'vitest';

import {
  resolveSaaSReturnUpgradeSuggestion,
  resolveSaaSReturnUsagePolicy,
} from '@/lib/saas/return-usage-policy';

describe('SaaS return usage policy', () => {
  it('does not warn below 80 percent of the soft limit', () => {
    const policy = resolveSaaSReturnUsagePolicy({
      used: 399,
      monthlyReturnSoftLimit: 500,
    });

    expect(policy).toMatchObject({
      warningType: null,
      isOverSoftLimit: false,
      shouldBlockOperations: false,
    });
    expect(policy.usageRatio).toBeCloseTo(0.798);
  });

  it('warns at the rounded-up 80 percent threshold', () => {
    expect(
      resolveSaaSReturnUsagePolicy({
        used: 401,
        monthlyReturnSoftLimit: 501,
      })
    ).toMatchObject({
      warningType: 'returns_80',
      isOverSoftLimit: false,
      shouldBlockOperations: false,
    });
  });

  it('marks 100 percent soft-limit usage without blocking operations', () => {
    const policy = resolveSaaSReturnUsagePolicy({
      used: 500,
      monthlyReturnSoftLimit: 500,
    });

    expect(policy).toMatchObject({
      warningType: 'returns_100',
      isOverSoftLimit: true,
      shouldBlockOperations: false,
    });
    expect(policy.usageRatio).toBe(1);
  });

  it('treats null limits as unlimited enterprise usage', () => {
    expect(
      resolveSaaSReturnUsagePolicy({
        used: 999999,
        monthlyReturnSoftLimit: null,
      })
    ).toEqual({
      used: 999999,
      monthlyReturnSoftLimit: null,
      usageRatio: null,
      warningType: null,
      isOverSoftLimit: false,
      shouldBlockOperations: false,
    });
  });

  it('rejects invalid negative usage values', () => {
    expect(() =>
      resolveSaaSReturnUsagePolicy({
        used: -1,
        monthlyReturnSoftLimit: 500,
      })
    ).toThrow('Invalid non-negative integer for returnUsage.used');
  });

  it('suggests upgrade after two consecutive over-limit months', () => {
    expect(
      resolveSaaSReturnUpgradeSuggestion({
        currentMonthOverLimit: true,
        previousMonthOverLimit: true,
        now: '2026-05-21T12:00:00.000Z',
      })
    ).toEqual({
      shouldSuggestUpgrade: true,
      suggestedAt: '2026-05-21T12:00:00.000Z',
      reason: 'consecutive_overage',
    });
  });

  it('does not repeat an already recorded upgrade suggestion', () => {
    expect(
      resolveSaaSReturnUpgradeSuggestion({
        currentMonthOverLimit: true,
        previousMonthOverLimit: true,
        alreadySuggestedAt: '2026-05-01T00:00:00.000Z',
      })
    ).toEqual({
      shouldSuggestUpgrade: false,
      suggestedAt: '2026-05-01T00:00:00.000Z',
      reason: 'already_suggested',
    });
  });

  it('does not suggest upgrade for one-month overage', () => {
    expect(
      resolveSaaSReturnUpgradeSuggestion({
        currentMonthOverLimit: true,
        previousMonthOverLimit: false,
      })
    ).toEqual({
      shouldSuggestUpgrade: false,
      suggestedAt: null,
      reason: 'not_consecutive',
    });
  });
});
