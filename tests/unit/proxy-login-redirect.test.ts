import { describe, expect, it } from 'vitest';

import {
  resolveAuthenticatedAdminEntryRedirect,
  resolveAuthenticatedLoginRedirect,
} from '@/lib/auth/proxy-login-redirect';

describe('proxy authenticated login redirect policy', () => {
  it('routes authenticated merchants away from login to the merchant workspace', () => {
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: false,
    })).toBe('/analytics');
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: false,
      requestedPath: '/internal/orgs',
    })).toBe('/analytics');
  });

  it('routes the general login entry to the merchant workspace for platform admins', () => {
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
    })).toBe('/analytics');
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
    })).toBe('/analytics');
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
      requestedPath: '//example.com/internal',
    })).toBe('/analytics');
    expect(resolveAuthenticatedLoginRedirect({
      isPlatformAdminAuthenticated: true,
      requestedPath: '/internal\\orgs',
    })).toBe('/analytics');
  });

  it('routes authenticated merchants away from platform admin entries', () => {
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/admin',
      isAuthenticated: true,
      isPlatformAdminAuthenticated: false,
    })).toBe('/analytics');
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/internal',
      isAuthenticated: true,
      isPlatformAdminAuthenticated: false,
    })).toBe('/analytics');
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/internal/orgs',
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
