import { describe, expect, it, vi } from 'vitest';

import {
  buildSelfServiceTrialRpcArgs,
  createSelfServiceTrialRepository,
  CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
  normalizeSelfServiceTrialInput,
  provisionSelfServiceTrial,
  SelfServiceTrialError,
} from '@/lib/saas/self-service-trial';

const identity = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'Owner@Example.com',
  phone: null,
  provider: 'google' as const,
  emailVerified: true,
  phoneVerified: false,
};

const payload = {
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
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
};

const result = {
  orgId: '33333333-3333-4333-8333-333333333333',
  subscriptionId: '44444444-4444-4444-8444-444444444444',
  ownerMembershipId: '55555555-5555-4555-8555-555555555555',
  auditLogId: '66666666-6666-4666-8666-666666666666',
  claimId: '77777777-7777-4777-8777-777777777777',
  trialEnd: '2026-07-28T00:00:00.000Z',
  reused: false,
};

function createProfileRepository(orgId: string | null = null) {
  return {
    getOrCreate: vi.fn().mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      orgId,
      status: orgId ? 'converted' : 'pending',
      reused: Boolean(orgId),
    }),
    markConverted: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SaaS Google self-service trial contract', () => {
  it('validates the approved plans and current terms version', () => {
    expect(normalizeSelfServiceTrialInput(payload)).toEqual({
      orgName: '測試商店',
      contactName: '王小明',
      contactPhone: '+886912345678',
      lineId: 'smart-return-owner',
      preferredContactChannel: 'email',
      platform: '蝦皮',
      monthlyReturnBand: '30_100',
      referralCode: 'PARTNER88',
      plan: 'basic',
      termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    });

    expect(() => normalizeSelfServiceTrialInput({ ...payload, plan: 'growth' }))
      .toThrow(SelfServiceTrialError);
    expect(() => normalizeSelfServiceTrialInput({ ...payload, plan: 'enterprise' }))
      .toThrow(SelfServiceTrialError);
    expect(() => normalizeSelfServiceTrialInput({ ...payload, termsAccepted: false }))
      .toThrow(SelfServiceTrialError);
    expect(() => normalizeSelfServiceTrialInput({ ...payload, termsVersion: 'old' }))
      .toThrow(SelfServiceTrialError);
  });

  it('requires both Google auth and self-service trial flags', async () => {
    const repository = { provision: vi.fn() };
    await expect(provisionSelfServiceTrial(payload, {
      identity,
      env: { ENABLE_GOOGLE_AUTH: 'true' },
      repository,
    })).rejects.toMatchObject({ code: 'feature_disabled', status: 403 });
    expect(repository.provision).not.toHaveBeenCalled();
  });

  it('requires an authenticated verified Google identity', async () => {
    const env = {
      ENABLE_GOOGLE_AUTH: 'true',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
    };
    await expect(provisionSelfServiceTrial(payload, {
      identity: null,
      env,
      repository: { provision: vi.fn() },
    })).rejects.toMatchObject({ code: 'unauthenticated', status: 401 });
    await expect(provisionSelfServiceTrial(payload, {
      identity: { ...identity, emailVerified: false },
      env,
      repository: { provision: vi.fn() },
    })).rejects.toMatchObject({ code: 'google_identity_required', status: 403 });
  });

  it('requires an invited Email before creating a closed-Beta trial', async () => {
    const repository = { provision: vi.fn() };
    const profileRepository = createProfileRepository();
    const env = {
      ENABLE_GOOGLE_AUTH: 'true',
      ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      ENABLE_INVITE_ONLY_BETA: 'true',
      SAAS_BETA_ALLOWED_EMAILS: 'friend@example.com',
    };

    await expect(provisionSelfServiceTrial(payload, {
      identity,
      env,
      repository,
      profileRepository,
    })).rejects.toMatchObject({ code: 'invite_required', status: 403 });
    expect(profileRepository.getOrCreate).not.toHaveBeenCalled();
    expect(repository.provision).not.toHaveBeenCalled();
  });

  it('normalizes identity and server acceptance time before provisioning', async () => {
    const repository = { provision: vi.fn().mockResolvedValue(result) };
    const profileRepository = createProfileRepository();
    const actual = await provisionSelfServiceTrial(payload, {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
      now: new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(actual).toEqual(result);
    expect(repository.provision).toHaveBeenCalledWith({
      orgName: '測試商店',
      contactName: '王小明',
      contactPhone: '+886912345678',
      lineId: 'smart-return-owner',
      preferredContactChannel: 'email',
      platform: '蝦皮',
      monthlyReturnBand: '30_100',
      referralCode: 'PARTNER88',
      plan: 'basic',
      termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      ownerUserId: identity.userId,
      ownerEmail: 'owner@example.com',
      ownerPhone: null,
      identityProvider: 'google',
      termsAcceptedAt: '2026-07-14T12:00:00.000Z',
    });
    expect(profileRepository.getOrCreate).toHaveBeenCalledWith({
      orgName: '測試商店',
      contactName: '王小明',
      contactPhone: '+886912345678',
      lineId: 'smart-return-owner',
      preferredContactChannel: 'email',
      platform: '蝦皮',
      monthlyReturnBand: '30_100',
      referralCode: 'PARTNER88',
      plan: 'basic',
      termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      ownerUserId: identity.userId,
      identityProvider: 'google',
      ownerEmail: 'owner@example.com',
      ownerPhone: null,
      termsAcceptedAt: '2026-07-14T12:00:00.000Z',
    });
    expect(profileRepository.markConverted).toHaveBeenCalledWith({
      profileId: '88888888-8888-4888-8888-888888888888',
      orgId: result.orgId,
      convertedAt: '2026-07-14T12:00:00.000Z',
    });
    expect(profileRepository.getOrCreate.mock.invocationCallOrder[0])
      .toBeLessThan(repository.provision.mock.invocationCallOrder[0]);
  });

  it('ignores an unrelated international secondary phone on Google identities', async () => {
    const repository = { provision: vi.fn().mockResolvedValue(result) };
    const profileRepository = createProfileRepository();
    await expect(provisionSelfServiceTrial(payload, {
      identity: {
        ...identity,
        phone: '+14155552671',
        phoneVerified: true,
      },
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
    })).resolves.toEqual(result);

    expect(repository.provision).toHaveBeenCalledWith(expect.objectContaining({
      identityProvider: 'google',
      ownerPhone: null,
    }));
  });

  it('uses a service-role-only RPC contract and normalizes the result', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        org_id: result.orgId,
        subscription_id: result.subscriptionId,
        owner_membership_id: result.ownerMembershipId,
        audit_log_id: result.auditLogId,
        claim_id: result.claimId,
        trial_end: result.trialEnd,
        reused: true,
      },
      error: null,
    });
    const repository = createSelfServiceTrialRepository({ rpc });
    const input = {
      ...normalizeSelfServiceTrialInput(payload),
      ownerUserId: identity.userId,
      ownerEmail: 'owner@example.com',
      ownerPhone: null,
      identityProvider: 'google' as const,
      termsAcceptedAt: '2026-07-14T12:00:00.000Z',
    };

    await expect(repository.provision(input)).resolves.toMatchObject({ reused: true });
    expect(rpc).toHaveBeenCalledWith(
      'create_google_self_service_trial',
      buildSelfServiceTrialRpcArgs(input)
    );
  });

  it('persists the customer profile before provisioning and fails closed on storage errors', async () => {
    const repository = { provision: vi.fn().mockResolvedValue(result) };
    const profileRepository = {
      getOrCreate: vi.fn().mockRejectedValue(new Error('private database detail')),
      markConverted: vi.fn(),
    };

    await expect(provisionSelfServiceTrial(payload, {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      profileRepository,
    })).rejects.toMatchObject({
      code: 'profile_persistence_failed',
      status: 500,
      message: 'Failed to save trial customer profile.',
    });
    expect(repository.provision).not.toHaveBeenCalled();
    expect(profileRepository.markConverted).not.toHaveBeenCalled();
  });

  it('requires a server-verified contact value for the selected preference', async () => {
    const phoneIdentity = {
      userId: identity.userId,
      provider: 'phone_otp' as const,
      email: null,
      phone: '0912-345-678',
      emailVerified: false,
      phoneVerified: true,
    };
    const repository = { provision: vi.fn() };
    const profileRepository = createProfileRepository();

    await expect(provisionSelfServiceTrial(payload, {
      identity: phoneIdentity,
      env: {
        ENABLE_PHONE_OTP_SIGNUP: 'true',
        SAAS_AUTH_CAPTCHA_READY: 'true',
        SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
        SAAS_PHONE_OTP_PROVIDER_READY: 'true',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
      },
      repository,
      profileRepository,
    })).rejects.toMatchObject({ code: 'invalid_request', status: 400 });
    expect(profileRepository.getOrCreate).not.toHaveBeenCalled();
    expect(repository.provision).not.toHaveBeenCalled();
  });

  it('provisions a verified email identity only when the guarded rollout is ready', async () => {
    const repository = { provision: vi.fn().mockResolvedValue(result) };
    const profileRepository = createProfileRepository();
    const emailIdentity = {
      ...identity,
      provider: 'email_otp' as const,
    };
    const env = {
      ENABLE_EMAIL_OTP_SIGNUP: 'true',
      SAAS_AUTH_CAPTCHA_READY: 'true',
      SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
    };

    await expect(provisionSelfServiceTrial(payload, {
      identity: emailIdentity,
      env: { ENABLE_EMAIL_OTP_SIGNUP: 'true' },
      repository,
    })).rejects.toMatchObject({ code: 'feature_disabled', status: 403 });
    expect(repository.provision).not.toHaveBeenCalled();

    await expect(provisionSelfServiceTrial(payload, {
      identity: emailIdentity,
      env,
      repository,
      profileRepository,
      now: new Date('2026-07-14T12:00:00.000Z'),
    })).resolves.toEqual(result);
    expect(repository.provision).toHaveBeenCalledWith(expect.objectContaining({
      identityProvider: 'email_otp',
      ownerEmail: 'owner@example.com',
      ownerPhone: null,
    }));
  });

  it('normalizes Taiwan phone-only owners and uses the verified identity RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        org_id: result.orgId,
        subscription_id: result.subscriptionId,
        owner_membership_id: result.ownerMembershipId,
        audit_log_id: result.auditLogId,
        claim_id: result.claimId,
        trial_end: result.trialEnd,
        reused: false,
      },
      error: null,
    });
    const repository = createSelfServiceTrialRepository({ rpc });
    const phoneIdentity = {
      userId: identity.userId,
      provider: 'phone_otp' as const,
      email: 'pending@example.com',
      phone: '0912-345-678',
      emailVerified: false,
      phoneVerified: true,
    };
    const actual = await provisionSelfServiceTrial({
      ...payload,
      preferredContactChannel: 'phone',
    }, {
      identity: phoneIdentity,
      env: {
        ENABLE_PHONE_OTP_SIGNUP: 'true',
        SAAS_AUTH_CAPTCHA_READY: 'true',
        SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
        SAAS_PHONE_OTP_PROVIDER_READY: 'true',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
      },
      repository,
      profileRepository: createProfileRepository(),
      now: new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(actual).toEqual(result);
    expect(rpc).toHaveBeenCalledWith(
      'create_verified_identity_self_service_trial',
      expect.objectContaining({
        p_identity_provider: 'phone_otp',
        p_owner_email: null,
        p_owner_phone: '+886912345678',
      })
    );
  });

  it('uses the verified session phone instead of a client-supplied contact phone', async () => {
    const repository = { provision: vi.fn().mockResolvedValue(result) };
    const profileRepository = createProfileRepository();
    const phoneIdentity = {
      userId: identity.userId,
      provider: 'phone_otp' as const,
      email: null,
      phone: '0912-345-678',
      emailVerified: false,
      phoneVerified: true,
    };

    await expect(provisionSelfServiceTrial({
      ...payload,
      contactPhone: '0988-765-432',
      preferredContactChannel: 'phone',
    }, {
      identity: phoneIdentity,
      env: {
        ENABLE_PHONE_OTP_SIGNUP: 'true',
        SAAS_AUTH_CAPTCHA_READY: 'true',
        SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
        SAAS_PHONE_OTP_PROVIDER_READY: 'true',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
      },
      repository,
      profileRepository,
    })).resolves.toEqual(result);

    expect(profileRepository.getOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      contactPhone: '+886912345678',
      ownerPhone: '+886912345678',
    }));
  });

  it('does not expose raw database errors to the public trial route', async () => {
    const repository = createSelfServiceTrialRepository({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'secret database topology detail' },
      }),
    });
    const input = {
      ...normalizeSelfServiceTrialInput(payload),
      ownerUserId: identity.userId,
      ownerEmail: 'owner@example.com',
      ownerPhone: null,
      identityProvider: 'google' as const,
      termsAcceptedAt: '2026-07-14T12:00:00.000Z',
    };

    await expect(repository.provision(input)).rejects.toMatchObject({
      code: 'provision_failed',
      message: 'Failed to provision self-service trial.',
    });
  });
});
