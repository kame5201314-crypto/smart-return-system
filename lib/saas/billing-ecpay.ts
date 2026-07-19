import { randomBytes, randomUUID } from 'node:crypto';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { getSaaSPlanDefinition, type SaaSPlanCode } from '@/lib/config/saas-plans';
import {
  buildECPayCheckMacValue,
  resolveBillingWebhookState,
  verifyECPayCheckMacValue,
  type BillingMode,
} from '@/lib/saas/billing';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export type ECPayPrepaidPlan = Extract<SaaSPlanCode, 'basic' | 'growth'>;
export type ECPayProviderMode = BillingMode;
export type ECPayNotificationStatus = 'processed' | 'duplicate' | 'ignored' | 'failed';

export interface ECPayPaymentOrder {
  id: string;
  orgId: string;
  actorUserId: string | null;
  provider: 'ecpay';
  providerMode: ECPayProviderMode;
  plan: ECPayPrepaidPlan;
  amountTwd: number;
  merchantId: string;
  merchantTradeNo: string;
  status: string;
  createdAt: string | null;
}

export interface CreateECPayPaymentOrderInput {
  orgId: string;
  actorUserId: string;
  plan: ECPayPrepaidPlan;
  amountTwd: number;
  merchantTradeNo: string;
  idempotencyKey: string;
  merchantId: string;
  providerMode: ECPayProviderMode;
}

export interface ProcessECPayPaymentNotificationInput {
  order: ECPayPaymentOrder;
  providerEventId: string;
  tradeNo: string | null;
  merchantId: string;
  tradeAmountTwd: number;
  rtnCode: number;
  rtnMessage: string;
  simulatePaid: boolean;
  paymentDate: string | null;
  payload: Record<string, string>;
}

export interface ECPayCheckoutRepository {
  createOrder(input: CreateECPayPaymentOrderInput): Promise<ECPayPaymentOrder>;
  findOrderByMerchantTradeNo(
    merchantTradeNo: string,
    merchantId: string,
    providerMode: ECPayProviderMode
  ): Promise<ECPayPaymentOrder | null>;
  processNotification(
    input: ProcessECPayPaymentNotificationInput
  ): Promise<ECPayNotificationStatus>;
}

export interface ECPayCheckoutForm {
  action: string;
  method: 'POST';
  fields: Record<string, string>;
}

export interface ECPayVerifiedPaidTrade {
  merchantId: string;
  merchantTradeNo: string;
  tradeNo: string;
  tradeAmountTwd: number;
  tradeStatus: '1';
  paymentDate: string | null;
}

export interface QueryECPayPaidTradeInput {
  order: ECPayPaymentOrder;
  expectedTradeNo: string;
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
}

interface ECPayRepositoryError {
  code?: string;
  message?: string;
}

interface ECPayPaymentOrderQuery {
  select(columns: string): ECPayPaymentOrderQuery;
  eq(column: string, value: string): ECPayPaymentOrderQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: ECPayRepositoryError | null }>;
}

export interface ECPayCheckoutQueryClient {
  from(table: string): ECPayPaymentOrderQuery;
  rpc(
    functionName: string,
    params: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: ECPayRepositoryError | null }>;
}

const ECPAY_CHECKOUT_ACTIONS = {
  test: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  production: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
} as const;

const ECPAY_QUERY_TRADE_INFO_ACTIONS = {
  test: 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  production: 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
} as const;

const ECPAY_QUERY_TIMEOUT_MS = 8_000;
const ECPAY_QUERY_RESPONSE_MAX_LENGTH = 64_000;

const ECPAY_PREPAID_PLANS: readonly ECPayPrepaidPlan[] = ['basic', 'growth'];
const ECPAY_NOTIFICATION_STATUSES: readonly ECPayNotificationStatus[] = [
  'processed',
  'duplicate',
  'ignored',
  'failed',
];

const ECPAY_MERCHANT_TRADE_NO_PATTERN = /^[A-Za-z0-9]{1,20}$/;

