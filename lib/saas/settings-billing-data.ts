import type { BillingSettingsView, BillingSettingsViewInput } from '@/lib/saas/ui-backend-contracts';

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseQueryResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

export interface SettingsBillingQueryBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns: string): SettingsBillingQueryBuilder;
  eq(column: string, value: unknown): SettingsBillingQueryBuilder;
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
  listPaymentOrders?(input: { orgId: string; limit?: number }): Promise<SettingsBillingPaymentOrderData[]>;
  listSubscriptionPeriods?(input: {
    orgId: string;
    limit?: number;
  }): Promise<SettingsBillingSubscriptionPeriodData[]>;
}

export interface SettingsBillingOrgData {
  id: string;
  name: string;
  plan: string;
  status: string;
  billingEmail: string | null;
  taxId: string | null;
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
  };
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

function isHistoryTableUnavailable(error: SupabaseQueryError | null, table: string): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes(table) && (
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
        .select('id, name, plan, status, billing_email, tax_id')
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
  };
}

export async function buildBillingSettingsViewInput(
  repository: SettingsBillingDataRepository,
  input: {
    orgId: string;
    actions: BillingSettingsView['actions'];
  }
): Promise<BillingSettingsViewInput | null> {
  const [org, subscription, latestInvoice, paymentOrders, subscriptionPeriods] = await Promise.all([
    repository.getOrganizationBilling({ orgId: input.orgId }),
    repository.getSubscription({ orgId: input.orgId }),
    repository.getLatestInvoice({ orgId: input.orgId }),
    repository.listPaymentOrders?.({ orgId: input.orgId, limit: 24 }) ?? Promise.resolve([]),
    repository.listSubscriptionPeriods?.({ orgId: input.orgId, limit: 24 }) ?? Promise.resolve([]),
  ]);

  if (!org) {
    return null;
  }

  return {
    org: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      status: org.status,
    },
    subscription,
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
    actions: input.actions,
  };
}
