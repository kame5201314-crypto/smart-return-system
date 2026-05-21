import { describe, expect, it } from 'vitest';

import {
  canInviteSaaSTeamMember,
  resolveSaaSTeamSeatUsage,
} from '@/lib/saas/team-limits';

describe('SaaS team seat limits', () => {
  it('counts active members and pending invites as reserved seats', () => {
    expect(
      resolveSaaSTeamSeatUsage({
        seatLimit: 3,
        activeMemberCount: 2,
        pendingInviteCount: 1,
      })
    ).toEqual({
      seatLimit: 3,
      activeMemberCount: 2,
      pendingInviteCount: 1,
      reservedSeatCount: 3,
      remainingSeats: 0,
      isFull: true,
    });
  });

  it('leaves enterprise teams unlimited when seatLimit is null', () => {
    expect(
      resolveSaaSTeamSeatUsage({
        seatLimit: null,
        activeMemberCount: 100,
        pendingInviteCount: 50,
      })
    ).toMatchObject({
      remainingSeats: null,
      isFull: false,
    });
  });

  it('decides invite availability from the resolved usage', () => {
    expect(
      canInviteSaaSTeamMember({
        seatLimit: 10,
        activeMemberCount: 9,
        pendingInviteCount: 0,
      })
    ).toBe(true);
    expect(
      canInviteSaaSTeamMember({
        seatLimit: 10,
        activeMemberCount: 9,
        pendingInviteCount: 1,
      })
    ).toBe(false);
  });

  it('rejects invalid negative counts', () => {
    expect(() =>
      resolveSaaSTeamSeatUsage({
        seatLimit: 3,
        activeMemberCount: -1,
      })
    ).toThrow('activeMemberCount must be a non-negative integer.');
  });
});
