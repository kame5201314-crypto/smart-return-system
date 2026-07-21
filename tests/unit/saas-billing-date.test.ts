import { describe, expect, it } from 'vitest';

import {
  formatSaaSBillingDate,
  formatSaaSBillingDateTime,
  SAAS_BILLING_TIME_ZONE,
} from '@/lib/saas/billing-date';

describe('SaaS billing date formatting', () => {
  it('always renders dates in the Asia/Taipei business timezone', () => {
    expect(SAAS_BILLING_TIME_ZONE).toBe('Asia/Taipei');
    expect(formatSaaSBillingDate('2026-07-20T16:30:00.000Z')).toBe('2026/07/21');
  });

  it('renders the authoritative payment timestamp to the minute', () => {
    expect(formatSaaSBillingDateTime('2026-07-21T01:05:00.000Z')).toBe(
      '2026/07/21 09:05'
    );
  });

  it('fails closed to a neutral value for missing or invalid timestamps', () => {
    expect(formatSaaSBillingDate(null)).toBe('尚未設定');
    expect(formatSaaSBillingDateTime('not-a-date')).toBe('尚未設定');
  });
});
