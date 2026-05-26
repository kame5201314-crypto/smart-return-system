import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_POST_LOGIN_PATH,
  getPostLoginRedirect,
  isPlatformAdminProfileRole,
  PLATFORM_ADMIN_POST_LOGIN_PATH,
} from '@/lib/auth/post-login-redirect';

describe('post-login redirect policy', () => {
  it('routes the internal admin session to the platform console', () => {
    expect(getPostLoginRedirect({ isAdmin: true })).toBe(PLATFORM_ADMIN_POST_LOGIN_PATH);
  });

  it('routes Supabase users with the platform admin profile role to the platform console', () => {
    expect(getPostLoginRedirect({ profileRole: 'admin' })).toBe(PLATFORM_ADMIN_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({ profileRole: ' ADMIN ' })).toBe(PLATFORM_ADMIN_POST_LOGIN_PATH);
  });

  it('honors safe internal next paths for platform admins', () => {
    expect(getPostLoginRedirect({
      isAdmin: true,
      requestedPath: '/internal/orgs',
    })).toBe('/internal/orgs');
  });

  it('routes merchant users to the merchant analytics workspace', () => {
    expect(getPostLoginRedirect()).toBe(CUSTOMER_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({ isAdmin: false, profileRole: 'owner' })).toBe(CUSTOMER_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({ profileRole: 'staff' })).toBe(CUSTOMER_POST_LOGIN_PATH);
  });

  it('rejects unsafe or unauthorized next paths', () => {
    expect(getPostLoginRedirect({
      isAdmin: true,
      requestedPath: 'https://example.com/internal',
    })).toBe(PLATFORM_ADMIN_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({
      isAdmin: true,
      requestedPath: '//example.com',
    })).toBe(PLATFORM_ADMIN_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({
      profileRole: 'owner',
      requestedPath: '/internal/orgs',
    })).toBe(CUSTOMER_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({
      isAdmin: true,
      requestedPath: '/internality',
    })).toBe(PLATFORM_ADMIN_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({
      profileRole: 'owner',
      requestedPath: '/returns',
    })).toBe('/returns');
  });

  it('keeps profile role matching narrow', () => {
    expect(isPlatformAdminProfileRole('admin')).toBe(true);
    expect(isPlatformAdminProfileRole('org_admin')).toBe(false);
    expect(isPlatformAdminProfileRole(null)).toBe(false);
  });
});
