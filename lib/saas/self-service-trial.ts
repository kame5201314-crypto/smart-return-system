import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import {
  normalizeEmailIdentifier,
  normalizeTaiwanPhoneIdentifier,
  resolveVerifiedSignupAvailability,
} from '@/lib/auth/verified-signup';
import { createInMemoryRateLimiter } from '@/lib/security/request-rate-limit';
import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type {
  SaaSLeadContactChannel,
  SaaSMonthlyReturnBand,
} from '@/lib/saas/lead-capture';
import {
  createDefaultSelfServiceTrialProfileRepository,
  type SelfServiceTrialProfileRecord,
  type SelfServiceTrialProfileRepository,
} from '@/lib/saas/self-service-trial-profile';
import { isBetaInviteEmailAllowed } from '@/lib/saas/beta-invite-allowlist';
import {
  normalizeSelfServiceSaaSPlanCode,
  type SelfServiceSaaSPlanCode,
} from '@/lib/config/saas-plans';

export const CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION = '2026-07-15-v2';

export type SelfServiceTrialPlan = SelfServiceSaaSPlanCode;
export type SelfServiceTrialIdentityProvider = 'google' | 'email_otp' | 'phone_otp';

export type SelfServiceTrialErrorCode =
  | 'feature_disabled'
  | 'invite_required'
  | 'unauthenticated'
  | 'google_identity_required'
  | 'verified_identity_required'
  | 'invalid_request'
  | 'rate_limited'
  | 'trial_already_claimed'
  | 'profile_persistence_failed'
  | 'not_configured'
  | 'provision_failed';

export class SelfServiceTrialError extends Error {
  constructor(
    public readonly code: SelfServiceTrialErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SelfServiceTrialError';
  }
}

export interface SelfServiceTrialIdentity {
  userId: string;
  provider: SelfServiceTrialIdentityProvider;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface SelfServiceTrialInput {
  orgName: string;
  contactName: string;
  contactPhone: string;
  lineId: string | null;
  preferredContactChannel: SaaSLeadContactChannel;
  platform: string;
  monthlyReturnBand: SaaSMonthlyReturnBand;
  referralCode: string | null;
  plan: SelfServiceTrialPlan;
  termsVersion: string;
  idempotencyKey: string;
}

export interface SelfServiceTrialProvisioningInput extends SelfServiceTrialInput {
  ownerUserId: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  identityProvider: SelfServiceTrialIdentityProvider;
  termsAcceptedAt: string;
}

export interface SelfServiceTrialResult {
  orgId: string;
  subscriptionId: string | null;
  ownerMembershipId: string | null;
  auditLogId: string | null;
  claimId: string;
  trialEnd: string;
  reused: boolean;
}

export interface SelfServiceTrialRepository {
  provision(input: SelfServiceTrialProvisioningInput): Promise<SelfServiceTrialResult>;
}

export interface SelfServiceTrialRateLimiter {
  check(key: string, now?: Date): {
    allowed: boolean;
    retryAfterSeconds: number;
  };
}

const selfServiceTrialRateLimiter = createInMemoryRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 60 * 1000,
});

interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new SelfServiceTrialError('invalid_request', 400, `${field} is required.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      `${field} must contain 1 to ${maxLength} characters.`
    );
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new SelfServiceTrialError('invalid_request', 400, `${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      `${field} must contain at most ${maxLength} characters.`
    );
  }
  return normalized;
}

function normalizeContactPhone(value: unknown): string {
  const phone = requiredString(value, 'contactPhone', 40);
  try {
    return normalizeTaiwanPhoneIdentifier(phone);
  } catch {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      'contactPhone must be a valid Taiwan mobile number.'
    );
  }
}

function normalizePreferredContactChannel(value: unknown): SaaSLeadContactChannel {
  if (value === 'email' || value === 'phone' || value === 'line') return value;
  throw new SelfServiceTrialError(
    'invalid_request',
    400,
    'preferredContactChannel must be email, phone, or line.'
  );
}