export function normalizeECPayMerchantTradeNo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return ECPAY_MERCHANT_TRADE_NO_PATTERN.test(normalized) ? normalized : null;
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
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function requireString(value: unknown, field: string): string {
  const normalized = stringOrNull(value);
  if (!normalized) {
    throw new Error(`ECPay payment order is missing ${field}.`);
  }
  return normalized;
}

function parseUniqueECPayFormPayload(rawBody: string): Record<string, string> {
  if (!rawBody.trim() || rawBody.length > ECPAY_QUERY_RESPONSE_MAX_LENGTH) {
    throw new Error('ECPay trade query response is invalid.');
  }

  const params = new URLSearchParams(rawBody);
  const payload: Record<string, string> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length !== 1) {
      throw new Error('ECPay trade query response contains duplicate fields.');
    }
    payload[key] = values[0] ?? '';
  }
  return payload;
}

function normalizePaymentOrder(value: unknown): ECPayPaymentOrder {
  const row = firstRecord(value);
  if (!row) {
    throw new Error('ECPay payment order RPC did not return an order.');
  }

  const plan = normalizeECPayPrepaidPlan(row.plan);
  const amountTwd = integerOrNull(row.amount_twd ?? row.amountTwd);
  const provider = stringOrNull(row.provider)?.toLowerCase();
  const providerMode = normalizeECPayProviderMode(row.provider_mode ?? row.providerMode);
  if (
    !plan
    || !providerMode
    || amountTwd === null
    || amountTwd <= 0
    || provider !== 'ecpay'
  ) {
    throw new Error(
      'ECPay payment order returned an invalid plan, amount, provider, or provider mode.'
    );
  }

  return {
    id: requireString(row.id ?? row.payment_order_id, 'id'),
    orgId: requireString(row.org_id ?? row.orgId, 'org_id'),
    actorUserId: stringOrNull(
      row.actor_user_id ?? row.requested_by ?? row.created_by ?? row.actorUserId
    ),
    provider: 'ecpay',
    providerMode,
    plan,
    amountTwd,
    merchantId: requireString(row.merchant_id ?? row.merchantId, 'merchant_id'),
    merchantTradeNo: requireString(
      row.merchant_trade_no ?? row.merchantTradeNo,
      'merchant_trade_no'
    ),
    status: requireString(row.status ?? row.order_status, 'status'),
    createdAt: stringOrNull(row.created_at ?? row.createdAt),
  };
}

function normalizeNotificationStatus(value: unknown): ECPayNotificationStatus {
  const row = firstRecord(value);
  const normalized = stringOrNull(
    row?.status ?? row?.notification_status ?? row?.event_status
  )?.toLowerCase();
  if (ECPAY_NOTIFICATION_STATUSES.includes(normalized as ECPayNotificationStatus)) {
    return normalized as ECPayNotificationStatus;
  }
  if (row?.reused === true && (normalized === 'paid' || row?.activated === true)) {
    return 'duplicate';
  }
  if (normalized === 'paid' || row?.activated === true) {
    return 'processed';
  }
  if (row?.simulate_paid === true || row?.simulated === true) {
    return 'ignored';
  }
  if (normalized === 'failed' || row?.activated === false) {
    return 'failed';
  }
  throw new Error('ECPay notification RPC did not return a valid processing status.');
}

function throwRepositoryError(error: ECPayRepositoryError | null, fallback: string): void {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export function normalizeECPayPrepaidPlan(value: unknown): ECPayPrepaidPlan | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return ECPAY_PREPAID_PLANS.includes(normalized as ECPayPrepaidPlan)
    ? (normalized as ECPayPrepaidPlan)
    : null;
}

export function normalizeECPayProviderMode(value: unknown): ECPayProviderMode | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'test' || normalized === 'production' ? normalized : null;
}

export function resolveECPayPrepaidAmountTwd(plan: ECPayPrepaidPlan): number {
  const definition = getSaaSPlanDefinition(plan);
  if (
    !ECPAY_PREPAID_PLANS.includes(definition.code as ECPayPrepaidPlan)
    || definition.billingRequired !== true
    || !Number.isSafeInteger(definition.monthlyPriceTwd)
    || (definition.monthlyPriceTwd ?? 0) <= 0
  ) {
    throw new Error(`SaaS plan ${plan} is not eligible for ECPay prepaid checkout.`);
  }
  return definition.monthlyPriceTwd as number;
}

