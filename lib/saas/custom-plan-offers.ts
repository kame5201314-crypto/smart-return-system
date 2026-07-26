import { createHash } from 'node:crypto';

import { ADMIN_UUID } from '@/lib/auth/admin-session';
import type {
  ECPayPaymentOrder,
  ECPayProviderMode,
} from '@/lib/saas/billing-ecpay';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type CustomPlanOfferStatus = 'active' | 'paid' | 'cancelled' | 'expired';

export type CustomPlanOfferAuditActorKind =
  | 'legacy_admin'
  | 'authenticated_platform_admin';

export type CustomPlanOfferAuditPlatformRole = 'owner' | 'support' | 'billing';

export interface CustomPlanOfferOperatorContext {
  userId: string;
  platformRole: CustomPlanOfferAuditPlatformRole;
}

export interface CustomPlanOfferAuditActorMetadata {
  actorKind: CustomPlanOfferAuditActorKind;
  actorFingerprintSha256: string;
  platformRole: CustomPlanOfferAuditPlatformRole;
}

export type CustomPlanOfferErrorCode =
  | 'invalid_request'
  | 'permission_denied'
  | 'feature_disabled'
  | 'offer_not_found'
  | 'offer_unavailable'
  | 'offer_conflict'
  | 'checkout_rate_limited'
  | 'request_failed';

