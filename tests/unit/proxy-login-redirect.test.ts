import { describe, expect, it } from 'vitest';

import {
  resolveAuthenticatedAdminEntryRedirect,
  resolveAuthenticatedLoginRedirect,
} from '@/lib/auth/proxy-login-redirect';

describe('proxy authenticated login redirect policy', () => {
  it('routes authenticated merchants through the membership-aware account gate', () => {
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: false,
    })).toBe('/signup/complete');
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: false,
      requestedPath: '/internal/orgs',
    })).toBe('/signup/complete');
  });

  it('routes platform admins to the platform console by default', () => {
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
    })).toBe('/internal');
  });

  it('honors safe internal next paths for platform admins', () => {
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
      requestedPath: '/internal/orgs',
    })).toBe('/internal/orgs');
  });

  it('rejects unsafe or non-internal next paths for platform admins', () => {
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
      requestedPath: '/analytics',
    })).toBe('/internal');
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
      requestedPath: '//example.com/internal',
    })).toBe('/internal');
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
      requestedPath: '/internal\\orgs',
    })).toBe('/internal');
  });

  it.each([
    '/admin',
    '/internal',
    '/internal/orgs',
  ])('routes an authenticated merchant away from platform entry %s', (pathname) => {
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname,
      isAuthenticated: true,
      isPlatformAdminAuthenticated: false,
    })).toBe('/analytics');
  });

  it('lets platform admins and non-admin-entry paths continue through normal routing', () => {
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/admin',
      isAuthenticated: true,
      isPlatformAdminAuthenticated: true,
    })).toBeNull();
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/internal',
      isAuthenticated: true,
      isPlatformAdminAuthenticated: true,
    })).toBeNull();
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/internal/orgs',
      isAuthenticated: true,
      isPlatformAdminAuthenticated: true,
    })).toBeNull();
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/admin',
      isAuthenticated: false,
      isPlatformAdminAuthenticated: false,
    })).toBeNull();
  });
});