export function generateECPayMerchantTradeNo(
  now: Date = new Date(),
  entropy: string = randomBytes(5).toString('hex')
): string {
  const seconds = Math.floor(now.getTime() / 1000).toString(36).toUpperCase();
  const suffix = entropy.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  if (!suffix) {
    throw new Error('ECPay merchant trade number entropy is required.');
  }
  const merchantTradeNo = `SR${seconds}${suffix}`.slice(0, 20);
  if (!normalizeECPayMerchantTradeNo(merchantTradeNo)) {
    throw new Error('ECPay merchant trade number must be 1-20 alphanumeric characters.');
  }
  return merchantTradeNo;
}

export function generateECPayCheckoutIdempotencyKey(): string {
  return `ecpay-checkout-${randomUUID()}`;
}

export function formatECPayMerchantTradeDate(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('ECPay merchant trade date is invalid.');
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}/${values.month}/${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

export function parseECPayPaymentDate(value: unknown): string | null {
  const normalized = stringOrNull(value);
  if (!normalized || !/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return null;
  }
  const date = new Date(`${normalized.replaceAll('/', '-').replace(' ', 'T')}+08:00`);
  if (Number.isNaN(date.getTime()) || formatECPayMerchantTradeDate(date) !== normalized) {
    return null;
  }
  return date.toISOString();
}

function resolveCanonicalAppOrigin(env: Record<string, string | undefined>): string {
  const value = stringOrNull(env.NEXT_PUBLIC_APP_URL);
  if (!value) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for ECPay checkout.');
  }
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS for ECPay checkout.');
  }
  return url.origin;
}

export function assertECPayCheckoutEnvironment(
  env: Record<string, string | undefined> = process.env
): void {
  const state = resolveBillingWebhookState('ecpay', env);
  const flags = resolveSaaSFeatureFlags({ env, orgPlan: 'enterprise' });
  if (
    !state.billingEnabled
    || !flags.subscription_plan
    || !state.providerEnabled
    || !state.config.configured
  ) {
    throw new Error('ECPay billing provider is not ready.');
  }
  const mode = normalizeECPayProviderMode(env.ECPAY_MODE);
  if (!mode) {
    throw new Error('ECPAY_MODE must be test or production.');
  }
  const merchantId = requireString(env.ECPAY_MERCHANT_ID, 'MerchantID');
  if (merchantId.length > 10) {
    throw new Error('ECPay MerchantID must be at most 10 characters.');
  }
  requireString(env.ECPAY_HASH_KEY, 'HashKey');
  requireString(env.ECPAY_HASH_IV, 'HashIV');
  resolveCanonicalAppOrigin(env);
}

