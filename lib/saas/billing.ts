import { createHash, timingSafeEqual } from 'node:crypto';

import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

export type BillingProvider = 'ecpay' | 'stripe' | 'tappay';
export type BillingMode = 'test' | 'production';

export interface BillingProviderConfig {
  provider: BillingProvider;
  mode: BillingMode;
  requiredEnv: string[];
  missingEnv: string[];
  configured: boolean;
}

export interface BillingWebhookState {
  billingEnabled: boolean;
  provider: BillingProvider;
  activeProvider: BillingProvider | null;
  providerEnabled: boolean;
  config: BillingProviderConfig;
}

export interface BillingEventInput {
  orgId: string;
  provider: BillingProvider;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface BillingEventRecordResult {
  status: 'created' | 'duplicate';
}

export interface BillingInsertError {
  code?: string;
  message?: string;
}

export interface BillingEventsTableClient {
  insert(record: Record<string, unknown>): Promise<{ error: BillingInsertError | null }>;
}

export interface BillingEventsQueryClient {
  from(table: string): BillingEventsTableClient;
}

export interface BillingEventsRepository {
  recordEvent(input: BillingEventInput): Promise<BillingEventRecordResult>;
}

export interface ECPayCheckMacValueInput {
  payload: Record<string, unknown>;
  hashKey: string;
  hashIv: string;
}

const BILLING_PROVIDER_ENV: Record<BillingProvider, string[]> = {
  ecpay: ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV', 'ECPAY_MODE'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  tappay: ['TAPPAY_PARTNER_KEY', 'TAPPAY_MERCHANT_ID', 'TAPPAY_APP_ID', 'TAPPAY_APP_KEY', 'TAPPAY_MODE'],
};

function normalizeEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\\n/g, '').trim() : '';
}

function normalizePayloadValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

export function normalizeBillingProvider(value: unknown): BillingProvider | null {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (normalized === 'ecpay' || normalized === 'stripe' || normalized === 'tappay') {
    return normalized;
  }
  return null;
}

function normalizeBillingMode(value: unknown): BillingMode {
  const normalized = normalizeEnvValue(value).toLowerCase();
  return normalized === 'production' ? 'production' : 'test';
}

export function resolveBillingProviderConfig(
  provider: BillingProvider,
  env: Record<string, string | undefined> = process.env
): BillingProviderConfig {
  const requiredEnv = BILLING_PROVIDER_ENV[provider];
  const missingEnv = requiredEnv.filter((key) => !normalizeEnvValue(env[key]));
  const mode =
    provider === 'ecpay'
      ? normalizeBillingMode(env.ECPAY_MODE)
      : provider === 'tappay'
        ? normalizeBillingMode(env.TAPPAY_MODE)
        : 'test';

  return {
    provider,
    mode,
    requiredEnv,
    missingEnv,
    configured: missingEnv.length === 0,
  };
}

export function resolveBillingWebhookState(
  provider: BillingProvider,
  env: Record<string, string | undefined> = process.env
): BillingWebhookState {
  const flags = resolveSaaSFeatureFlags({ env, orgPlan: 'enterprise' });
  const activeProvider = normalizeBillingProvider(env.BILLING_PROVIDER);
  const config = resolveBillingProviderConfig(provider, env);

  return {
    billingEnabled: flags.billing,
    provider,
    activeProvider,
    providerEnabled: flags.billing && activeProvider === provider,
    config,
  };
}

function requireEventString(value: unknown, field: string): string {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    throw new Error(`${field} is required for billing event recording.`);
  }
  return normalized;
}

export function buildBillingEventRecord(input: BillingEventInput): Record<string, unknown> {
  return {
    org_id: requireEventString(input.orgId, 'orgId'),
    provider: input.provider,
    provider_event_id: requireEventString(input.providerEventId, 'providerEventId'),
    event_type: requireEventString(input.eventType, 'eventType'),
    payload: input.payload,
  };
}

function isDuplicateInsertError(error: BillingInsertError): boolean {
  const code = normalizeEnvValue(error.code);
  const message = normalizeEnvValue(error.message).toLowerCase();
  return code === '23505' || message.includes('duplicate') || message.includes('unique');
}

export function createBillingEventsRepository(
  client: BillingEventsQueryClient
): BillingEventsRepository {
  return {
    async recordEvent(input) {
      const { error } = await client
        .from('billing_events')
        .insert(buildBillingEventRecord(input));

      if (!error) {
        return { status: 'created' };
      }

      if (isDuplicateInsertError(error)) {
        return { status: 'duplicate' };
      }

      throw new Error(error.message || 'Failed to record billing event.');
    },
  };
}

function ecpayUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/'/g, '%27')
    .replace(/~/g, '%7e')
    .toLowerCase()
    .replace(/%20/g, '+')
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

function sortECPayPayloadKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => {
    const lowerCompare = left.toLowerCase().localeCompare(right.toLowerCase(), 'en');
    return lowerCompare === 0 ? left.localeCompare(right, 'en') : lowerCompare;
  });
}

export function buildECPayCheckMacValue(input: ECPayCheckMacValueInput): string {
  const hashKey = requireEventString(input.hashKey, 'hashKey');
  const hashIv = requireEventString(input.hashIv, 'hashIv');
  const sortedPayload = sortECPayPayloadKeys(
    Object.keys(input.payload).filter(
      (key) => key.toLowerCase() !== 'checkmacvalue'
    )
  )
    .map((key) => `${key}=${normalizePayloadValue(input.payload[key])}`)
    .join('&');
  const macSource = `HashKey=${hashKey}&${sortedPayload}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(macSource);

  return createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

export function verifyECPayCheckMacValue(
  payload: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env
): boolean {
  const received = normalizeEnvValue(payload.CheckMacValue).toUpperCase();
  if (!received) {
    return false;
  }

  const expected = buildECPayCheckMacValue({
    payload,
    hashKey: normalizeEnvValue(env.ECPAY_HASH_KEY),
    hashIv: normalizeEnvValue(env.ECPAY_HASH_IV),
  });

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function resolveECPayWebhookEvent(payload: Record<string, unknown>): {
  providerEventId: string;
  eventType: string;
} {
  const providerEventId =
    normalizeEnvValue(payload.MerchantTradeNo) || normalizeEnvValue(payload.TradeNo);
  const rtnCode = normalizeEnvValue(payload.RtnCode);

  return {
    providerEventId: requireEventString(providerEventId, 'providerEventId'),
    eventType: rtnCode === '1' ? 'ecpay.payment_succeeded' : 'ecpay.payment_failed',
  };
}
