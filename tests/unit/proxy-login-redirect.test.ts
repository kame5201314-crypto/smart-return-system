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

  it('routes authenticated merchants away from the canonical admin entry', () => {
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/admin',
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
      isPlatformAdminAuthenticated: false,
    })).toBeNull();
    expect(resolveAuthenticatedAdminEntryRedirect({
      pathname: '/admin',
      isAuthenticated: false,
      isPlatformAdminAuthenticated: false,
    })).toBeNull();
  });
});
