import { describe, expect, it } from 'vitest';

import { resolveAuthenticatedLoginRedirect } from '@/lib/auth/proxy-login-redirect';

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
});
