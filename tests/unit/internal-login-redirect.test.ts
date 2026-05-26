import { describe, expect, it } from 'vitest';

import {
  buildInternalLoginRedirect,
  getInternalLoginRedirectForPlatformAdminResult,
  normalizeInternalNextPath,
} from '@/lib/auth/internal-login-redirect';

describe('internal login redirect policy', () => {
  it('normalizes internal next paths only', () => {
    expect(normalizeInternalNextPath('/internal/orgs')).toBe('/internal/orgs');
    expect(normalizeInternalNextPath('/internal/billing/events')).toBe('/internal/billing/events');
    expect(normalizeInternalNextPath('/internality')).toBe('/internal');
    expect(normalizeInternalNextPath('/settings')).toBe('/internal');
    expect(normalizeInternalNextPath('//example.com/internal')).toBe('/internal');
    expect(normalizeInternalNextPath('/internal\\orgs')).toBe('/internal');
  });

  it('builds a login redirect with an encoded next path', () => {
    expect(buildInternalLoginRedirect('/internal/orgs')).toBe('/login?next=%2Finternal%2Forgs');
  });

  it('redirects unauthenticated internal access to login', () => {
    expect(getInternalLoginRedirectForPlatformAdminResult({
      state: 'gated',
      gated: {
        accessCode: 'unauthenticated',
      },
    }, '/internal/orgs')).toBe('/login?next=%2Finternal%2Forgs');
  });

  it('does not redirect authenticated but forbidden internal access', () => {
    expect(getInternalLoginRedirectForPlatformAdminResult({
      state: 'gated',
      gated: {
        accessCode: 'admin_required',
      },
    }, '/internal/orgs')).toBeNull();
  });
});
