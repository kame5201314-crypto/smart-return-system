/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  handleSelfServiceTrialRequest,
  loadVerifiedIdentity,
} from '@/app/api/saas/trial/route';
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
  contactName: '王小明',
  contactPhone: '0912-345-678',
  lineId: 'smart-return-owner',
  preferredContactChannel: 'email',
  platform: '蝦皮',
  monthlyReturnBand: '30_100',
  referralCode: 'PARTNER88',
  plan: 'basic',
  termsAccepted: true,
  termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

const identity = {
  userId: '22222222-2222-4222-8222-222222222222',
  email: 'owner@example.com',
  phone: null,
  provider: 'google' as const,
  emailVerified: true,
  phoneVerified: false,
};

function createProfileRepository(orgId: string | null = null) {
  return {
    getOrCreate: vi.fn().mockResolvedValue({
      id: 'profile-1',
      orgId,
      status: orgId ? 'converted' : 'pending',
      reused: Boolean(orgId),
    }),
    markConverted: vi.fn().mockResolvedValue(undefined),
  };
}

describe('self-service trial API', () => {
  it('rejects a verified linked identity when its rollout flags are disabled', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: identity.userId,
              email: identity.email,
              email_confirmed_at: '2026-07-14T00:00:00.000Z',
              phone: null,
              phone_confirmed_at: null,
              identities: [{ provider: 'google' }],
              user_metadata: {},
            },
          },
          error: null,
        }),
      },
    } as unknown as NonNullable<Parameters<typeof loadVerifiedIdentity>[1]>;

    expect(await loadVerifiedIdentity({}, authClient)).toBeNull();
    expect(await loadVerifiedIdentity({
      ENABLE_GOOGLE_AUTH: 'true',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
    }, authClient)).toMatchObject({
      userId: identity.userId,
      provider: 'google',
    });
  });

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
    const profileRepository = createProfileRepository();
    const response = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
      now: new Date('2026-07-14T00:00:00.000Z'),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      redirectTo: '/analytics',
      data: { orgId: 'org-1', reused: false },
    });
    expect(profileRepository.getOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: identity.userId,
      ownerEmail: identity.email,
      identityProvider: 'google',
      contactPhone: '+886912345678',
    }));
    expect(profileRepository.markConverted).toHaveBeenCalledWith({
      profileId: 'profile-1',
      orgId: 'org-1',
      convertedAt: '2026-07-14T00:00:00.000Z',
    });
    expect(profileRepository.getOrCreate.mock.invocationCallOrder[0])
      .toBeLessThan(repository.provision.mock.invocationCallOrder[0]);
  });

  it('returns the original workspace for an idempotent retry', async () => {
    const repository = {
      provision: vi.fn().mockResolvedValue({
        orgId: 'org-existing',
        subscriptionId: 'sub-existing',
        ownerMembershipId: 'member-existing',
        auditLogId: null,
        claimId: 'claim-existing',
        trialEnd: '2026-07-28T00:00:00.000Z',
        reused: true,
      }),
    };
    const profileRepository = createProfileRepository('org-existing');
    const response = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      redirectTo: '/analytics',
      data: { orgId: 'org-existing', reused: true },
    });
    expect(repository.provision).toHaveBeenCalledTimes(1);
    expect(profileRepository.markConverted).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-existing',
    }));
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
      identity: { ...identity, emailVerified: false },
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

  it('rate limits repeated authenticated provisioning before calling the RPC', async () => {
    const repository = { provision: vi.fn() };
    const profileRepository = createProfileRepository();
    const response = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
      rateLimiter: {
        check: vi.fn().mockReturnValue({
          allowed: false,
          retryAfterSeconds: 120,
        }),
      },
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'rate_limited' });
    expect(repository.provision).not.toHaveBeenCalled();
    expect(profileRepository.getOrCreate).not.toHaveBeenCalled();
  });

  it('accepts a confirmed email OTP identity only after provider readiness is explicit', async () => {
    const repository = {
      provision: vi.fn().mockResolvedValue({
        orgId: 'org-email',
        subscriptionId: 'sub-email',
        ownerMembershipId: 'member-email',
        auditLogId: 'audit-email',
        claimId: 'claim-email',
        trialEnd: '2026-07-28T00:00:00.000Z',
        reused: false,
      }),
    };
    const profileRepository = createProfileRepository();
    const response = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity: { ...identity, provider: 'email_otp' },
      env: {
        ENABLE_EMAIL_OTP_SIGNUP: 'true',
        SAAS_AUTH_CAPTCHA_READY: 'true',
        SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
        SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
      },
      repository,
      profileRepository,
    });

    expect(response.status).toBe(201);
    expect(repository.provision).toHaveBeenCalledWith(expect.objectContaining({
      identityProvider: 'email_otp',
      ownerEmail: 'owner@example.com',
    }));
  });

  it('does not trust client-supplied identity fields when saving the profile', async () => {
    const repository = {
      provision: vi.fn().mockResolvedValue({
        orgId: 'org-secure',
        subscriptionId: 'sub-secure',
        ownerMembershipId: 'member-secure',
        auditLogId: 'audit-secure',
        claimId: 'claim-secure',
        trialEnd: '2026-07-28T00:00:00.000Z',
        reused: false,
      }),
    };
    const profileRepository = createProfileRepository();
    const response = await handleSelfServiceTrialRequest(buildRequest({
      ...body,
      userId: 'attacker-user',
      email: 'attacker@example.com',
      provider: 'phone_otp',
    }), {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
    });

    expect(response.status).toBe(201);
    expect(profileRepository.getOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: identity.userId,
      ownerEmail: identity.email,
      identityProvider: 'google',
    }));
    expect(profileRepository.getOrCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'attacker-user',
    }));
  });

  it('does not provision a workspace when profile persistence fails', async () => {
    const repository = { provision: vi.fn() };
    const profileRepository = {
      getOrCreate: vi.fn().mockRejectedValue(new Error('private storage detail')),
      markConverted: vi.fn(),
    };
    const response = await handleSelfServiceTrialRequest(buildRequest(body), {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: 'profile_persistence_failed',
      error: 'Failed to save trial customer profile.',
    });
    expect(repository.provision).not.toHaveBeenCalled();
  });
});
