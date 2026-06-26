import { describe, expect, it } from 'vitest';

import {
  canAcceptSaaSInvite,
  isSaaSInviteRole,
  resolveSaaSInviteStatus,
} from '@/lib/saas/invite-policy';

describe('SaaS invite policy', () => {
  const now = new Date('2026-05-21T00:00:00.000Z');

  it('keeps unaccepted future invites pending', () => {
    expect(
      resolveSaaSInviteStatus({
        acceptedAt: null,
        expiresAt: '2026-05-28T00:00:00.000Z',
        now,
      })
    ).toBe('pending');
  });

  it('prioritizes revoked and accepted states before expiration', () => {
    expect(
      resolveSaaSInviteStatus({
        status: 'revoked',
        acceptedAt: null,
        expiresAt: '2026-05-28T00:00:00.000Z',
        now,
      })
    ).toBe('revoked');

    expect(
      resolveSaaSInviteStatus({
        status: 'accepted',
        acceptedAt: null,
        expiresAt: '2026-05-01T00:00:00.000Z',
        now,
      })
    ).toBe('accepted');

    expect(
      resolveSaaSInviteStatus({
        acceptedAt: '2026-05-20T00:00:00.000Z',
        expiresAt: '2026-05-01T00:00:00.000Z',
        now,
      })
    ).toBe('accepted');
  });

  it('expires invites at or after the expiration timestamp', () => {
    expect(
      resolveSaaSInviteStatus({
        status: 'expired',
        acceptedAt: null,
        expiresAt: '2026-05-28T00:00:00.000Z',
        now,
      })
    ).toBe('expired');

    expect(
      resolveSaaSInviteStatus({
        acceptedAt: null,
        expiresAt: '2026-05-21T00:00:00.000Z',
        now,
      })
    ).toBe('expired');
  });

  it('allows only admin, staff, and viewer invite roles to be accepted', () => {
    expect(isSaaSInviteRole('admin')).toBe(true);
    expect(isSaaSInviteRole('staff')).toBe(true);
    expect(isSaaSInviteRole('viewer')).toBe(true);
    expect(isSaaSInviteRole('owner')).toBe(false);

    expect(
      canAcceptSaaSInvite({
        role: 'staff',
        expiresAt: '2026-05-28T00:00:00.000Z',
        now,
      })
    ).toBe(true);
    expect(
      canAcceptSaaSInvite({
        role: 'owner',
        expiresAt: '2026-05-28T00:00:00.000Z',
        now,
      })
    ).toBe(false);
  });
});