export function buildECPayAioCheckoutForm(input: {
  order: ECPayPaymentOrder;
  env?: Record<string, string | undefined>;
  now?: Date;
}): ECPayCheckoutForm {
  const env = input.env ?? process.env;
  assertECPayCheckoutEnvironment(env);
  const state = resolveBillingWebhookState('ecpay', env);
  if (input.order.provider !== 'ecpay') {
    throw new Error('Payment order provider must be ecpay.');
  }
  if (!normalizeECPayMerchantTradeNo(input.order.merchantTradeNo)) {
    throw new Error('ECPay merchant trade number must be 1-20 alphanumeric characters.');
  }
  const expectedAmount = resolveECPayPrepaidAmountTwd(input.order.plan);
  if (input.order.amountTwd !== expectedAmount) {
    throw new Error('Payment order amount does not match the server plan price.');
  }

  const merchantId = requireString(env.ECPAY_MERCHANT_ID, 'MerchantID');
  const providerMode = normalizeECPayProviderMode(env.ECPAY_MODE);
  if (!providerMode || input.order.providerMode !== providerMode) {
    throw new Error('Payment order provider mode does not match ECPay checkout mode.');
  }
  if (input.order.merchantId !== merchantId) {
    throw new Error('Payment order merchant does not match ECPay checkout merchant.');
  }
  const origin = resolveCanonicalAppOrigin(env);
  const fields: Record<string, string> = {
    MerchantID: merchantId,
    MerchantTradeNo: input.order.merchantTradeNo,
    MerchantTradeDate: formatECPayMerchantTradeDate(input.now ?? new Date()),
    PaymentType: 'aio',
    TotalAmount: String(input.order.amountTwd),
    TradeDesc: 'Smart Return monthly plan',
    ItemName: `Smart Return ${input.order.plan} one month`,
    ReturnURL: `${origin}/api/billing/ecpay/webhook`,
    ChoosePayment: 'Credit',
    EncryptType: '1',
    ClientBackURL: `${origin}/api/billing/ecpay/result?back=1&trade=${encodeURIComponent(
      input.order.merchantTradeNo
    )}`,
    OrderResultURL: `${origin}/api/billing/ecpay/result`,
    NeedExtraPaidInfo: 'N',
    CustomField1: input.order.orgId.slice(0, 50),
    CustomField2: input.order.plan,
    CustomField3: input.order.id.slice(0, 50),
    CustomField4: '',
  };
  fields.CheckMacValue = buildECPayCheckMacValue({
    payload: fields,
    hashKey: requireString(env.ECPAY_HASH_KEY, 'HashKey'),
    hashIv: requireString(env.ECPAY_HASH_IV, 'HashIV'),
  });

  return {
    action: ECPAY_CHECKOUT_ACTIONS[state.config.mode],
    method: 'POST',
    fields,
  };
}

/**
 * Confirms a successful server notification against ECPay's signed order
 * query before the subscription settlement RPC is allowed to run.
 *
 * This function is server-only. It intentionally returns only the minimal
 * verified trade fields and never exposes provider credentials or the raw
 * provider payload to callers or logs.
 */
export async function queryECPayVerifiedPaidTrade(
  input: QueryECPayPaidTradeInput
): Promise<ECPayVerifiedPaidTrade> {
  const env = input.env ?? process.env;
  const providerMode = normalizeECPayProviderMode(env.ECPAY_MODE);
  const merchantId = requireString(env.ECPAY_MERCHANT_ID, 'MerchantID');
  const hashKey = requireString(env.ECPAY_HASH_KEY, 'HashKey');
  const hashIv = requireString(env.ECPAY_HASH_IV, 'HashIV');
  if (!providerMode || input.order.providerMode !== providerMode) {
    throw new Error('ECPay trade query mode does not match the payment order.');
  }
  if (
    input.order.provider !== 'ecpay'
    || input.order.merchantId !== merchantId
    || !/^[A-Za-z0-9]{1,20}$/.test(input.order.merchantTradeNo)
  ) {
    throw new Error('ECPay trade query order identity is invalid.');
  }
  if (!/^[A-Za-z0-9]{1,20}$/.test(input.expectedTradeNo)) {
    throw new Error('ECPay trade query expected trade number is invalid.');
  }

  const queryTime = input.now ?? new Date();
  const queryTimestamp = Math.floor(queryTime.getTime() / 1000);
  if (!Number.isSafeInteger(queryTimestamp) || queryTimestamp <= 0) {
    throw new Error('ECPay trade query timestamp is invalid.');
  }
  const requestFields: Record<string, string> = {
    MerchantID: merchantId,
    MerchantTradeNo: input.order.merchantTradeNo,
    TimeStamp: String(queryTimestamp),
    PlatformID: '',
  };
  requestFields.CheckMacValue = buildECPayCheckMacValue({
    payload: requestFields,
    hashKey,
    hashIv,
  });

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(250, input.timeoutMs ?? ECPAY_QUERY_TIMEOUT_MS)
  );

  try {
    const response = await (input.fetcher ?? fetch)(
      ECPAY_QUERY_TRADE_INFO_ACTIONS[providerMode],
      {
        method: 'POST',
        headers: {
          Accept: 'text/html',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(requestFields),
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'error',
      }
    );
    if (!response.ok) {
      throw new Error('ECPay trade query provider request failed.');
    }

    const payload = parseUniqueECPayFormPayload(await response.text());
    if (!verifyECPayCheckMacValue(payload, env)) {
      throw new Error('ECPay trade query signature verification failed.');
    }

    const responseMerchantId = requireString(payload.MerchantID, 'MerchantID');
    const responseMerchantTradeNo = requireString(
      payload.MerchantTradeNo,
      'MerchantTradeNo'
    );
    const responseTradeNo = requireString(payload.TradeNo, 'TradeNo');
    const responseTradeAmountTwd = integerOrNull(payload.TradeAmt);
    const tradeStatus = requireString(payload.TradeStatus, 'TradeStatus');
    if (
      responseMerchantId !== merchantId
      || responseMerchantId !== input.order.merchantId
      || responseMerchantTradeNo !== input.order.merchantTradeNo
      || responseTradeNo !== input.expectedTradeNo
      || responseTradeAmountTwd === null
      || responseTradeAmountTwd !== input.order.amountTwd
      || tradeStatus !== '1'
    ) {
      throw new Error('ECPay trade query does not match the paid payment order.');
    }

    return {
      merchantId: responseMerchantId,
      merchantTradeNo: responseMerchantTradeNo,
      tradeNo: responseTradeNo,
      tradeAmountTwd: responseTradeAmountTwd,
      tradeStatus: '1',
      paymentDate: parseECPayPaymentDate(payload.PaymentDate),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ECPay trade query')) {
      throw error;
    }
    throw new Error('ECPay trade query could not be completed.');
  } finally {
    clearTimeout(timeout);
  }
}

