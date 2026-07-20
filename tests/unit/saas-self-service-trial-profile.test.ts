import { describe, expect, it, vi } from 'vitest';

import {
  buildSelfServiceTrialProfileInsert,
  createSelfServiceTrialProfileRepository,
  SELF_SERVICE_TRIAL_PROFILE_CONTEXT,
  type SelfServiceTrialProfilePersistenceInput,
  type SelfServiceTrialProfileQueryClient,
} from '@/lib/saas/self-service-trial-profile';

const input: SelfServiceTrialProfilePersistenceInput = {
  ownerUserId: '11111111-1111-4111-8111-111111111111',
  identityProvider: 'google',
  ownerEmail: 'owner@example.com',
  ownerPhone: null,
  orgName: '測試商店',
  contactName: '王小明',
  contactPhone: '+886912345678',
  lineId: 'smart-return-owner',
  preferredContactChannel: 'email',
  platform: '蝦皮',
  monthlyReturnBand: '30_100',
  referralCode: 'PARTNER88',
  plan: 'basic',
  termsVersion: '2026-07-15-v2',
  termsAcceptedAt: '2026-07-16T00:00:00.000Z',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
};

function createQueryBuilder(input?: {
  maybeSingle?: { data: unknown; error: { message?: string } | null };
  single?: { data: unknown; error: { message?: string } | null };
}) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'eq', 'contains', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(
    input?.maybeSingle ?? { data: null, error: null }
  );
  builder.single = vi.fn().mockResolvedValue(
    input?.single ?? { data: null, error: null }
  );
  builder.then = vi.fn();
  return builder as {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
}

describe('self-service trial customer profile persistence', () => {
  it('maps authenticated profile data to the applied signup_requests schema', () => {
    expect(buildSelfServiceTrialProfileInsert(input)).toEqual({
      company_name: '測試商店',
      contact_name: '王小明',
      email: 'owner@example.com',
      line_id: 'smart-return-owner',
      phone: '+886912345678',
      preferred_contact_channel: 'email',
      plan: 'basic',
      monthly_return_volume: null,
      monthly_return_band: '30_100',
      message: null,
      status: 'pending',
      source: 'public_lead',
      metadata: {
        capture_context: SELF_SERVICE_TRIAL_PROFILE_CONTEXT,
        profile_version: '2026-07-16-v1',
        auth_user_id: input.ownerUserId,
        identity_provider: 'google',
        email_verified: true,
        phone_verified: false,
        platform: '蝦皮',
        referral_code: 'PARTNER88',
        terms_version: '2026-07-15-v2',
        terms_accepted_at: '2026-07-16T00:00:00.000Z',
        trial_idempotency_key: input.idempotencyKey,
      },
    });
  });

  it('reuses a profile with the same authenticated user and idempotency key', async () => {
    const lookup = createQueryBuilder({
      maybeSingle: {
        data: { id: 'profile-existing', org_id: 'org-existing', status: 'converted' },
        error: null,
      },
    });
    const from = vi.fn().mockReturnValue(lookup);
    const repository = createSelfServiceTrialProfileRepository(
      { from } as unknown as SelfServiceTrialProfileQueryClient
    );

    await expect(repository.getOrCreate(input)).resolves.toEqual({
      id: 'profile-existing',
      orgId: 'org-existing',
      status: 'converted',
      reused: true,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(lookup.contains).toHaveBeenCalledWith('metadata', {
      capture_context: SELF_SERVICE_TRIAL_PROFILE_CONTEXT,
      auth_user_id: input.ownerUserId,
      trial_idempotency_key: input.idempotencyKey,
    });
    expect(lookup.insert).not.toHaveBeenCalled();
  });

  it('inserts before provisioning and can link the resulting organization', async () => {
    const lookup = createQueryBuilder();
    const insert = createQueryBuilder({
      single: {
        data: { id: 'profile-new', org_id: null, status: 'pending' },
        error: null,
      },
    });
    const update = createQueryBuilder({
      maybeSingle: { data: { id: 'profile-new' }, error: null },
    });
    const from = vi.fn()
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(insert)
      .mockReturnValueOnce(update);
    const repository = createSelfServiceTrialProfileRepository(
      { from } as unknown as SelfServiceTrialProfileQueryClient
    );

    await expect(repository.getOrCreate(input)).resolves.toEqual({
      id: 'profile-new',
      orgId: null,
      status: 'pending',
      reused: false,
    });
    expect(insert.insert).toHaveBeenCalledWith(buildSelfServiceTrialProfileInsert(input));

    await expect(repository.markConverted({
      profileId: 'profile-new',
      orgId: 'org-new',
      convertedAt: '2026-07-16T00:00:00.000Z',
    })).resolves.toBeUndefined();
    expect(update.update).toHaveBeenCalledWith({
      org_id: 'org-new',
      status: 'converted',
      processed_at: '2026-07-16T00:00:00.000Z',
    });
    expect(update.eq).toHaveBeenNthCalledWith(1, 'id', 'profile-new');
    expect(update.eq).toHaveBeenNthCalledWith(2, 'source', 'public_lead');
  });
});
