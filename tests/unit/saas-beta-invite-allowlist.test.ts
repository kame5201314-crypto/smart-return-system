import { describe, expect, it } from 'vitest';

import {
  getBetaInviteEmailAllowlist,
  isBetaInviteEmailAllowed,
  isInviteOnlyBetaEnabled,
} from '@/lib/saas/beta-invite-allowlist';

describe('closed Beta Email allowlist', () => {
  it('stays inactive unless the rollout switch is explicitly enabled', () => {
    expect(isInviteOnlyBetaEnabled({})).toBe(false);
    expect(isBetaInviteEmailAllowed('anyone@example.com', {})).toBe(true);
  });

  it('normalizes comma, semicolon, and newline separated invited emails', () => {
    const env = {
      ENABLE_INVITE_ONLY_BETA: 'true',
      SAAS_BETA_ALLOWED_EMAILS:
        ' Friend@One.Example,second@example.com;\n third@example.com ',
    };

    expect(getBetaInviteEmailAllowlist(env)).toEqual(new Set([
      'friend@one.example',
      'second@example.com',
      'third@example.com',
    ]));
    expect(isBetaInviteEmailAllowed('FRIEND@ONE.EXAMPLE', env)).toBe(true);
    expect(isBetaInviteEmailAllowed('other@example.com', env)).toBe(false);
  });

  it('fails closed for a malformed switch or an empty allowlist', () => {
    expect(isInviteOnlyBetaEnabled({ ENABLE_INVITE_ONLY_BETA: 'enabled-later' }))
      .toBe(true);
    expect(isBetaInviteEmailAllowed('friend@example.com', {
      ENABLE_INVITE_ONLY_BETA: 'enabled-later',
      SAAS_BETA_ALLOWED_EMAILS: '',
    })).toBe(false);
  });
});
