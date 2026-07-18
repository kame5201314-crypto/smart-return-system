import {
  normalizeSaaSSubscriptionStatus,
  type SaaSSubscriptionStatus,
} from '@/lib/saas/subscription-access';
import { ADMIN_UUID } from '@/lib/auth/admin-session';

export type PlatformBillingOperation =
  | 'mark_manual_payment'
  | 'suspend_org'
  | 'resume_org'
  | 'request_refund';

export type PlatformBillingOperationErrorCode =
  | 'invalid_request'
  | 'operation_failed';

export interface PlatformBillingOperationInput {
  operation: PlatformBillingOperation;
  orgId: string;
  actorUserId: string;
  reason: string | null;
  amountTwd: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  effectiveAt: string;
  idempotencyKey: string | null;
  invoiceId: string | null;
  metadata: Record<string, unknown>;
}

export interface PlatformBillingOperationResult {
  operation: PlatformBillingOperation;
  orgId: string;
  subscriptionId: string | null;
  auditLogId: string | null;
  billingEventId: string | null;
  invoiceId: string | null;
  nextStatus: SaaSSubscriptionStatus | null;
}

export interface PlatformBillingOperationsRepository {
  performBillingOperation(
    input: PlatformBillingOperationInput
  ): Promise<PlatformBillingOperationResult>;
}

interface SupabaseRpcError {
  message?: string;
}

interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: SupabaseRpcError | null }>;
}

export class PlatformBillingOperationError extends Error {
  constructor(
    public readonly code: PlatformBillingOperationErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PlatformBillingOperationError';
  }
}

