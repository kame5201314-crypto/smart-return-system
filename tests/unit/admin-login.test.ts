import { describe, expect, it } from 'vitest';

import { getAdminLoginIds, getConfiguredAdminUsername, isAdminLoginId } from '@/lib/auth/admin-login';

describe('admin login aliases', () => {
  it('accepts the configured username and the default email-style admin alias', () => {
    const env = {
      ADMIN_USERNAME: 'admin',
    };

    expect(getConfiguredAdminUsername(env)).toBe('admin');
    expect(getAdminLoginIds(env)).toEqual(['admin', 'admin@example.com']);
    expect(isAdminLoginId('admin', env)).toBe(true);
    expect(isAdminLoginId('admin@example.com', env)).toBe(true);
  });

  it('normalizes whitespace and casing', () => {
    const env = {
      ADMIN_USERNAME: ' PlatformAdmin ',
    };

    expect(isAdminLoginId('platformadmin', env)).toBe(true);
    expect(isAdminLoginId('PlatformAdmin@example.com', env)).toBe(true);
  });

  it('accepts an explicit ADMIN_EMAIL alias', () => {
    const env = {
      ADMIN_USERNAME: 'admin',
      ADMIN_EMAIL: 'ops@example.com',
    };

    expect(getAdminLoginIds(env)).toEqual(['admin', 'ops@example.com', 'admin@example.com']);
    expect(isAdminLoginId('ops@example.com', env)).toBe(true);
  });

  it('does not synthesize an example alias when ADMIN_USERNAME is already an email', () => {
    const env = {
      ADMIN_USERNAME: 'owner@example.com',
    };

    expect(getAdminLoginIds(env)).toEqual(['owner@example.com']);
    expect(isAdminLoginId('owner@example.com', env)).toBe(true);
    expect(isAdminLoginId('owner@example.com@example.com', env)).toBe(false);
  });
});
