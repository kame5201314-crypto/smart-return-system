/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleSelfServiceTrialRequest } from '@/app/api/saas/trial/route';
import { CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION } from '@/lib/saas/self-service-trial';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/trial', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const body = {
  orgName: '測試商店',
  plan: 'basic',
  termsAccepted: true,
  termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

const identity = {
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'owner@example.com',
  hasGoogleIdentity: true,
};

describe('self-service trial API', () => {
  it('creates a trial and returns the merchant workspace destination', async () => {
    const repository = {
      provision: vi.fn().mockResolvedValue({
        orgId: 'org-1',
        subscriptionId: 'sub-1',
        ownerMembershipId: 'member-1',
        auditLogId: 'audit-1',
        claimId: 'claim-1',
        trialEnd: '2026-07-28T00:00:00.000Z',
        reused: false,
      }),
    };
    const response = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      now: new Date('2026-07-14T00:00:00.000Z'),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      redirectTo: '/analytics',
      data: { orgId: 'org-1', reused: false },
    });
  });

  it('fails closed when disabled or unauthenticated', async () => {
    const disabled = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity,
      env: {},
      repository: { provision: vi.fn() },
    });
    expect(disabled.status).toBe(403);
    expect(await disabled.json()).toMatchObject({ code: 'feature_disabled' });

    const unauthenticated = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity: null,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository: { provision: vi.fn() },
    });
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ code: 'unauthenticated' });
  });

  it('does not accept non-Google identities or stale terms', async () => {
    const env = {
      ENABLE_GOOGLE_AUTH: 'true',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
    };
    const nonGoogle = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity: { ...identity, hasGoogleIdentity: false },
      env,
      repository: { provision: vi.fn() },
    });
    expect(nonGoogle.status).toBe(403);
    expect(await nonGoogle.json()).toMatchObject({ code: 'google_identity_required' });

    const staleTerms = await handleSelfServiceTrialRequest(
      buildRequest({ ...body, termsVersion: 'old-version' }),
      {
        identity,
        env,
        repository: { provision: vi.fn() },
      }
    );
    expect(staleTerms.status).toBe(400);
    expect(await staleTerms.json()).toMatchObject({ code: 'invalid_request' });
  });
});