function normalizeMonthlyReturnBand(value: unknown): SaaSMonthlyReturnBand {
  if (
    value === 'under_30' ||
    value === '30_100' ||
    value === '101_300' ||
    value === '301_800' ||
    value === 'over_800'
  ) return value;
  throw new SelfServiceTrialError(
    'invalid_request',
    400,
    'monthlyReturnBand is invalid.'
  );
}

function normalizePlan(value: unknown): SelfServiceTrialPlan {
  const plan = normalizeSelfServiceSaaSPlanCode(value);
  if (plan) return plan;
  throw new SelfServiceTrialError(
    'invalid_request',
    400,
    'plan must be basic.'
  );
}

function normalizeResult(value: unknown): SelfServiceTrialResult {
  if (!isRecord(value)) {
    throw new Error('Self-service trial RPC returned invalid data.');
  }

  const required = (field: string): string => {
    const result = value[field];
    if (typeof result !== 'string' || !result.trim()) {
      throw new Error(`Self-service trial RPC did not return ${field}.`);
    }
    return result.trim();
  };

  const optional = (field: string): string | null => {
    const result = value[field];
    return typeof result === 'string' && result.trim() ? result.trim() : null;
  };

  return {
    orgId: required('org_id'),
    subscriptionId: optional('subscription_id'),
    ownerMembershipId: optional('owner_membership_id'),
    auditLogId: optional('audit_log_id'),
    claimId: required('claim_id'),
    trialEnd: required('trial_end'),
    reused: value.reused === true,
  };
}

export function normalizeSelfServiceTrialInput(value: unknown): SelfServiceTrialInput {
  if (!isRecord(value)) {
    throw new SelfServiceTrialError('invalid_request', 400, 'Request body must be an object.');
  }

  if (value.termsAccepted !== true) {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      'You must accept the terms and privacy policy.'
    );
  }

  const termsVersion = requiredString(value.termsVersion, 'termsVersion', 80);
  if (termsVersion !== CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION) {
    throw new SelfServiceTrialError('invalid_request', 400, 'Terms version is outdated.');
  }

  return {
    orgName: requiredString(value.orgName, 'orgName', 120),
    contactName: requiredString(value.contactName, 'contactName', 120),
    contactPhone: normalizeContactPhone(value.contactPhone),
    lineId: optionalString(value.lineId, 'lineId', 80),
    preferredContactChannel: normalizePreferredContactChannel(
      value.preferredContactChannel
    ),
    platform: requiredString(value.platform, 'platform', 80),
    monthlyReturnBand: normalizeMonthlyReturnBand(value.monthlyReturnBand),
    referralCode: optionalString(value.referralCode, 'referralCode', 64),
    plan: normalizePlan(value.plan),
    termsVersion,
    idempotencyKey: requiredString(value.idempotencyKey, 'idempotencyKey', 100),
  };
}

export function buildSelfServiceTrialRpcArgs(
  input: SelfServiceTrialProvisioningInput
): Record<string, unknown> {
  return {
    p_owner_user_id: input.ownerUserId,
    p_owner_email: input.ownerEmail,
    p_org_name: input.orgName,
    p_plan: input.plan,
    p_terms_version: input.termsVersion,
    p_terms_accepted_at: input.termsAcceptedAt,
    p_idempotency_key: input.idempotencyKey,
  };
}

export function buildVerifiedIdentityTrialRpcArgs(
  input: SelfServiceTrialProvisioningInput
): Record<string, unknown> {
  return {
    p_owner_user_id: input.ownerUserId,
    p_identity_provider: input.identityProvider,
    p_owner_email: input.ownerEmail,
    p_owner_phone: input.ownerPhone,
    p_org_name: input.orgName,
    p_plan: input.plan,
    p_terms_version: input.termsVersion,
    p_terms_accepted_at: input.termsAcceptedAt,
    p_idempotency_key: input.idempotencyKey,
  };
}

