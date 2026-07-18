import { describe, expect, it } from 'vitest';

import {
  classifySaasPageSurface,
  normalizeConfiguredSurfaceOrigin,
  resolveSaasSurfaceOrigins,
  resolveSaasSurfaceRedirect,
} from '@/lib/auth/saas-surface-host';

const MULTI_HOST_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_MARKETING_URL: 'https://www.smart-return.test',
  NEXT_PUBLIC_APP_URL: 'https://app.smart-return.test',
  NEXT_PUBLIC_ADMIN_URL: 'https://admin.smart-return.test',
};

describe('SaaS canonical surface routing', () => {
  it('accepts only root HTTPS origins outside explicit loopback development', () => {
    expect(normalizeConfiguredSurfaceOrigin('https://app.smart-return.test/')).toBe(
      'https://app.smart-return.test'
    );
    expect(normalizeConfiguredSurfaceOrigin('https://user:pass@app.smart-return.test')).toBeNull();
    expect(normalizeConfiguredSurfaceOrigin('https://app.smart-return.test/path')).toBeNull();
    expect(normalizeConfiguredSurfaceOrigin('http://app.smart-return.test')).toBeNull();
    expect(normalizeConfiguredSurfaceOrigin('http://localhost:3001', 'development')).toBe(
      'http://localhost:3001'
    );
  });

  it('keeps legacy single-host behavior until a new surface URL is configured', () => {
    const env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://smart-return.test',
    };

    expect(resolveSaasSurfaceOrigins(env)).toEqual({
      marketing: 'https://smart-return.test',
      app: 'https://smart-return.test',
      admin: 'https://smart-return.test',
      enabled: false,
    });
    expect(resolveSaasSurfaceRedirect('https://smart-return.test/internal', env)).toBeNull();
  });

  it('classifies the three page surfaces without redirecting API or unknown paths', () => {
    expect(classifySaasPageSurface('/')).toBe('marketing');
    expect(classifySaasPageSurface('/pricing')).toBe('marketing');
    expect(classifySaasPageSurface('/analytics/ai-report')).toBe('app');
    expect(classifySaasPageSurface('/login')).toBe('app');
    expect(classifySaasPageSurface('/admin/login')).toBe('admin');
    expect(classifySaasPageSurface('/internal/orgs')).toBe('admin');
    expect(classifySaasPageSurface('/api/internal/saas/orgs')).toBeNull();
    expect(classifySaasPageSurface('/unknown')).toBeNull();
  });

  it('routes each known path only to its configured trusted origin', () => {
    expect(resolveSaasSurfaceRedirect(
      'https://www.smart-return.test/analytics?month=7',
      MULTI_HOST_ENV
    )).toBe('https://app.smart-return.test/analytics?month=7');
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/internal/orgs?status=trial',
      MULTI_HOST_ENV
    )).toBe('https://admin.smart-return.test/internal/orgs?status=trial');
    expect(resolveSaasSurfaceRedirect(
      'https://admin.smart-return.test/pricing',
      MULTI_HOST_ENV
    )).toBe('https://www.smart-return.test/pricing');
  });

  it('provides useful root and login entries on dedicated app and admin hosts', () => {
    expect(resolveSaasSurfaceRedirect(
      'https://admin.smart-return.test/',
      MULTI_HOST_ENV
    )).toBe('https://admin.smart-return.test/admin');
    expect(resolveSaasSurfaceRedirect(
      'https://admin.smart-return.test/login?next=%2Finternal%2Forgs',
      MULTI_HOST_ENV
    )).toBe('https://admin.smart-return.test/admin/login?next=%2Finternal%2Forgs');
    expect(resolveSaasSurfaceRedirect(
      'https://admin.smart-return.test/login?next=%2F%2Fevil.example',
      MULTI_HOST_ENV
    )).toBe('https://admin.smart-return.test/admin/login?next=%2Finternal');
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/',
      MULTI_HOST_ENV
    )).toBe('https://app.smart-return.test/analytics');
  });

  it('canonicalizes legacy internal login links without treating unsafe next values as admin intent', () => {
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/login?next=%2Finternal%2Forgs',
      MULTI_HOST_ENV
    )).toBe(
      'https://admin.smart-return.test/admin/login?next=%2Finternal%2Forgs'
    );
    expect(resolveSaasSurfaceRedirect(
      'https://www.smart-return.test/login?next=%2Finternal',
      MULTI_HOST_ENV
    )).toBe('https://admin.smart-return.test/admin/login?next=%2Finternal');
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/login?next=%2Fadmin',
      MULTI_HOST_ENV
    )).toBe('https://admin.smart-return.test/admin/login?next=%2Finternal');
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/login?next=%2F%2Fevil.example',
      MULTI_HOST_ENV
    )).toBeNull();
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/login',
      MULTI_HOST_ENV
    )).toBeNull();
  });

  it('uses the dedicated admin login on a valid single-host deployment', () => {
    const env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://smart-return.test',
    };

    expect(resolveSaasSurfaceRedirect(
      'https://smart-return.test/login?next=%2Finternal%2Fleads',
      env
    )).toBe('https://smart-return.test/admin/login?next=%2Finternal%2Fleads');
  });

  it('never uses an incoming hostile host as a redirect destination', () => {
    expect(resolveSaasSurfaceRedirect(
      'https://evil.example/internal/orgs?next=%2F%2Fevil.example',
      MULTI_HOST_ENV
    )).toBe(
      'https://admin.smart-return.test/internal/orgs?next=%2F%2Fevil.example'
    );
  });

  it('fails safely when any explicitly configured surface URL is invalid', () => {
    const invalid = {
      ...MULTI_HOST_ENV,
      NEXT_PUBLIC_ADMIN_URL: 'https://admin.smart-return.test/path',
    };

    expect(resolveSaasSurfaceOrigins(invalid).enabled).toBe(false);
    expect(resolveSaasSurfaceRedirect('https://app.smart-return.test/internal', invalid)).toBeNull();
  });

  it('does not loop on canonical hosts or redirect static and unknown routes', () => {
    expect(resolveSaasSurfaceRedirect(
      'https://admin.smart-return.test/internal',
      MULTI_HOST_ENV
    )).toBeNull();
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/_next/static/app.js',
      MULTI_HOST_ENV
    )).toBeNull();
    expect(resolveSaasSurfaceRedirect(
      'https://app.smart-return.test/unknown',
      MULTI_HOST_ENV
    )).toBeNull();
  });
});
