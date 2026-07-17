import { describe, expect, it } from 'vitest';

import { auditPlatformCustomerSyncRows } from '../../scripts/saas/audit-platform-customer-sync.mjs';

const user = {
  email_confirmed_at: '2026-07-18T00:00:00.000Z',
  app_metadata: { provider: 'email' },
  identities: [{ provider: 'email' }],
};

describe('platform customer sync audit', () => {
  it('accepts a verified self-service customer linked across all admin records', () => {
    const result = auditPlatformCustomerSyncRows({
      organizations: [{ id: 'org-1', status: 'trialing' }],
      members: [{
        org_id: 'org-1', user_id: 'user-1', role: 'owner', status: 'active',
      }],
      subscriptions: [{ org_id: 'org-1', status: 'trialing' }],
      claims: [{
        org_id: 'org-1', user_id: 'user-1', identity_provider: 'email_otp',
      }],
      signupRequests: [{
        org_id: 'org-1',
        status: 'converted',
        metadata: {
          capture_context: 'authenticated_trial_onboarding',
          auth_user_id: 'user-1',
        },
      }],
      authUsersById: new Map([['user-1', user]]),
    });

    expect(result).toEqual({
      ok: true,
      issues: [],
      counts: {
        organizations: 1,
        activeOwnerMemberships: 1,
        subscriptions: 1,
        selfServiceClaims: 1,
        verifiedAuthUsers: 1,
        selfServiceProfiles: 1,
        convertedProfiles: 1,
      },
    });
  });

  it('reports broken tenant, owner, subscription, auth, and profile links without PII', () => {
    const result = auditPlatformCustomerSyncRows({
      organizations: [],
      members: [],
      subscriptions: [],
      claims: [{
        org_id: 'missing-org', user_id: 'missing-user', identity_provider: 'email_otp',
      }],
      signupRequests: [{
        org_id: 'other-org',
        status: 'converted',
        metadata: {
          capture_context: 'authenticated_trial_onboarding',
          auth_user_id: 'missing-user',
        },
      }],
      authUsersById: new Map(),
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      'claim_without_organization',
      'claim_without_subscription',
      'claim_without_matching_active_owner',
      'claim_auth_user_missing',
      'converted_profile_without_organization',
      'converted_profile_claim_mismatch',
    ]));
    expect(JSON.stringify(result)).not.toContain('email');
  });
});