export function createECPayCheckoutRepository(
  injectedClient?: ECPayCheckoutQueryClient
): ECPayCheckoutRepository {
  const getClient = () => injectedClient
    ?? (createUntypedAdminClient() as unknown as ECPayCheckoutQueryClient);

  const repository: ECPayCheckoutRepository = {
    async createOrder(input) {
      const client = getClient();
      const { data, error } = await client.rpc('create_self_service_payment_order', {
        p_org_id: input.orgId,
        p_actor_user_id: input.actorUserId,
        p_provider: 'ecpay',
        p_provider_mode: input.providerMode,
        p_plan: input.plan,
        p_amount_twd: input.amountTwd,
        p_merchant_trade_no: input.merchantTradeNo,
        p_idempotency_key: input.idempotencyKey,
        p_metadata: {
          source: 'self_service_settings',
          billing_period_months: 1,
          merchant_id: input.merchantId,
          provider_mode: input.providerMode,
        },
      });
      throwRepositoryError(error, 'Failed to create ECPay payment order.');

      const rpcOrder = normalizePaymentOrder(data);
      const order = await repository.findOrderByMerchantTradeNo(
        rpcOrder.merchantTradeNo,
        input.merchantId,
        input.providerMode
      );
      if (!order) {
        throw new Error('ECPay payment order was not persisted.');
      }
      return order;
    },

    async findOrderByMerchantTradeNo(merchantTradeNo, merchantId, providerMode) {
      const { data, error } = await getClient()
        .from('payment_orders')
        .select('*')
        .eq('provider', 'ecpay')
        .eq('provider_mode', providerMode)
        .eq('merchant_id', merchantId)
        .eq('merchant_trade_no', merchantTradeNo)
        .maybeSingle();
      throwRepositoryError(error, 'Failed to load ECPay payment order.');
      return data ? normalizePaymentOrder(data) : null;
    },

    async processNotification(input) {
      const { data, error } = await getClient().rpc('process_ecpay_payment_notification', {
        p_merchant_trade_no: input.order.merchantTradeNo,
        p_provider_event_id: input.providerEventId,
        p_trade_no: input.tradeNo,
        p_merchant_id: input.merchantId,
        p_provider_mode: input.order.providerMode,
        p_trade_amount_twd: input.tradeAmountTwd,
        p_rtn_code: input.rtnCode,
        p_rtn_message: input.rtnMessage,
        p_simulate_paid: input.simulatePaid,
        p_payment_date: input.paymentDate,
        p_payload: input.payload,
      });
      throwRepositoryError(error, 'Failed to process ECPay payment notification.');
      return normalizeNotificationStatus(data);
    },
  };

  return repository;
}
