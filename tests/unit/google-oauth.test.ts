import { describe, expect, it } from 'vitest';

import {
  buildSignupCompletePath,
  normalizeGoogleOAuthNext,
  normalizeGoogleTrialPlan,
  resolveGoogleOAuthDestination,
} from '@/lib/auth/google-oauth';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'merchant@example.com',
};

describe('Google OAuth routing policy', () => {
  it('routes existing active merchants to their requested customer page', () => {
    expect(resolveGoogleOAuthDestination({
      user,
      memberships: [{ orgId: 'org-1', status: 'active' }],
      requestedPath: '/shopee-returns',
    })).toBe('/shopee-returns');
  });

  it('treats legacy membership rows without status as active', () => {
    expect(resolveGoogleOAuthDestination({
      user,
      memberships: [{ orgId: 'org-1', status: null }],
    })).toBe('/analytics');
  });

  it('routes users without a workspace to the minimal completion page', () => {
    expect(resolveGoogleOAuthDestination({
      user,
      memberships: [],
      trialPlan: 'growth',
    })).toBe('/signup/complete?plan=growth');
  });

  it('does not let disabled members silently create another workspace', () => {
    expect(resolveGoogleOAuthDestination({
      user,
      memberships: [{ orgId: 'org-1', status: 'disabled' }],
      trialPlan: 'basic',
    })).toBe('/signup/complete?plan=basic&state=membership_disabled');
  });

  it('routes explicit platform admins to the platform console', () => {
    expect(resolveGoogleOAuthDestination({
      user,
      memberships: [],
      env: { PLATFORM_ADMIN_ROLES: 'merchant@example.com=owner' },
    })).toBe('/internal');
  });

  it('rejects open, internal, login, and OAuth-loop redirects for merchants', () => {
    const memberships = [{ orgId: 'org-1', status: 'active' }];
    expect(resolveGoogleOAuthDestination({ user, memberships, requestedPath: '//evil.test' }))
      .toBe('/analytics');
    expect(resolveGoogleOAuthDestination({ user, memberships, requestedPath: '/internal/orgs' }))
      .toBe('/analytics');
    expect(resolveGoogleOAuthDestination({ user, memberships, requestedPath: '/login' }))
      .toBe('/analytics');
    expect(resolveGoogleOAuthDestination({ user, memberships, requestedPath: '/auth/callback' }))
      .toBe('/analytics');
  });

  it('normalizes public trial plans and completion paths', () => {
    expect(normalizeGoogleTrialPlan('growth')).toBe('growth');
    expect(normalizeGoogleTrialPlan('enterprise')).toBe('basic');
    expect(buildSignupCompletePath({ plan: 'growth' })).toBe('/signup/complete?plan=growth');
    expect(normalizeGoogleOAuthNext('/returns')).toBe('/returns');
    expect(normalizeGoogleOAuthNext('https://evil.test')).toBeNull();
  });
});