export interface CustomPlanOffer {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  amountTwd: number;
  plan: 'basic';
  billingPeriodMonths: 1;
  status: CustomPlanOfferStatus;
  expiresAt: string;
  paymentOrderId: string | null;
  createdBy: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomPlanOfferInput {
  [key: string]: unknown;
  orgId: string;
  actorUserId: string | null;
  actorMetadata: CustomPlanOfferAuditActorMetadata;
  title: string;
  description: string | null;
  amountTwd: number;
  expiresAt: string;
}

export interface CancelCustomPlanOfferInput {
  offerId: string;
  actorUserId: string | null;
  actorMetadata: CustomPlanOfferAuditActorMetadata;
  reason: string;
}

export interface CreateCustomPlanPaymentOrderInput {
  offerId: string;
  orgId: string;
  actorUserId: string;
  provider: 'ecpay';
  providerMode: ECPayProviderMode;
  merchantId: string;
  merchantTradeNo: string;
  idempotencyKey: string;
}

export type CustomOfferPaymentOrder = ECPayPaymentOrder & {
  plan: 'basic';
  metadata: Record<string, unknown>;
};

export interface CustomPlanOfferRepository {
  createOffer(input: CreateCustomPlanOfferInput): Promise<CustomPlanOffer>;
  cancelOffer(input: CancelCustomPlanOfferInput): Promise<CustomPlanOffer>;
  listOffers(input: { orgId: string; limit?: number }): Promise<CustomPlanOffer[]>;
  createPaymentOrder(
    input: CreateCustomPlanPaymentOrderInput
  ): Promise<CustomOfferPaymentOrder>;
}

interface RepositoryError {
  code?: string;
  message?: string;
}

interface RepositoryResult {
  data: unknown;
  error: RepositoryError | null;
}

interface QueryBuilder extends PromiseLike<RepositoryResult> {
  eq(column: string, value: string): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(value: number): QueryBuilder;
  maybeSingle(): PromiseLike<RepositoryResult>;
}

interface QueryRoot {
  select(columns: string): QueryBuilder;
}

export interface CustomPlanOfferQueryClient {
  from(table: string): QueryRoot;
  rpc(
    functionName: string,
    params: Record<string, unknown>
  ): PromiseLike<RepositoryResult>;
}

export class CustomPlanOfferError extends Error {
  constructor(
    public readonly code: CustomPlanOfferErrorCode,
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = 'CustomPlanOfferError';
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MERCHANT_TRADE_NO_PATTERN = /^[A-Za-z0-9]{1,20}$/;
const PRINTABLE_TEXT_PATTERN = /[\u0000-\u001f\u007f]/;
const OFFER_STATUSES: readonly CustomPlanOfferStatus[] = [
  'active',
  'paid',
  'cancelled',
  'expired',
];
const MIN_OFFER_AMOUNT_TWD = 5;
const MAX_OFFER_AMOUNT_TWD = 199_999;
// Keep one minute between application validation and the database's strict
// one-hour boundary so an otherwise valid offer cannot expire in transit.
const MIN_OFFER_LIFETIME_MS = 61 * 60 * 1000;
const MAX_OFFER_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const OPERATOR_FINGERPRINT_NAMESPACE =
  'smart-return/custom-plan-offer/operator-audit/v1';
const AUDIT_PLATFORM_ROLES: readonly CustomPlanOfferAuditPlatformRole[] = [
  'owner',
  'support',
  'billing',
];

function invalid(message: string): never {
  throw new CustomPlanOfferError('invalid_request', 400, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return isRecord(value[0]) ? value[0] : null;
  }
  return isRecord(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function integerOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function requireString(
  value: unknown,
  field: string,
  minimumLength: number,
  maximumLength: number
): string {
  const normalized = stringOrNull(value);
  if (
    !normalized
    || normalized.length < minimumLength
    || normalized.length > maximumLength
    || PRINTABLE_TEXT_PATTERN.test(normalized)
  ) {
    invalid(`${field} must contain ${minimumLength}-${maximumLength} printable characters.`);
  }
  return normalized;
}

function requireECPayOfferTitle(value: unknown): string {
  const normalized = requireString(value, 'title', 2, 80);
  if (normalized.includes('#')) {
    invalid('title cannot contain the ECPay item separator #.');
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maximumLength: number): string | null {
  const normalized = stringOrNull(value);
  if (!normalized) return null;
  if (normalized.length > maximumLength || PRINTABLE_TEXT_PATTERN.test(normalized)) {
    invalid(`${field} must contain at most ${maximumLength} printable characters.`);
  }
  return normalized;
}

export function isCustomPlanOfferId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

export function normalizeCustomPlanOfferId(value: unknown): string {
  if (!isCustomPlanOfferId(value)) {
    invalid('offerId must be a valid UUID.');
  }
  return value.trim().toLowerCase();
}

function normalizeOrgId(value: unknown): string {
  if (!isCustomPlanOfferId(value)) {
    invalid('orgId must be a valid UUID.');
  }
  return value.trim().toLowerCase();
}

function normalizeActorUserId(value: unknown, required: boolean): string | null {
  if (value === null || value === undefined || value === '') {
    if (required) invalid('actorUserId must be a valid authenticated user UUID.');
    return null;
  }
  const rawValue = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (rawValue === ADMIN_UUID) {
    if (required) invalid('A merchant checkout requires an authenticated user.');
    return null;
  }
  if (!isCustomPlanOfferId(rawValue)) {
    invalid('actorUserId must be a valid UUID.');
  }
  return rawValue;
}

function normalizeOperatorContext(
  value: CustomPlanOfferOperatorContext
): {
  actorUserId: string | null;
  actorMetadata: CustomPlanOfferAuditActorMetadata;
} {
  const rawUserId = typeof value?.userId === 'string'
    ? value.userId.trim().toLowerCase()
    : '';
  if (rawUserId !== ADMIN_UUID && !isCustomPlanOfferId(rawUserId)) {
    invalid('operator userId must be a valid UUID.');
  }
  const platformRole = typeof value?.platformRole === 'string'
    ? value.platformRole.trim().toLowerCase()
    : '';
  if (!AUDIT_PLATFORM_ROLES.includes(platformRole as CustomPlanOfferAuditPlatformRole)) {
    invalid('operator platformRole must be owner, support, or billing.');
  }

  const actorKind: CustomPlanOfferAuditActorKind = rawUserId === ADMIN_UUID
    ? 'legacy_admin'
    : 'authenticated_platform_admin';
  const actorUserId = normalizeActorUserId(rawUserId, false);
  const actorFingerprintSha256 = createHash('sha256')
    .update(`${OPERATOR_FINGERPRINT_NAMESPACE}:${actorKind}:${rawUserId}`, 'utf8')
    .digest('hex');

  return {
    actorUserId,
    actorMetadata: {
      actorKind,
      actorFingerprintSha256,
      platformRole: platformRole as CustomPlanOfferAuditPlatformRole,
    },
  };
}

function normalizeOfferAmount(value: unknown): number {
  const parsed = integerOrNull(value);
  if (
    parsed === null
    || parsed < MIN_OFFER_AMOUNT_TWD
    || parsed > MAX_OFFER_AMOUNT_TWD
  ) {
    invalid(`amountTwd must be an integer between ${MIN_OFFER_AMOUNT_TWD} and ${MAX_OFFER_AMOUNT_TWD}.`);
  }
  return parsed;
}

function normalizeExpiresAt(value: unknown, now: Date): string {
  const normalized = stringOrNull(value);
  if (!normalized) invalid('expiresAt is required.');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) invalid('expiresAt must be a valid ISO date.');
  const lifetimeMs = parsed.getTime() - now.getTime();
  if (lifetimeMs < MIN_OFFER_LIFETIME_MS || lifetimeMs > MAX_OFFER_LIFETIME_MS) {
    invalid('expiresAt must be between 61 minutes and 90 days from now.');
  }
  return parsed.toISOString();
}

function normalizeOfferStatus(value: unknown): CustomPlanOfferStatus {
  if (OFFER_STATUSES.includes(value as CustomPlanOfferStatus)) {
    return value as CustomPlanOfferStatus;
  }
  throw new CustomPlanOfferError(
    'request_failed',
    500,
    'Custom plan offer returned an invalid status.'
  );
}

function requireRowString(value: unknown, field: string): string {
  const normalized = stringOrNull(value);
  if (!normalized) {
    throw new CustomPlanOfferError(
      'request_failed',
      500,
      `Custom plan offer is missing ${field}.`
    );
  }
  return normalized;
}

function normalizeOffer(value: unknown): CustomPlanOffer {
  const row = firstRecord(value);
  if (!row) {
    throw new CustomPlanOfferError(
      'request_failed',
      500,
      'Custom plan offer repository returned invalid data.'
    );
  }

  const amountTwd = integerOrNull(row.amount_twd ?? row.amountTwd);
  const billingPeriodMonths = integerOrNull(
    row.billing_period_months ?? row.billingPeriodMonths
  );
  const plan = stringOrNull(row.plan)?.toLowerCase();
  if (
    amountTwd === null
    || amountTwd < MIN_OFFER_AMOUNT_TWD
    || amountTwd > MAX_OFFER_AMOUNT_TWD
    || billingPeriodMonths !== 1
    || plan !== 'basic'
  ) {
    throw new CustomPlanOfferError(
      'request_failed',
      500,
      'Custom plan offer returned invalid pricing data.'
    );
  }

  return {
    id: requireRowString(row.id, 'id'),
    orgId: requireRowString(row.org_id ?? row.orgId, 'org_id'),
    title: requireRowString(row.title, 'title'),
    description: stringOrNull(row.description),
    amountTwd,
    plan: 'basic',
    billingPeriodMonths: 1,
    status: normalizeOfferStatus(row.status),
    expiresAt: requireRowString(row.expires_at ?? row.expiresAt, 'expires_at'),
    paymentOrderId: stringOrNull(row.payment_order_id ?? row.paymentOrderId),
    createdBy: stringOrNull(row.created_by ?? row.createdBy),
    cancelledBy: stringOrNull(row.cancelled_by ?? row.cancelledBy),
    cancelledAt: stringOrNull(row.cancelled_at ?? row.cancelledAt),
    cancellationReason: stringOrNull(
      row.cancellation_reason ?? row.cancellationReason
    ),
    createdAt: requireRowString(row.created_at ?? row.createdAt, 'created_at'),
    updatedAt: requireRowString(row.updated_at ?? row.updatedAt, 'updated_at'),
  };
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizePaymentOrder(value: unknown): CustomOfferPaymentOrder {
  const row = firstRecord(value);
  if (!row) {
    throw new CustomPlanOfferError(
      'request_failed',
      500,
      'Custom offer payment order repository returned invalid data.'
    );
  }

  const provider = stringOrNull(row.provider)?.toLowerCase();
  const providerMode = stringOrNull(row.provider_mode ?? row.providerMode)?.toLowerCase();
  const plan = stringOrNull(row.plan)?.toLowerCase();
  const amountTwd = integerOrNull(row.amount_twd ?? row.amountTwd);
  const metadata = normalizeMetadata(row.metadata);
  if (
    provider !== 'ecpay'
    || (providerMode !== 'test' && providerMode !== 'production')
    || plan !== 'basic'
    || amountTwd === null
    || amountTwd < MIN_OFFER_AMOUNT_TWD
    || amountTwd > MAX_OFFER_AMOUNT_TWD
    || metadata.pricing_kind !== 'custom_offer'
    || !isCustomPlanOfferId(metadata.custom_offer_id)
  ) {
    throw new CustomPlanOfferError(
      'request_failed',
      500,
      'Custom offer payment order returned invalid provider or pricing data.'
    );
  }

  return {
    id: requireRowString(row.id ?? row.payment_order_id, 'id'),
    orgId: requireRowString(row.org_id ?? row.orgId, 'org_id'),
    actorUserId: stringOrNull(
      row.actor_user_id ?? row.requested_by ?? row.created_by ?? row.actorUserId
    ),
    provider: 'ecpay',
    providerMode,
    plan: 'basic',
    amountTwd,
    merchantId: requireRowString(row.merchant_id ?? row.merchantId, 'merchant_id'),
    merchantTradeNo: requireRowString(
      row.merchant_trade_no ?? row.merchantTradeNo,
      'merchant_trade_no'
    ),
    status: requireRowString(row.status, 'status'),
    createdAt: stringOrNull(row.created_at ?? row.createdAt),
    metadata,
  };
}

function isMissingCustomPlanOfferSchemaError(error: RepositoryError | null): boolean {
  const code = error?.code?.toUpperCase();
  const message = error?.message?.toLowerCase() ?? '';
  const referencesCustomPlanOfferSchema = [
    'custom_plan_offers',
    'create_custom_plan_offer',
    'cancel_custom_plan_offer',
    'create_custom_plan_payment_order',
  ].some((identifier) => message.includes(identifier));
  const isMissingDatabaseObject = [
    '42P01',
    '42883',
    'PGRST202',
    'PGRST205',
  ].includes(code ?? '')
    || message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache');

  return referencesCustomPlanOfferSchema && isMissingDatabaseObject;
}

function throwRepositoryError(
  error: RepositoryError | null,
  fallback: string
): void {
  if (!error) return;
  const message = error.message?.toLowerCase() ?? '';
  if (isMissingCustomPlanOfferSchemaError(error)) {
    throw new CustomPlanOfferError(
      'feature_disabled',
      503,
      'Custom plan offers require SaaS database migration 049.'
    );
  }
  if (message.includes('active owner or admin membership')) {
    throw new CustomPlanOfferError(
      'permission_denied',
      403,
      'Only an active organization owner or admin may pay this offer.'
    );
  }
  if (message.includes('not found')) {
    throw new CustomPlanOfferError('offer_not_found', 404, 'Custom plan offer was not found.');
  }
  if (
    message.includes('platform-suspended')
    || message.includes('cannot downgrade')
    || message.includes('only an active custom plan offer')
  ) {
    throw new CustomPlanOfferError(
      'offer_unavailable',
      409,
      'This custom plan offer is not available for checkout.'
    );
  }
  if (
    message.includes('idempotency_key')
    || message.includes('requires review')
    || message.includes('does not match')
  ) {
    throw new CustomPlanOfferError(
      'offer_conflict',
      409,
      'This custom plan offer has a conflicting payment operation.'
    );
  }
  throw new CustomPlanOfferError('request_failed', 500, fallback);
}

function throwStructuredCheckoutError(value: unknown): void {
  const result = firstRecord(value);
  if (!result) return;
  const status = stringOrNull(result.status);
  const errorCode = stringOrNull(result.error_code);
  if (status === 'rate_limited' && errorCode === 'checkout_rate_limited') {
    const retryAfterSeconds = integerOrNull(result.retry_after_seconds) ?? 60;
    throw new CustomPlanOfferError(
      'checkout_rate_limited',
      429,
      'Too many checkout attempts. Please retry later.',
      Math.max(1, retryAfterSeconds)
    );
  }
  if (status === 'offer_unavailable') {
    throw new CustomPlanOfferError(
      'offer_unavailable',
      409,
      errorCode === 'offer_expired'
        ? 'This custom plan offer has expired.'
        : 'This custom plan offer is no longer available.'
    );
  }
}

export function normalizeCreateCustomPlanOfferInput(
  value: unknown,
  operator: CustomPlanOfferOperatorContext,
  now = new Date()
): CreateCustomPlanOfferInput {
  if (!isRecord(value)) invalid('Request body must be an object.');
  const actor = normalizeOperatorContext(operator);
  return {
    orgId: normalizeOrgId(value.orgId),
    actorUserId: actor.actorUserId,
    actorMetadata: actor.actorMetadata,
    title: requireECPayOfferTitle(value.title),
    description: optionalString(value.description, 'description', 500),
    amountTwd: normalizeOfferAmount(value.amountTwd),
    expiresAt: normalizeExpiresAt(value.expiresAt, now),
  };
}

export function normalizeCancelCustomPlanOfferInput(
  value: unknown,
  operator: CustomPlanOfferOperatorContext
): CancelCustomPlanOfferInput {
  if (!isRecord(value)) invalid('Request body must be an object.');
  const actor = normalizeOperatorContext(operator);
  return {
    offerId: normalizeCustomPlanOfferId(value.offerId),
    actorUserId: actor.actorUserId,
    actorMetadata: actor.actorMetadata,
    reason: requireString(value.reason, 'reason', 4, 500),
  };
}

function normalizeCreatePaymentOrderInput(
  input: CreateCustomPlanPaymentOrderInput
): CreateCustomPlanPaymentOrderInput {
  const actorUserId = normalizeActorUserId(input.actorUserId, true);
  if (!actorUserId) invalid('A merchant checkout requires an authenticated user.');
  if (input.provider !== 'ecpay') invalid('provider must be ecpay.');
  if (input.providerMode !== 'test' && input.providerMode !== 'production') {
    invalid('providerMode must be test or production.');
  }
  const merchantId = requireString(input.merchantId, 'merchantId', 1, 64);
  const merchantTradeNo = stringOrNull(input.merchantTradeNo);
  if (!merchantTradeNo || !MERCHANT_TRADE_NO_PATTERN.test(merchantTradeNo)) {
    invalid('merchantTradeNo must contain 1-20 ASCII letters or digits.');
  }
  const idempotencyKey = requireString(
    input.idempotencyKey,
    'idempotencyKey',
    16,
    160
  );
  return {
    offerId: normalizeCustomPlanOfferId(input.offerId),
    orgId: normalizeOrgId(input.orgId),
    actorUserId,
    provider: 'ecpay',
    providerMode: input.providerMode,
    merchantId,
    merchantTradeNo,
    idempotencyKey,
  };
}

export function createCustomPlanOfferRepository(
  injectedClient?: CustomPlanOfferQueryClient
): CustomPlanOfferRepository {
  const getClient = () => injectedClient
    ?? (createUntypedAdminClient() as unknown as CustomPlanOfferQueryClient);

  return {
    async createOffer(input) {
      const { data, error } = await getClient().rpc('create_custom_plan_offer', {
        p_org_id: input.orgId,
        p_actor_user_id: input.actorUserId,
        p_actor_metadata: {
          actor_kind: input.actorMetadata.actorKind,
          actor_fingerprint_sha256: input.actorMetadata.actorFingerprintSha256,
          platform_role: input.actorMetadata.platformRole,
        },
        p_title: input.title,
        p_description: input.description,
        p_amount_twd: input.amountTwd,
        p_expires_at: input.expiresAt,
      });
      throwRepositoryError(error, 'Failed to create custom plan offer.');
      return normalizeOffer(data);
    },

    async cancelOffer(input) {
      const { data, error } = await getClient().rpc('cancel_custom_plan_offer', {
        p_offer_id: input.offerId,
        p_actor_user_id: input.actorUserId,
        p_actor_metadata: {
          actor_kind: input.actorMetadata.actorKind,
          actor_fingerprint_sha256: input.actorMetadata.actorFingerprintSha256,
          platform_role: input.actorMetadata.platformRole,
        },
        p_reason: input.reason,
      });
      throwRepositoryError(error, 'Failed to cancel custom plan offer.');
      return normalizeOffer(data);
    },

    async listOffers(input) {
      const orgId = normalizeOrgId(input.orgId);
      const limit = input.limit ?? 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        invalid('limit must be an integer between 1 and 100.');
      }
      const { data, error } = await getClient()
        .from('custom_plan_offers')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);
      throwRepositoryError(error, 'Failed to load custom plan offers.');
      if (!Array.isArray(data)) {
        throw new CustomPlanOfferError(
          'request_failed',
          500,
          'Custom plan offer repository returned invalid data.'
        );
      }
      return data.map(normalizeOffer);
    },

    async createPaymentOrder(rawInput) {
      const input = normalizeCreatePaymentOrderInput(rawInput);
      const client = getClient();
      const { data, error } = await client.rpc('create_custom_plan_payment_order', {
        p_offer_id: input.offerId,
        p_org_id: input.orgId,
        p_actor_user_id: input.actorUserId,
        p_provider: 'ecpay',
        p_provider_mode: input.providerMode,
        p_merchant_trade_no: input.merchantTradeNo,
        p_idempotency_key: input.idempotencyKey,
        p_metadata: {
          merchant_id: input.merchantId,
          provider_mode: input.providerMode,
          source: 'custom_plan_offer',
        },
      });
      throwRepositoryError(error, 'Failed to create custom offer payment order.');
      throwStructuredCheckoutError(data);

      const rpcOrder = firstRecord(data);
      const orderId = stringOrNull(rpcOrder?.id ?? rpcOrder?.payment_order_id);
      if (!orderId) {
        throw new CustomPlanOfferError(
          'request_failed',
          500,
          'Custom offer payment order was not persisted.'
        );
      }

      const persisted = await client
        .from('payment_orders')
        .select('*')
        .eq('id', orderId)
        .eq('org_id', input.orgId)
        .maybeSingle();
      throwRepositoryError(
        persisted.error,
        'Failed to load custom offer payment order.'
      );
      if (!persisted.data) {
        throw new CustomPlanOfferError(
          'request_failed',
          500,
          'Custom offer payment order was not persisted.'
        );
      }
      return normalizePaymentOrder(persisted.data);
    },
  };
}
