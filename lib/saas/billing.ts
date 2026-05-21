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

const BILLING_PROVIDER_ENV: Record<BillingProvider, string[]> = {
  ecpay: ['ECPAY_MERCHANT_ID', 'ECPAY_HASH_KEY', 'ECPAY_HASH_IV', 'ECPAY_MODE'],
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  tappay: ['TAPPAY_PARTNER_KEY', 'TAPPAY_MERCHANT_ID', 'TAPPAY_APP_ID', 'TAPPAY_APP_KEY', 'TAPPAY_MODE'],
};

function normalizeEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\\n/g, '').trim() : '';
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
