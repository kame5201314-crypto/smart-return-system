import type {
  BillingSettingsView,
  BillingSettingsViewInput,
  BillingSuspensionSource,
} from '@/lib/saas/ui-backend-contracts';

interface SupabaseQueryError {
  code?: string;
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

export interface SettingsBillingQueryBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns: string): SettingsBillingQueryBuilder;
  eq(column: string, value: unknown): SettingsBillingQueryBuilder;
  gt(column: string, value: unknown): SettingsBillingQueryBuilder;
  in(column: string, values: readonly unknown[]): SettingsBillingQueryBuilder;
  order(column: string, options: { ascending: boolean }): SettingsBillingQueryBuilder;
  limit(count: number): SettingsBillingQueryBuilder;
  maybeSingle(): Promise<SupabaseQueryResult>;
}

export interface SettingsBillingQueryClient {
  from(table: string): SettingsBillingQueryBuilder;
}

export interface SettingsBillingDataRepository {
  getOrganizationBilling(input: { orgId: string }): Promise<SettingsBillingOrgData | null>;
  getSubscription(input: { orgId: string }): Promise<SettingsBillingSubscriptionData | null>;
  getLatestInvoice(input: { orgId: string }): Promise<SettingsBillingInvoiceData | null>;
  getSuspensionSource?(input: { orgId: string }): Promise<BillingSuspensionSource | null>;
  listPaymentOrders?(input: { orgId: string; limit?: number }): Promise<SettingsBillingPaymentOrderData[]>;
  listSubscriptionPeriods?(input: {
    orgId: string;
    limit?: number;
  }): Promise<SettingsBillingSubscriptionPeriodData[]>;
  listCustomPlanOffers?(input: {
    orgId: string;
    limit?: number;
  }): Promise<SettingsBillingCustomPlanOfferData[]>;
}

export interface SettingsBillingOrgData {
  id: string;
  name: string;
  plan: string;
  status: string;
  billingEmail: string | null;
  taxId: string | null;
  suspensionSource?: BillingSuspensionSource | null;
}

export interface SettingsBillingSubscriptionData {
  provider: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface SettingsBillingInvoiceData {
  id: string;
  status: string;
}

export interface SettingsBillingPaymentOrderData {
  id: string;
  plan: string;
  provider: string;
  amountTwd: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface SettingsBillingSubscriptionPeriodData {
  paymentOrderId: string;
  periodStart: string;
  periodEnd: string;
}

function timestampOrNull(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveCurrentEntitlementStart(input: {
  currentPeriodStart: string | null;
  periods: SettingsBillingSubscriptionPeriodData[];
  now?: Date | string | number;
}): string | null {
  const now = input.now instanceof Date
    ? input.now.getTime()
    : typeof input.now === 'string' || typeof input.now === 'number'
      ? new Date(input.now).getTime()
      : Date.now();
  if (!Number.isFinite(now)) return input.currentPeriodStart;

  const coveringPeriod = input.periods
    .filter((period) => {
      const start = timestampOrNull(period.periodStart);
      const end = timestampOrNull(period.periodEnd);
      return start !== null && end !== null && start <= now && end > now;
    })
    .sort((left, right) => (
      (timestampOrNull(right.periodStart) ?? 0) - (timestampOrNull(left.periodStart) ?? 0)
    ))[0];

  return coveringPeriod?.periodStart ?? input.currentPeriodStart;
}

export interface SettingsBillingCustomPlanOfferData {
  id: string;
  title: string;
  description: string | null;
  amountTwd: number;
  status: 'active' | 'paid' | 'cancelled' | 'expired';
  expiresAt: string;
  billingPeriodMonths: number;
  createdAt: string;
}

const SUSPENSION_ACTION_SOURCES = {
  'lifecycle.trial_expired_suspended': 'trial_expired',
  'lifecycle.prepaid_period_expired_suspended': 'billing',
  'platform.billing.org_suspended': 'platform_admin',
} as const satisfies Record<string, BillingSuspensionSource>;

const SUSPENSION_ACTIONS = Object.keys(SUSPENSION_ACTION_SOURCES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function nonNegativeNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function assertNoSupabaseError(error: SupabaseQueryError | null, fallbackMessage: string): void {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
}

function normalizeOrganization(row: unknown): SettingsBillingOrgData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: stringOrFallback(row.name, ''),
    plan: stringOrFallback(row.plan, 'basic'),
    status: stringOrFallback(row.status, 'suspended'),
    billingEmail: stringOrNull(row.billing_email),
    taxId: stringOrNull(row.tax_id),
    ...(Object.prototype.hasOwnProperty.call(row, 'suspension_source')
      ? { suspensionSource: normalizeSuspensionSourceValue(row.suspension_source) }
      : {}),
  };
}

function normalizeSuspensionSourceValue(value: unknown): BillingSuspensionSource | null {
  return value === 'trial_expired' || value === 'billing' || value === 'platform_admin'
    ? value
    : null;
}

function normalizeSubscription(row: unknown): SettingsBillingSubscriptionData | null {
  if (!isRecord(row)) {
    return null;
  }

  return {
    provider: stringOrNull(row.provider),
    currentPeriodStart: stringOrNull(row.current_period_start),
    currentPeriodEnd: stringOrNull(row.current_period_end),
    trialEnd: stringOrNull(row.trial_end),
    cancelAtPeriodEnd: booleanOrFalse(row.cancel_at_period_end),
  };
}

function normalizeInvoice(row: unknown): SettingsBillingInvoiceData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  if (!id) {
    return null;
  }