const VALID_OPERATIONS: readonly PlatformBillingOperation[] = [
  'mark_manual_payment',
  'suspend_org',
  'resume_org',
  'request_refund',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT_TWD = 100_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function failInvalid(message: string): never {
  throw new PlatformBillingOperationError('invalid_request', 400, message);
}

function requireString(value: unknown, field: string, maxLength: number): string {
  const normalized = stringOrUndefined(value);
  if (!normalized) {
    failInvalid(`${field} is required.`);
  }
  if (normalized.length > maxLength) {
    failInvalid(`${field} is too long.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null {
  const normalized = stringOrUndefined(value);
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    failInvalid(`${field} is too long.`);
  }
  return normalized;
}

function requireUuid(value: unknown, field: string): string {
  const normalized = requireString(value, field, 64);
  if (!UUID_PATTERN.test(normalized)) {
    failInvalid(`${field} must be a valid UUID.`);
  }
  return normalized;
}

function requireActorUserId(value: unknown): string {
  const normalized = requireString(value, 'actorUserId', 64);
  if (normalized.toLowerCase() === ADMIN_UUID) {
    return ADMIN_UUID;
  }
  if (!UUID_PATTERN.test(normalized)) {
    failInvalid('actorUserId must be a valid UUID.');
  }
  return normalized;
}

function optionalUuid(value: unknown, field: string): string | null {
  const normalized = optionalString(value, field, 64);
  if (!normalized) {
    return null;
  }
  if (!UUID_PATTERN.test(normalized)) {
    failInvalid(`${field} must be a valid UUID.`);
  }
  return normalized;
}

function normalizeOperation(value: unknown): PlatformBillingOperation {
  const normalized = stringOrUndefined(value);
  if (VALID_OPERATIONS.includes(normalized as PlatformBillingOperation)) {
    return normalized as PlatformBillingOperation;
  }
  failInvalid('operation must be one of mark_manual_payment, suspend_org, resume_org, request_refund.');
}

function normalizeAmount(value: unknown, field: string, required: boolean): number | null {
  if (value === undefined || value === null || value === '') {
    if (required) {
      failInvalid(`${field} is required.`);
    }
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_AMOUNT_TWD) {
    failInvalid(`${field} must be a positive integer amount in TWD.`);
  }
  return parsed;
}

function normalizeIsoDate(value: unknown, field: string, required: boolean): string | null {
  const normalized = stringOrUndefined(value);
  if (!normalized) {
    if (required) {
      failInvalid(`${field} is required.`);
    }
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    failInvalid(`${field} must be an ISO date string.`);
  }
  return parsed.toISOString();
}

function requireReason(value: unknown, operation: PlatformBillingOperation): string {
  return requireString(value, `${operation}.reason`, 500);
}

function normalizeOptionalReason(value: unknown): string | null {
  return optionalString(value, 'reason', 500);
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    failInvalid('metadata must be an object.');
  }
  return value;
}

function assertPeriodOrder(periodStart: string | null, periodEnd: string | null): void {
  if (!periodStart || !periodEnd) {
    return;
  }

  if (new Date(periodEnd).getTime() <= new Date(periodStart).getTime()) {
    failInvalid('periodEnd must be later than periodStart.');
  }
}

function assertManualPaymentEndAfterEffectiveAt(
  periodEnd: string | null,
  effectiveAt: string
): void {
  if (!periodEnd || new Date(periodEnd).getTime() <= new Date(effectiveAt).getTime()) {
    failInvalid('periodEnd must be later than effectiveAt.');
  }
}

function normalizeOperationFromRpc(value: unknown): PlatformBillingOperation {
  if (VALID_OPERATIONS.includes(value as PlatformBillingOperation)) {
    return value as PlatformBillingOperation;
  }
  throw new Error('Billing operation RPC returned an invalid operation.');
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRpcResult(data: unknown): PlatformBillingOperationResult {
  if (!isRecord(data)) {
    throw new Error('Billing operation RPC returned invalid data.');
  }

  const orgId = stringOrNull(data.org_id);
  if (!orgId) {
    throw new Error('Billing operation RPC did not return org_id.');
  }

  const rawStatus = stringOrNull(data.next_status);

  return {
    operation: normalizeOperationFromRpc(data.operation),
    orgId,
    subscriptionId: stringOrNull(data.subscription_id),
    auditLogId: stringOrNull(data.audit_log_id),
    billingEventId: stringOrNull(data.billing_event_id),
    invoiceId: stringOrNull(data.invoice_id),
    nextStatus: rawStatus ? normalizeSaaSSubscriptionStatus(rawStatus) : null,
  };
}

export function normalizePlatformBillingOperationRequest(
  value: unknown,
  actorUserId: string,
  now = new Date()
): PlatformBillingOperationInput {
  if (!isRecord(value)) {
    failInvalid('Request body must be an object.');
  }

  const operation = normalizeOperation(value.operation);
  const orgId = requireUuid(value.orgId, 'orgId');
  const effectiveAt =
    normalizeIsoDate(value.effectiveAt ?? value.paidAt, 'effectiveAt', false) ??
    now.toISOString();
  const metadata = normalizeMetadata(value.metadata);

  if (operation === 'mark_manual_payment') {
    const periodStart = normalizeIsoDate(value.periodStart, 'periodStart', false);
    const periodEnd = normalizeIsoDate(value.periodEnd, 'periodEnd', true);
    assertPeriodOrder(periodStart, periodEnd);
    assertManualPaymentEndAfterEffectiveAt(periodEnd, effectiveAt);

    return {
      operation,
      orgId,
      actorUserId: requireActorUserId(actorUserId),
      reason: normalizeOptionalReason(value.reason),
      amountTwd: normalizeAmount(value.amountTwd, 'amountTwd', true),
      periodStart,
      periodEnd,
      effectiveAt,
      idempotencyKey: optionalString(value.idempotencyKey, 'idempotencyKey', 160),
      invoiceId: optionalUuid(value.invoiceId, 'invoiceId'),
      metadata,
    };
  }

  if (operation === 'request_refund') {
    return {
      operation,
      orgId,
      actorUserId: requireActorUserId(actorUserId),
      reason: requireReason(value.reason, operation),
      amountTwd: normalizeAmount(value.amountTwd, 'amountTwd', true),
      periodStart: null,
      periodEnd: null,
      effectiveAt,
      idempotencyKey: optionalString(value.idempotencyKey, 'idempotencyKey', 160),
      invoiceId: optionalUuid(value.invoiceId, 'invoiceId'),
      metadata,
    };
  }

  return {
    operation,
    orgId,
    actorUserId: requireActorUserId(actorUserId),
    reason: requireReason(value.reason, operation),
    amountTwd: null,
    periodStart: null,
    periodEnd: operation === 'resume_org'
      ? normalizeIsoDate(value.periodEnd, 'periodEnd', false)
      : null,
    effectiveAt,
    idempotencyKey: null,
    invoiceId: null,
    metadata,
  };
}

export function buildPlatformBillingOperationRpcArgs(
  input: PlatformBillingOperationInput
): Record<string, unknown> {
  const isLegacyAdmin = input.actorUserId.toLowerCase() === ADMIN_UUID;
  const metadata = isLegacyAdmin
    ? {
        ...input.metadata,
        actorSubject: 'legacy_admin_session',
        actorPrincipalId: ADMIN_UUID,
      }
    : input.metadata;

  return {
    p_operation: input.operation,
    p_org_id: input.orgId,
    p_actor_user_id: isLegacyAdmin ? null : input.actorUserId,
    p_reason: input.reason,
    p_amount_twd: input.amountTwd,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_effective_at: input.effectiveAt,
    p_idempotency_key: input.idempotencyKey,
    p_invoice_id: input.invoiceId,
    p_metadata: metadata,
  };
}

export function createPlatformBillingOperationsRepository(
  client: SupabaseRpcClient
): PlatformBillingOperationsRepository {
  return {
    async performBillingOperation(input) {
      const { data, error } = await client.rpc(
        'perform_platform_billing_operation',
        buildPlatformBillingOperationRpcArgs(input)
      );

      if (error) {
        throw new PlatformBillingOperationError(
          'operation_failed',
          500,
          error.message || 'Failed to perform platform billing operation.'
        );
      }

      return normalizeRpcResult(data);
    },
  };
}
