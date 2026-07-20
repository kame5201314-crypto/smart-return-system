import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type {
  SaaSLeadContactChannel,
  SaaSMonthlyReturnBand,
} from '@/lib/saas/lead-capture';
import type { SelfServiceSaaSPlanCode } from '@/lib/config/saas-plans';

export const SELF_SERVICE_TRIAL_PROFILE_CONTEXT = 'authenticated_trial_onboarding';
export const SELF_SERVICE_TRIAL_PROFILE_VERSION = '2026-07-16-v1';

export interface SelfServiceTrialProfilePersistenceInput {
  ownerUserId: string;
  identityProvider: 'google' | 'email_otp' | 'phone_otp';
  ownerEmail: string | null;
  ownerPhone: string | null;
  orgName: string;
  contactName: string;
  contactPhone: string;
  lineId: string | null;
  preferredContactChannel: SaaSLeadContactChannel;
  platform: string;
  monthlyReturnBand: SaaSMonthlyReturnBand;
  referralCode: string | null;
  plan: SelfServiceSaaSPlanCode;
  termsVersion: string;
  termsAcceptedAt: string;
  idempotencyKey: string;
}

export interface SelfServiceTrialProfileRecord {
  id: string;
  orgId: string | null;
  status: string | null;
  reused: boolean;
}

export interface SelfServiceTrialProfileRepository {
  getOrCreate(
    input: SelfServiceTrialProfilePersistenceInput
  ): Promise<SelfServiceTrialProfileRecord>;
  markConverted(input: {
    profileId: string;
    orgId: string;
    convertedAt: string;
  }): Promise<void>;
}

interface QueryError {
  message?: string;
}

interface QueryResult {
  data: unknown;
  error: QueryError | null;
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  insert(values: Record<string, unknown>): QueryBuilder;
  update(values: Record<string, unknown>): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  contains(column: string, value: Record<string, unknown>): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  maybeSingle(): PromiseLike<QueryResult>;
  single(): PromiseLike<QueryResult>;
}

export interface SelfServiceTrialProfileQueryClient {
  from(table: string): QueryBuilder;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeProfileRecord(
  value: unknown,
  reused: boolean
): SelfServiceTrialProfileRecord {
  if (!isRecord(value)) {
    throw new Error('Self-service trial customer profile returned invalid data.');
  }

  const id = stringOrNull(value.id);
  if (!id) {
    throw new Error('Self-service trial customer profile did not return id.');
  }

  return {
    id,
    orgId: stringOrNull(value.org_id),
    status: stringOrNull(value.status),
    reused,
  };
}

function assertNoQueryError(error: QueryError | null, fallback: string): void {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export function buildSelfServiceTrialProfileMetadata(
  input: SelfServiceTrialProfilePersistenceInput
): Record<string, unknown> {
  return {
    capture_context: SELF_SERVICE_TRIAL_PROFILE_CONTEXT,
    profile_version: SELF_SERVICE_TRIAL_PROFILE_VERSION,
    auth_user_id: input.ownerUserId,
    identity_provider: input.identityProvider,
    email_verified: Boolean(input.ownerEmail),
    phone_verified: Boolean(
      input.ownerPhone && input.ownerPhone === input.contactPhone
    ),
    platform: input.platform,
    referral_code: input.referralCode,
    terms_version: input.termsVersion,
    terms_accepted_at: input.termsAcceptedAt,
    trial_idempotency_key: input.idempotencyKey,
  };
}

export function buildSelfServiceTrialProfileInsert(
  input: SelfServiceTrialProfilePersistenceInput
): Record<string, unknown> {
  return {
    company_name: input.orgName,
    contact_name: input.contactName,
    email: input.ownerEmail,
    line_id: input.lineId,
    phone: input.contactPhone,
    preferred_contact_channel: input.preferredContactChannel,
    plan: input.plan,
    monthly_return_volume: null,
    monthly_return_band: input.monthlyReturnBand,
    message: null,
    status: 'pending',
    source: 'public_lead',
    metadata: buildSelfServiceTrialProfileMetadata(input),
  };
}

function buildProfileLookupMetadata(
  input: SelfServiceTrialProfilePersistenceInput
): Record<string, unknown> {
  return {
    capture_context: SELF_SERVICE_TRIAL_PROFILE_CONTEXT,
    auth_user_id: input.ownerUserId,
    trial_idempotency_key: input.idempotencyKey,
  };
}

export function createSelfServiceTrialProfileRepository(
  client: SelfServiceTrialProfileQueryClient
): SelfServiceTrialProfileRepository {
  return {
    async getOrCreate(input) {
      const existing = await client
        .from('signup_requests')
        .select('id, org_id, status')
        .eq('source', 'public_lead')
        .contains('metadata', buildProfileLookupMetadata(input))
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      assertNoQueryError(existing.error, 'Failed to load trial customer profile.');

      if (existing.data) {
        return normalizeProfileRecord(existing.data, true);
      }

      const created = await client
        .from('signup_requests')
        .insert(buildSelfServiceTrialProfileInsert(input))
        .select('id, org_id, status')
        .single();
      assertNoQueryError(created.error, 'Failed to save trial customer profile.');
      return normalizeProfileRecord(created.data, false);
    },

    async markConverted(input) {
      const updated = await client
        .from('signup_requests')
        .update({
          org_id: input.orgId,
          status: 'converted',
          processed_at: input.convertedAt,
        })
        .eq('id', input.profileId)
        .eq('source', 'public_lead')
        .select('id')
        .maybeSingle();
      assertNoQueryError(updated.error, 'Failed to link trial customer profile.');

      if (!isRecord(updated.data) || !stringOrNull(updated.data.id)) {
        throw new Error('Trial customer profile was not found while linking workspace.');
      }
    },
  };
}

export function createDefaultSelfServiceTrialProfileRepository(): SelfServiceTrialProfileRepository {
  return createSelfServiceTrialProfileRepository(
    createUntypedAdminClient() as unknown as SelfServiceTrialProfileQueryClient
  );
}
