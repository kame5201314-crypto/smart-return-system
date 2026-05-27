import { describe, expect, it } from 'vitest';

import { ADMIN_UUID } from '@/lib/auth/admin-session';
import {
  isExplicitPlatformAdminPrincipal,
  isInternalAdminSessionPrincipal,
} from '@/lib/auth/platform-admin-identity';

describe('platform admin identity separation', () => {
  it('accepts the internal admin session principal', () => {
    expect(isInternalAdminSessionPrincipal(ADMIN_UUID)).toBe(true);
    expect(isExplicitPlatformAdminPrincipal({ userId: ADMIN_UUID, env: {} })).toBe(true);
  });

  it('accepts explicit ADMIN_EMAIL and email-style ADMIN_USERNAME aliases', () => {
    expect(
      isExplicitPlatformAdminPrincipal({
        userEmail: 'owner@smart-return.test',
        env: {
          ADMIN_EMAIL: 'owner@smart-return.test',
        },
      })
    ).toBe(true);

    expect(
      isExplicitPlatformAdminPrincipal({
        userEmail: 'ops@smart-return.test',
        env: {
          ADMIN_USERNAME: 'ops@smart-return.test',
        },
      })
    ).toBe(true);
  });

  it('does not treat the placeholder admin@example.com alias as a Supabase platform principal', () => {
    expect(
      isExplicitPlatformAdminPrincipal({
        userEmail: 'admin@example.com',
        env: {
          ADMIN_EMAIL: 'admin@example.com',
        },
      })
    ).toBe(false);
  });

  it('accepts valid PLATFORM_ADMIN_ROLES mappings by email or user id', () => {
    const env = {
      PLATFORM_ADMIN_ROLES: 'support@example.com=support, billing-user=billing',
    };

    expect(
      isExplicitPlatformAdminPrincipal({
        userEmail: 'support@example.com',
        env,
      })
    ).toBe(true);
    expect(
      isExplicitPlatformAdminPrincipal({
        userId: 'billing-user',
        env,
      })
    ).toBe(true);
  });

  it('rejects tenant or legacy profile admins unless they are explicitly allowlisted', () => {
    expect(
      isExplicitPlatformAdminPrincipal({
        userId: 'tenant-admin-user',
        userEmail: 'tenant-admin@example.com',
        env: {},
      })
    ).toBe(false);
  });

  it('does not treat invalid role mappings as platform admin access', () => {
    expect(
      isExplicitPlatformAdminPrincipal({
        userEmail: 'bad@example.com',
        env: {
          PLATFORM_ADMIN_ROLES: 'bad@example.com=superuser',
        },
      })
    ).toBe(false);
  });
});
