import { describe, expect, it } from 'vitest';

import { isPermanentManualAccess } from '@/lib/saas/permanent-manual-access';

describe('isPermanentManualAccess', () => {
  it('recognizes an active manual subscription without an expiry date', () => {
    expect(isPermanentManualAccess({
      orgStatus: 'active',
      subscriptionProvider: 'manual',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    })).toBe(true);
  });

  it.each([
    ['trialing', 'manual', null, false],
    ['active', 'ecpay', null, false],
    ['active', 'manual', '2026-08-28T00:00:00.000Z', false],
    ['active', 'manual', null, true],
  ])(
    'does not label fixed-term or non-manual access as permanent',
    (orgStatus, subscriptionProvider, currentPeriodEnd, cancelAtPeriodEnd) => {
      expect(isPermanentManualAccess({
        orgStatus,
        subscriptionProvider,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      })).toBe(false);
    }
  );
});