export function createSelfServiceTrialRepository(client: RpcClient): SelfServiceTrialRepository {
  return {
    async provision(input) {
      const isGoogle = input.identityProvider === 'google';
      const { data, error } = await client.rpc(
        isGoogle
          ? 'create_google_self_service_trial'
          : 'create_verified_identity_self_service_trial',
        isGoogle
          ? buildSelfServiceTrialRpcArgs(input)
          : buildVerifiedIdentityTrialRpcArgs(input)
      );

      if (error) {
        const message = error.message || 'Failed to provision self-service trial.';
        if (
          message.includes('already has organization membership') ||
          message.includes('trial already claimed')
        ) {
          throw new SelfServiceTrialError(
            'trial_already_claimed',
            409,
            'This identity has already used or joined a trial workspace.'
          );
        }
        if (
          message.includes('verified auth') ||
          message.includes('verified Taiwan mobile') ||
          message.includes('identity provider does not match')
        ) {
          throw new SelfServiceTrialError(
            input.identityProvider === 'google'
              ? 'google_identity_required'
              : 'verified_identity_required',
            403,
            'A matching verified identity is required.'
          );
        }
        if (
          message.includes('create_verified_identity_self_service_trial') ||
          message.includes('schema cache') ||
          message.includes('Could not find the function')
        ) {
          throw new SelfServiceTrialError(
            'not_configured',
            503,
            'Verified trial provisioning is not configured.'
          );
        }
        throw new SelfServiceTrialError(
          'provision_failed',
          500,
          'Failed to provision self-service trial.'
        );
      }

      return normalizeResult(data);
    },
  };
}

export function createDefaultSelfServiceTrialRepository(): SelfServiceTrialRepository {
  return createSelfServiceTrialRepository(createUntypedAdminClient());
}

function requireEnabledIdentityProvider(
  identity: SelfServiceTrialIdentity,
  flags: ReturnType<typeof resolveSaaSFeatureFlags>,
  env: Record<string, string | undefined> | undefined
): void {
  if (identity.provider === 'google') {
    if (!flags.google_auth || !flags.google_trial_signup) {
      throw new SelfServiceTrialError(
        'feature_disabled',
        403,
        'Google self-service trial signup is not enabled.'
      );
    }
    if (!identity.emailVerified || !identity.email) {
      throw new SelfServiceTrialError(
        'google_identity_required',
        403,
        'A verified Google email is required.'
      );
    }
    return;
  }

  const availability = resolveVerifiedSignupAvailability(env);
  const enabled = identity.provider === 'email_otp'
    ? flags.email_otp_signup && availability.emailEnabled
    : flags.phone_otp_signup && availability.phoneEnabled;
  if (!enabled) {
    throw new SelfServiceTrialError(
      'feature_disabled',
      403,
      'Verified self-service signup is not enabled for this identity.'
    );
  }

  const verified = identity.provider === 'email_otp'
    ? identity.emailVerified && Boolean(identity.email)
    : identity.phoneVerified && Boolean(identity.phone);
  if (!verified) {
    throw new SelfServiceTrialError(
      'verified_identity_required',
      403,
      'A verified email or phone identity is required.'
    );
  }
}

function requireBetaInvite(
  identity: SelfServiceTrialIdentity,
  env: Record<string, string | undefined> | undefined
): void {
  if (isBetaInviteEmailAllowed(identity.email, env)) return;

  throw new SelfServiceTrialError(
    'invite_required',
    403,
    'This closed Beta is available only to invited email addresses.'
  );
}

