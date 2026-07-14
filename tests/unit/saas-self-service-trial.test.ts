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
  hasGoogleIdentity: true,
};

const payload = {
  orgName: '測試商店',
  plan: 'growth',
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

describe('SaaS Google self-service trial contract', () => {
  it('validates the approved plans and current terms version', () => {
    expect(normalizeSelfServiceTrialInput(payload)).toEqual({
      orgName: '測試商店',
      plan: 'growth',
      termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    });

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
      identity: { ...identity, hasGoogleIdentity: false },
      env,
      repository: { provision: vi.fn() },
    })).rejects.toMatchObject({ code: 'google_identity_required', status: 403 });
  });

  it('normalizes identity and server acceptance time before provisioning', async () => {
    const repository = { provision: vi.fn().mockResolvedValue(result) };
    const actual = await provisionSelfServiceTrial(payload, {
      identity,
      env: {
        ENABLE_GOOGLE_AUTH: 'true',
        ENABLE_GOOGLE_TRIAL_SIGNUP: 'true',
      },
      repository,
      now: new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(actual).toEqual(result);
    expect(repository.provision).toHaveBeenCalledWith({
      orgName: '測試商店',
      plan: 'growth',
      termsVersion: CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION,
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      ownerUserId: identity.userId,
      ownerEmail: 'owner@example.com',
      termsAcceptedAt: '2026-07-14T12:00:00.000Z',
    });
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
      termsAcceptedAt: '2026-07-14T12:00:00.000Z',
    };

    await expect(repository.provision(input)).resolves.toMatchObject({ reused: true });
    expect(rpc).toHaveBeenCalledWith(
      'create_google_self_service_trial',
      buildSelfServiceTrialRpcArgs(input)
    );
  });
});
