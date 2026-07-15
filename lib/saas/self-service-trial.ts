import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { createInMemoryRateLimiter } from '@/lib/security/request-rate-limit';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export const CURRENT_SELF_SERVICE_TRIAL_TERMS_VERSION = '2026-07-15-v2';

export type SelfServiceTrialPlan = 'basic' | 'growth';

export type SelfServiceTrialErrorCode =
  | 'feature_disabled'
  | 'unauthenticated'
  | 'google_identity_required'
  | 'invalid_request'
  | 'rate_limited'
  | 'trial_already_claimed'
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
  email: string;
  hasGoogleIdentity: boolean;
}

export interface SelfServiceTrialInput {
  orgName: string;
  plan: SelfServiceTrialPlan;
  termsVersion: string;
  idempotencyKey: string;
}

export interface SelfServiceTrialProvisioningInput extends SelfServiceTrialInput {
  ownerUserId: string;
  ownerEmail: string;
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

function normalizePlan(value: unknown): SelfServiceTrialPlan {
  if (value === 'basic' || value === 'growth') return value;
  throw new SelfServiceTrialError(
    'invalid_request',
    400,
    'plan must be basic or growth.'
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

export function createSelfServiceTrialRepository(client: RpcClient): SelfServiceTrialRepository {
  return {
    async provision(input) {
      const { data, error } = await client.rpc(
        'create_google_self_service_trial',
        buildSelfServiceTrialRpcArgs(input)
      );

      if (error) {
        const message = error.message || 'Failed to provision self-service trial.';
        if (
          message.includes('already has organization membership') ||
          message.includes('trial already claimed')
        ) {
          throw new SelfServiceTrialError('trial_already_claimed', 409, message);
        }
        throw new SelfServiceTrialError('provision_failed', 500, message);
      }

      return normalizeResult(data);
    },
  };
}

export function createDefaultSelfServiceTrialRepository(): SelfServiceTrialRepository {
  return createSelfServiceTrialRepository(createUntypedAdminClient());
}

export async function provisionSelfServiceTrial(
  value: unknown,
  options: {
    identity: SelfServiceTrialIdentity | null;
    env?: Record<string, string | undefined>;
    repository?: SelfServiceTrialRepository;
    rateLimiter?: SelfServiceTrialRateLimiter;
    now?: Date;
  }
): Promise<SelfServiceTrialResult> {
  const flags = resolveSaaSFeatureFlags({
    env: options.env,
    orgPlan: 'basic',
  });
  if (!flags.google_auth || !flags.google_trial_signup) {
    throw new SelfServiceTrialError(
      'feature_disabled',
      403,
      'Google self-service trial signup is not enabled.'
    );
  }

  if (!options.identity) {
    throw new SelfServiceTrialError('unauthenticated', 401, 'Authentication required.');
  }

  if (!options.identity.hasGoogleIdentity) {
    throw new SelfServiceTrialError(
      'google_identity_required',
      403,
      'A verified Google identity is required.'
    );
  }

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

  const ownerEmail = options.identity.email.trim().toLowerCase();
  if (!ownerEmail || !ownerEmail.includes('@')) {
    throw new SelfServiceTrialError(
      'google_identity_required',
      403,
      'A verified Google email is required.'
    );
  }

  const input = normalizeSelfServiceTrialInput(value);
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

  return repository.provision({
    ...input,
    ownerUserId: options.identity.userId,
    ownerEmail,
    termsAcceptedAt: (options.now ?? new Date()).toISOString(),
  });
}