export async function provisionSelfServiceTrial(
  value: unknown,
  options: {
    identity: SelfServiceTrialIdentity | null;
    env?: Record<string, string | undefined>;
    repository?: SelfServiceTrialRepository;
    profileRepository?: SelfServiceTrialProfileRepository;
    rateLimiter?: SelfServiceTrialRateLimiter;
    now?: Date;
  }
): Promise<SelfServiceTrialResult> {
  const flags = resolveSaaSFeatureFlags({
    env: options.env,
    orgPlan: 'basic',
  });
  if (!options.identity) {
    throw new SelfServiceTrialError('unauthenticated', 401, 'Authentication required.');
  }

  requireEnabledIdentityProvider(options.identity, flags, options.env);
  requireBetaInvite(options.identity, options.env);

  const rateLimit = (options.rateLimiter ?? selfServiceTrialRateLimiter).check(
    `saas_self_service_trial:${options.identity.userId}`,
    options.now
  );
  if (!rateLimit.allowed) {
    throw new SelfServiceTrialError(
      'rate_limited',
      429,
      `Too many self-service trial requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`
    );
  }

  let ownerEmail: string | null = null;
  let ownerPhone: string | null = null;
  try {
    if (options.identity.email && options.identity.emailVerified) {
      ownerEmail = normalizeEmailIdentifier(options.identity.email);
    }
    if (
      options.identity.provider === 'phone_otp' &&
      options.identity.phone &&
      options.identity.phoneVerified
    ) {
      ownerPhone = normalizeTaiwanPhoneIdentifier(options.identity.phone);
    }
  } catch {
    throw new SelfServiceTrialError(
      options.identity.provider === 'google'
        ? 'google_identity_required'
        : 'verified_identity_required',
      403,
      'Verified identity data is invalid.'
    );
  }

  const input = normalizeSelfServiceTrialInput(value);
  if (input.preferredContactChannel === 'email' && !ownerEmail) {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      'A verified email is required for email contact preference.'
    );
  }
  if (input.preferredContactChannel === 'line' && !input.lineId) {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      'lineId is required for line contact preference.'
    );
  }

  // A verified phone identity is the source of truth for its contact phone.
  // Google and Email identities may still supply a format-validated, unverified
  // contact phone, which is marked accordingly in profile metadata.
  const effectiveInput: SelfServiceTrialInput = {
    ...input,
    contactPhone: ownerPhone ?? input.contactPhone,
  };

  const acceptedAt = (options.now ?? new Date()).toISOString();
  let profileRepository = options.profileRepository;
  if (!profileRepository) {
    try {
      profileRepository = createDefaultSelfServiceTrialProfileRepository();
    } catch {
      throw new SelfServiceTrialError(
        'not_configured',
        503,
        'Trial customer profile persistence is not configured.'
      );
    }
  }

  let customerProfile: SelfServiceTrialProfileRecord;
  try {
    customerProfile = await profileRepository.getOrCreate({
      ...effectiveInput,
      ownerUserId: options.identity.userId,
      identityProvider: options.identity.provider,
      ownerEmail,
      ownerPhone,
      termsAcceptedAt: acceptedAt,
    });
  } catch {
    throw new SelfServiceTrialError(
      'profile_persistence_failed',
      500,
      'Failed to save trial customer profile.'
    );
  }

  let repository = options.repository;
  if (!repository) {
    try {
      repository = createDefaultSelfServiceTrialRepository();
    } catch {
      throw new SelfServiceTrialError(
        'not_configured',
        503,
        'Self-service trial persistence is not configured.'
      );
    }
  }

  const result = await repository.provision({
    ...effectiveInput,
    ownerUserId: options.identity.userId,
    ownerEmail,
    ownerPhone,
    identityProvider: options.identity.provider,
    termsAcceptedAt: acceptedAt,
  });

  if (customerProfile.orgId && customerProfile.orgId !== result.orgId) {
    throw new SelfServiceTrialError(
      'profile_persistence_failed',
      500,
      'Trial customer profile is linked to a different workspace.'
    );
  }

  try {
    await profileRepository.markConverted({
      profileId: customerProfile.id,
      orgId: result.orgId,
      convertedAt: acceptedAt,
    });
  } catch {
    throw new SelfServiceTrialError(
      'profile_persistence_failed',
      500,
      'Failed to link trial customer profile.'
    );
  }

  return result;
}
