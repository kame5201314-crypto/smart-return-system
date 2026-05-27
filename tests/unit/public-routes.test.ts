import { describe, expect, it } from 'vitest';

import { isPublicRoute } from '@/lib/auth/public-routes';

describe('public route allowlist', () => {
  it('keeps SaaS commercial website routes public', () => {
    expect(isPublicRoute('/')).toBe(true);
    expect(isPublicRoute('/pricing')).toBe(true);
    expect(isPublicRoute('/features/returns')).toBe(true);
    expect(isPublicRoute('/features/ai')).toBe(true);
    expect(isPublicRoute('/features/security')).toBe(true);
    expect(isPublicRoute('/signup')).toBe(true);
    expect(isPublicRoute('/contact')).toBe(true);
    expect(isPublicRoute('/invite/demo-token')).toBe(true);
    expect(isPublicRoute('/legal/terms')).toBe(true);
    expect(isPublicRoute('/legal/privacy')).toBe(true);
    expect(isPublicRoute('/legal/refund')).toBe(true);
  });

  it('keeps customer portal and login routes public', () => {
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/admin/login')).toBe(true);
    expect(isPublicRoute('/portal')).toBe(true);
    expect(isPublicRoute('/portal/track/query')).toBe(true);
    expect(isPublicRoute('/portal/track/demo-id')).toBe(true);
  });

  it('does not expose app, admin, or internal operations', () => {
    expect(isPublicRoute('/admin')).toBe(false);
    expect(isPublicRoute('/analytics')).toBe(false);
    expect(isPublicRoute('/returns')).toBe(false);
    expect(isPublicRoute('/settings/billing')).toBe(false);
    expect(isPublicRoute('/internal/orgs')).toBe(false);
    expect(isPublicRoute('/api/v1/ai/analyze')).toBe(false);
  });

  it('requires exact path segments for public prefixes', () => {
    expect(isPublicRoute('/pricing-admin')).toBe(false);
    expect(isPublicRoute('/features-admin')).toBe(false);
    expect(isPublicRoute('/legal-admin')).toBe(false);
    expect(isPublicRoute('/portal-admin')).toBe(false);
  });
});
