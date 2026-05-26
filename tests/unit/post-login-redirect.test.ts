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

  it('routes merchant users to the merchant analytics workspace', () => {
    expect(getPostLoginRedirect()).toBe(CUSTOMER_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({ isAdmin: false, profileRole: 'owner' })).toBe(CUSTOMER_POST_LOGIN_PATH);
    expect(getPostLoginRedirect({ profileRole: 'staff' })).toBe(CUSTOMER_POST_LOGIN_PATH);
  });

  it('keeps profile role matching narrow', () => {
    expect(isPlatformAdminProfileRole('admin')).toBe(true);
    expect(isPlatformAdminProfileRole('org_admin')).toBe(false);
    expect(isPlatformAdminProfileRole(null)).toBe(false);
  });
});