  return {
    id,
    status: stringOrFallback(row.status, 'draft'),
  };
}

function normalizePaymentOrder(row: unknown): SettingsBillingPaymentOrderData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const plan = stringOrNull(row.plan);
  const provider = stringOrNull(row.provider);
  const amountTwd = nonNegativeNumberOrNull(row.amount_twd);
  const createdAt = stringOrNull(row.created_at);
  if (!id || !plan || !provider || amountTwd === null || !createdAt) {
    return null;
  }

  return {
    id,
    plan,
    provider,
    amountTwd,
    status: stringOrFallback(row.status, 'pending'),
    paidAt: stringOrNull(row.paid_at),
    createdAt,
  };
}

function normalizeSubscriptionPeriod(
  row: unknown
): SettingsBillingSubscriptionPeriodData | null {
  if (!isRecord(row)) {
    return null;
  }

  const paymentOrderId = stringOrNull(row.payment_order_id);
  const periodStart = stringOrNull(row.period_start);
  const periodEnd = stringOrNull(row.period_end);
  if (!paymentOrderId || !periodStart || !periodEnd) {
    return null;
  }

  return { paymentOrderId, periodStart, periodEnd };
}

function normalizeCustomPlanOffer(row: unknown): SettingsBillingCustomPlanOfferData | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = stringOrNull(row.id);
  const title = stringOrNull(row.title);
  const status = stringOrNull(row.status);
  const amountTwd = nonNegativeNumberOrNull(row.amount_twd);
  const expiresAt = stringOrNull(row.expires_at);
  const billingPeriodMonths = nonNegativeNumberOrNull(row.billing_period_months);
  const createdAt = stringOrNull(row.created_at);
  if (
    !id ||
    !title ||
    !status ||
    !['active', 'paid', 'cancelled', 'expired'].includes(status) ||
    amountTwd === null ||
    !Number.isInteger(amountTwd) ||
    amountTwd < 5 ||
    amountTwd > 199_999 ||
    billingPeriodMonths === null ||
    !Number.isInteger(billingPeriodMonths) ||
    billingPeriodMonths !== 1 ||
    !expiresAt ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    title,
    description: stringOrNull(row.description),
    amountTwd,
    status: status as SettingsBillingCustomPlanOfferData['status'],
    expiresAt,
    billingPeriodMonths,
    createdAt,
  };
}

function normalizeSuspensionSource(row: unknown): BillingSuspensionSource | null {
  if (!isRecord(row)) {
    return null;
  }

  const action = stringOrNull(row.action);
  return action && action in SUSPENSION_ACTION_SOURCES
    ? SUSPENSION_ACTION_SOURCES[action as keyof typeof SUSPENSION_ACTION_SOURCES]
    : null;
}

