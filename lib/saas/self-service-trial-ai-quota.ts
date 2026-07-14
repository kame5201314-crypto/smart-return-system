export const SELF_SERVICE_TRIAL_AI_LIMIT = 1;

export type SelfServiceTrialAIReservationReason =
  | 'reserved'
  | 'not_self_service_trial'
  | 'paid_plan'
  | 'limit_reached'
  | 'in_progress'
  | 'trial_inactive';

export type SelfServiceTrialAIQuotaErrorCode =
  | 'trial_ai_quota_exceeded'
  | 'trial_ai_analysis_in_progress'
  | 'trial_inactive'
  | 'trial_ai_quota_unavailable';

export interface SelfServiceTrialAIQuotaSnapshot {
  applies: boolean;
  limit: number;
  used: number;
  remaining: number;
  reason: SelfServiceTrialAIReservationReason;
  completedAt: string | null;
}

export class SelfServiceTrialAIQuotaError extends Error {
  constructor(
    public readonly code: SelfServiceTrialAIQuotaErrorCode,
    public readonly status: number,
    public readonly quota: SelfServiceTrialAIQuotaSnapshot,
    message: string
  ) {
    super(message);
    this.name = 'SelfServiceTrialAIQuotaError';
  }
}

export interface SelfServiceTrialAIReservation {
  orgId: string;
  claimId: string;
  reservationToken: string;
  reservedAt: string;
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface SelfServiceTrialAIQuotaRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
}

export interface SelfServiceTrialAIQuotaRepository {
  reserve(orgId: string, effectiveAt: string): Promise<SelfServiceTrialAIReservation | null>;
  complete(reservation: SelfServiceTrialAIReservation, effectiveAt: string): Promise<void>;
  release(reservation: SelfServiceTrialAIReservation): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Trial AI quota RPC did not return ${field}.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeReason(value: unknown): SelfServiceTrialAIReservationReason {
  if (
    value === 'reserved'
    || value === 'not_self_service_trial'
    || value === 'paid_plan'
    || value === 'limit_reached'
    || value === 'in_progress'
    || value === 'trial_inactive'
  ) {
    return value;
  }
  throw new Error('Trial AI quota RPC returned an unknown reason.');
}

function quotaSnapshot(input: {
  applies: boolean;
  used: number;
  reason: SelfServiceTrialAIReservationReason;
  completedAt?: string | null;
}): SelfServiceTrialAIQuotaSnapshot {
  return {
    applies: input.applies,
    limit: SELF_SERVICE_TRIAL_AI_LIMIT,
    used: input.used,
    remaining: Math.max(SELF_SERVICE_TRIAL_AI_LIMIT - input.used, 0),
    reason: input.reason,
    completedAt: input.completedAt ?? null,
  };
}

function blockedError(
  reason: Exclude<
    SelfServiceTrialAIReservationReason,
    'reserved' | 'not_self_service_trial' | 'paid_plan'
  >,
  completedAt: string | null
): SelfServiceTrialAIQuotaError {
  if (reason === 'limit_reached') {
    return new SelfServiceTrialAIQuotaError(
      'trial_ai_quota_exceeded',
      402,
      quotaSnapshot({ applies: true, used: 1, reason, completedAt }),
      'The single AI analysis included with this trial has already been used.'
    );
  }
  if (reason === 'in_progress') {
    return new SelfServiceTrialAIQuotaError(
      'trial_ai_analysis_in_progress',
      409,
      quotaSnapshot({ applies: true, used: 0, reason }),
      'A trial AI analysis is already in progress. Please wait before trying again.'
    );
  }
  return new SelfServiceTrialAIQuotaError(
    'trial_inactive',
    402,
    quotaSnapshot({ applies: true, used: 0, reason }),
    'This self-service trial is no longer active.'
  );
}

function rpcFailure(message?: string): SelfServiceTrialAIQuotaError {
  return new SelfServiceTrialAIQuotaError(
    'trial_ai_quota_unavailable',
    503,
    quotaSnapshot({ applies: true, used: 0, reason: 'in_progress' }),
    message || 'Trial AI quota service is unavailable.'
  );
}

export function createSelfServiceTrialAIQuotaRepository(
  client: SelfServiceTrialAIQuotaRpcClient
): SelfServiceTrialAIQuotaRepository {
  return {
    async reserve(orgId, effectiveAt) {
      const { data, error } = await client.rpc(
        'reserve_google_self_service_trial_ai_analysis',
        { p_org_id: orgId, p_effective_at: effectiveAt }
      );
      if (error) throw rpcFailure(error.message);
      if (!isRecord(data)) throw rpcFailure('Trial AI quota RPC returned invalid data.');

      const reason = normalizeReason(data.reason);
      if (reason === 'not_self_service_trial' || reason === 'paid_plan') return null;
      if (reason !== 'reserved') {
        throw blockedError(reason, optionalString(data.completed_at));
      }

      return {
        orgId,
        claimId: requiredString(data.claim_id, 'claim_id'),
        reservationToken: requiredString(data.reservation_token, 'reservation_token'),
        reservedAt: requiredString(data.reserved_at, 'reserved_at'),
      };
    },

    async complete(reservation, effectiveAt) {
      const { data, error } = await client.rpc(
        'complete_google_self_service_trial_ai_analysis',
        {
          p_org_id: reservation.orgId,
          p_reservation_token: reservation.reservationToken,
          p_effective_at: effectiveAt,
        }
      );
      if (error) throw rpcFailure(error.message);
      if (!isRecord(data) || data.completed !== true) {
        throw rpcFailure('Trial AI reservation could not be completed.');
      }
    },

    async release(reservation) {
      const { error } = await client.rpc(
        'release_google_self_service_trial_ai_analysis',
        {
          p_org_id: reservation.orgId,
          p_reservation_token: reservation.reservationToken,
        }
      );
      if (error) throw rpcFailure(error.message);
    },
  };
}

export async function reserveSelfServiceTrialAIAnalysis(input: {
  enabled: boolean;
  orgId: string;
  repository: SelfServiceTrialAIQuotaRepository;
  now?: Date;
}): Promise<SelfServiceTrialAIReservation | null> {
  if (!input.enabled) return null;
  return input.repository.reserve(
    input.orgId,
    (input.now ?? new Date()).toISOString()
  );
}