function isHistoryTableUnavailable(error: SupabaseQueryError | null, table: string): boolean {
  const code = error?.code?.toUpperCase() ?? '';
  const message = error?.message?.toLowerCase() ?? '';
  return code === '42P01' || code === 'PGRST205' || message.includes(table) && (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

export function createSettingsBillingDataRepository(
  client: SettingsBillingQueryClient
): SettingsBillingDataRepository {
  return {
    async getOrganizationBilling(input) {
      const { data, error } = await client
        .from('organizations')
        .select('id, name, plan, status, suspension_source, billing_email, tax_id')
        .eq('id', input.orgId)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load organization billing data.');
      return normalizeOrganization(data);
    },

    async getSubscription(input) {
      const { data, error } = await client
        .from('subscriptions')
        .select('provider, current_period_start, current_period_end, trial_end, cancel_at_period_end')
        .eq('org_id', input.orgId)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load subscription billing data.');
      return normalizeSubscription(data);
    },

    async getLatestInvoice(input) {
      const { data, error } = await client
        .from('invoices')
        .select('id, status, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load latest invoice data.');
      return normalizeInvoice(data);
    },

    async getSuspensionSource(input) {
      const { data, error } = await client
        .from('audit_logs')
        .select('action, created_at')
        .eq('org_id', input.orgId)
        .in('action', SUSPENSION_ACTIONS)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      assertNoSupabaseError(error, 'Failed to load organization suspension source.');
      return normalizeSuspensionSource(data);
    },

    async listPaymentOrders(input) {
      const { data, error } = await client
        .from('payment_orders')
        .select('id, plan, provider, amount_twd, status, paid_at, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false })
        .limit(input.limit ?? 24);

      if (isHistoryTableUnavailable(error, 'payment_orders')) return [];
      assertNoSupabaseError(error, 'Failed to load payment history.');
      return Array.isArray(data)
        ? data
            .map(normalizePaymentOrder)
            .filter((row): row is SettingsBillingPaymentOrderData => row !== null)
        : [];
    },

    async listSubscriptionPeriods(input) {
      const { data, error } = await client
        .from('subscription_periods')
        .select('payment_order_id, period_start, period_end, created_at')
        .eq('org_id', input.orgId)
        .order('created_at', { ascending: false })
        .limit(input.limit ?? 24);

      if (isHistoryTableUnavailable(error, 'subscription_periods')) return [];
      assertNoSupabaseError(error, 'Failed to load subscription period history.');
      return Array.isArray(data)
        ? data
            .map(normalizeSubscriptionPeriod)
            .filter((row): row is SettingsBillingSubscriptionPeriodData => row !== null)
        : [];
    },

    async listCustomPlanOffers(input) {
      const { data, error } = await client
        .from('custom_plan_offers')
        .select(
          'id, title, description, amount_twd, status, expires_at, billing_period_months, created_at'
        )
        .eq('org_id', input.orgId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(input.limit ?? 12);

      // During the migration rollout, a missing table or stale PostgREST schema
      // cache means there are no custom offers yet. Other failures must remain
      // observable instead of silently looking like an empty offer list.
      if (isHistoryTableUnavailable(error, 'custom_plan_offers')) return [];
      assertNoSupabaseError(error, 'Failed to load custom plan offers.');
      return Array.isArray(data)
        ? data
            .map(normalizeCustomPlanOffer)
            .filter((row): row is SettingsBillingCustomPlanOfferData => row !== null)
        : [];
    },
  };
}

export async function buildBillingSettingsViewInput(
  repository: SettingsBillingDataRepository,
  input: {
    orgId: string;
    suspensionSource?: BillingSuspensionSource | null;
    actions: BillingSettingsView['actions'];
  }
): Promise<BillingSettingsViewInput | null> {
  const org = await repository.getOrganizationBilling({ orgId: input.orgId });
  if (!org) {
    return null;
  }

  let customOffersUnavailable = false;
  const [
    subscription,
    latestInvoice,
    legacySuspensionSource,
    paymentOrders,
    subscriptionPeriods,
    customPlanOffers,
  ] = await Promise.all([
    repository.getSubscription({ orgId: input.orgId }),
    repository.getLatestInvoice({ orgId: input.orgId }),
    org.suspensionSource === undefined
      ? repository.getSuspensionSource?.({ orgId: input.orgId }) ?? Promise.resolve(null)
      : Promise.resolve(null),
    repository.listPaymentOrders?.({ orgId: input.orgId, limit: 24 }) ?? Promise.resolve([]),
    repository.listSubscriptionPeriods?.({ orgId: input.orgId, limit: 24 }) ?? Promise.resolve([]),
    (async () => {
      try {
        return await (
          repository.listCustomPlanOffers?.({ orgId: input.orgId, limit: 12 })
          ?? Promise.resolve([])
        );
      } catch {
        customOffersUnavailable = true;
        console.error('Failed to load custom plan offers for the billing view.');
        return [];
      }
    })(),
  ]);

  const now = Date.now();
  const availableCustomOffers = customPlanOffers.filter((offer) => {
    const expiresAt = Date.parse(offer.expiresAt);
    return offer.status === 'active' && Number.isFinite(expiresAt) && expiresAt > now;
  });
  const resolvedSubscription = subscription
    ? {
        ...subscription,
        currentPeriodStart: resolveCurrentEntitlementStart({
          currentPeriodStart: subscription.currentPeriodStart,
          periods: subscriptionPeriods,
          now,
        }),
      }
    : null;

  return {
    org: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      status: org.status,
      suspensionSource: input.suspensionSource !== undefined
        ? input.suspensionSource
        : org.suspensionSource !== undefined
          ? org.suspensionSource
          : legacySuspensionSource,
    },
    subscription: resolvedSubscription,
    invoiceSummary: {
      latestInvoiceId: latestInvoice?.id ?? null,
      latestInvoiceStatus: latestInvoice?.status ?? null,
      billingEmail: org.billingEmail,
      taxId: org.taxId,
    },
    history: paymentOrders.map((order) => {
      const period = subscriptionPeriods.find((item) => item.paymentOrderId === order.id);
      return {
        ...order,
        periodStart: period?.periodStart ?? null,
        periodEnd: period?.periodEnd ?? null,
      };
    }),
    customOffers: availableCustomOffers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      description: offer.description,
      amountTwd: offer.amountTwd,
      expiresAt: offer.expiresAt,
      billingPeriodMonths: offer.billingPeriodMonths,
    })),
    customOffersUnavailable,
    actions: input.actions,
  };
}
