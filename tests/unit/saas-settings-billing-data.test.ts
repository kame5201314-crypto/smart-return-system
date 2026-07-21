import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  buildBillingSettingsViewInput,
  createSettingsBillingDataRepository,
  resolveCurrentEntitlementStart,
  type SettingsBillingQueryBuilder,
  type SettingsBillingQueryClient,
} from '@/lib/saas/settings-billing-data';
import { buildBillingSettingsView } from '@/lib/saas/ui-backend-contracts';

interface QueryResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface TestQueryBuilder extends SettingsBillingQueryBuilder {
  select: Mock<(columns: string) => SettingsBillingQueryBuilder>;
  eq: Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  gt: Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  lte: Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  in: Mock<(column: string, values: readonly unknown[]) => SettingsBillingQueryBuilder>;
  order: Mock<(column: string, options: { ascending: boolean }) => SettingsBillingQueryBuilder>;
  limit: Mock<(count: number) => SettingsBillingQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
}

function createChain(
  data: unknown,
  error: { code?: string; message?: string } | null = null
): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;

  chain.select = vi.fn(() => chain) as Mock<(columns: string) => SettingsBillingQueryBuilder>;
  chain.eq = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  chain.gt = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  chain.lte = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  chain.in = vi.fn(() => chain) as Mock<
    (column: string, values: readonly unknown[]) => SettingsBillingQueryBuilder
  >;
  chain.order = vi.fn(() => chain) as Mock<(column: string, options: { ascending: boolean }) => SettingsBillingQueryBuilder>;
  chain.limit = vi.fn(() => chain) as Mock<(count: number) => SettingsBillingQueryBuilder>;
  chain.maybeSingle = vi.fn(async () => ({ data, error }));
  chain.then = ((onfulfilled, onrejected) =>
    Promise.resolve({ data, error }).then(onfulfilled, onrejected)) as TestQueryBuilder['then'];

  return chain;
}

describe('SaaS settings billing data repository', () => {
  it('shows the period usable now instead of a future early-renewal start', () => {
    expect(resolveCurrentEntitlementStart({
      currentPeriodStart: '2026-08-19T16:14:07.000Z',
      periods: [
        {
          paymentOrderId: 'first-payment',
          periodStart: '2026-07-19T16:14:07.000Z',
          periodEnd: '2026-08-19T16:14:07.000Z',
        },
        {
          paymentOrderId: 'early-renewal',
          periodStart: '2026-08-19T16:14:07.000Z',
          periodEnd: '2026-09-19T16:14:07.000Z',
        },
      ],
      now: '2026-07-21T04:30:00.000Z',
    })).toBe('2026-07-19T16:14:07.000Z');
  });

  it('keeps the subscription aggregate when no paid period covers now', () => {
    expect(resolveCurrentEntitlementStart({
      currentPeriodStart: '2026-07-21T04:30:00.000Z',
      periods: [],
      now: '2026-07-21T04:30:00.000Z',
    })).toBe('2026-07-21T04:30:00.000Z');
  });

  it('loads organization, subscription, and latest invoice data for billing settings DTOs', async () => {
    const organizationChain = createChain({
      id: 'org-1',
      name: 'Demo Store',
      plan: 'growth',
      status: 'suspended',
      suspension_source: 'platform_admin',
      billing_email: 'billing@example.com',
      tax_id: '12345678',
    });
    const subscriptionChain = createChain({
      provider: 'manual',
      current_period_start: '2026-05-01T00:00:00.000Z',
      current_period_end: '2026-06-01T00:00:00.000Z',
      trial_end: '2026-05-15T00:00:00.000Z',
      cancel_at_period_end: false,
    });
    const invoiceChain = createChain({
      id: 'invoice-1',
      status: 'failed',
      created_at: '2026-05-20T00:00:00.000Z',
    });
    const paymentOrdersChain = createChain([
      {
        id: 'payment-order-1',
        plan: 'growth',
        provider: 'ecpay',
        provider_mode: 'production',
        amount_twd: 699,
        status: 'paid',
        paid_at: '2026-05-20T00:00:00.000Z',
        created_at: '2026-05-20T00:00:00.000Z',
      },
    ]);
    const subscriptionPeriodsChain = createChain([
      {
        payment_order_id: 'payment-order-1',
        period_start: '2026-05-20T00:00:00.000Z',
        period_end: '2026-06-20T00:00:00.000Z',
        status: 'expired',
        created_at: '2026-05-20T00:00:00.000Z',
      },
    ]);
    const customOffersChain = createChain([
      {
        id: 'custom-offer-1',
        title: '首批導入專案',
        description: '包含初始資料整理。',
        amount_twd: 2680,
        status: 'active',
        expires_at: '2099-08-31T12:00:00.000Z',
        billing_period_months: 1,
        created_at: '2026-07-20T00:00:00.000Z',
      },
    ]);
    const currentSubscriptionPeriodChain = createChain(null);
    const from = vi
      .fn()
      .mockReturnValueOnce(organizationChain)
      .mockReturnValueOnce(subscriptionChain)
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(customOffersChain)
      .mockReturnValueOnce(paymentOrdersChain)
      .mockReturnValueOnce(subscriptionPeriodsChain)
      .mockReturnValueOnce(currentSubscriptionPeriodChain);
    const repository = createSettingsBillingDataRepository({ from } as SettingsBillingQueryClient);

    const input = await buildBillingSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: {
        canUpdateBilling: true,
        canCancelRenewal: false,
      },
    });

    expect(input).toMatchObject({
      org: {
        id: 'org-1',
        plan: 'growth',
        status: 'suspended',
        suspensionSource: 'platform_admin',
      },
      subscription: {
        provider: 'manual',
        trialEnd: '2026-05-15T00:00:00.000Z',
      },
      invoiceSummary: {
        latestInvoiceId: 'invoice-1',
        latestInvoiceStatus: 'failed',
        billingEmail: 'billing@example.com',
        taxId: '12345678',
      },
      history: [
        {
          id: 'payment-order-1',
          plan: 'growth',
          providerMode: 'production',
          status: 'paid',
          periodStart: '2026-05-20T00:00:00.000Z',
          periodEnd: '2026-06-20T00:00:00.000Z',
        },
      ],
      customOffers: [
        {
          id: 'custom-offer-1',
          title: '首批導入專案',
          amountTwd: 2680,
          expiresAt: '2099-08-31T12:00:00.000Z',
          billingPeriodMonths: 1,
        },
      ],
    });
    expect(buildBillingSettingsView(input!)).toMatchObject({
      invoiceSummary: {
        latestInvoiceStatus: 'failed',
      },
    });
    expect(from).toHaveBeenNthCalledWith(1, 'organizations');
    expect(from).toHaveBeenNthCalledWith(2, 'subscriptions');
    expect(from).toHaveBeenNthCalledWith(3, 'invoices');
    expect(from).toHaveBeenNthCalledWith(4, 'custom_plan_offers');
    expect(from).toHaveBeenNthCalledWith(5, 'payment_orders');
    expect(from).toHaveBeenNthCalledWith(6, 'subscription_periods');
    expect(from).toHaveBeenNthCalledWith(7, 'subscription_periods');
    expect(subscriptionChain.select).toHaveBeenCalledWith(
      'provider, current_period_start, current_period_end, trial_end, cancel_at_period_end'
    );
    expect(organizationChain.select).toHaveBeenCalledWith(
      'id, name, plan, status, suspension_source, billing_email, tax_id'
    );
    expect(invoiceChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(invoiceChain.limit).toHaveBeenCalledWith(1);
    expect(from).not.toHaveBeenCalledWith('audit_logs');
    expect(paymentOrdersChain.select).toHaveBeenCalledWith(
      'id, plan, provider, provider_mode, amount_twd, status, paid_at, created_at'
    );
    expect(paymentOrdersChain.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(paymentOrdersChain.limit).toHaveBeenCalledWith(24);
    expect(subscriptionPeriodsChain.limit).toHaveBeenCalledWith(24);
    expect(subscriptionPeriodsChain.select).toHaveBeenCalledWith(
      'payment_order_id, period_start, period_end, status, created_at'
    );
    expect(currentSubscriptionPeriodChain.eq).toHaveBeenCalledWith('status', 'active');
    expect(currentSubscriptionPeriodChain.lte).toHaveBeenCalledWith(
      'period_start',
      expect.any(String)
    );
    expect(currentSubscriptionPeriodChain.gt).toHaveBeenCalledWith(
      'period_end',
      expect.any(String)
    );
    expect(customOffersChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(customOffersChain.eq).toHaveBeenCalledWith('status', 'active');
    expect(customOffersChain.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(customOffersChain.limit).toHaveBeenCalledWith(12);
  });

  it('normalizes the scrubbed manual payment RPC and drops malformed rows', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: 'manual:event-1',
          plan: null,
          provider: 'manual',
          amount_twd: 399,
          status: 'paid',
          paid_at: '2026-07-21T04:30:00.000Z',
          period_start: '2026-07-21T00:00:00+08:00',
          period_end: '2026-08-21T00:00:00+08:00',
          created_at: '2026-07-21T04:30:01.000Z',
        },
        {
          id: 'manual:zero-amount',
          provider: 'manual',
          amount_twd: 0,
          status: 'paid',
          paid_at: '2026-07-21T04:30:00.000Z',
          period_start: '2026-07-21T00:00:00+08:00',
          period_end: '2026-08-21T00:00:00+08:00',
          created_at: '2026-07-21T04:30:01.000Z',
        },
        {
          id: 'manual:invalid-period',
          provider: 'manual',
          amount_twd: 399,
          status: 'paid',
          paid_at: '2026-07-21T04:30:00.000Z',
          period_start: '2026-08-21T00:00:00+08:00',
          period_end: '2026-07-21T00:00:00+08:00',
          created_at: '2026-07-21T04:30:01.000Z',
        },
      ],
      error: null,
    }));
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(),
      rpc,
    } as unknown as SettingsBillingQueryClient);

    await expect(repository.listManualPaymentHistory?.({
      orgId: 'org-1',
      limit: 50,
    })).resolves.toEqual([
      {
        id: 'manual:event-1',
        plan: null,
        provider: 'manual',
        providerMode: null,
        amountTwd: 399,
        status: 'paid',
        paidAt: '2026-07-21T04:30:00.000Z',
        periodStart: '2026-07-21T00:00:00+08:00',
        periodEnd: '2026-08-21T00:00:00+08:00',
        createdAt: '2026-07-21T04:30:01.000Z',
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('list_customer_manual_payment_history', {
      p_org_id: 'org-1',
      p_limit: 50,
    });
  });

  it.each([
    ['PGRST202', 'function is not available'],
    ['42883', 'function public.list_customer_manual_payment_history(uuid, integer) does not exist'],
  ])(
    'treats only a missing manual history RPC (%s) as an empty rollout result',
    async (code, message) => {
      const repository = createSettingsBillingDataRepository({
        from: vi.fn(),
        rpc: vi.fn(async () => ({
          data: null,
          error: { code, message },
        })),
      } as unknown as SettingsBillingQueryClient);

      await expect(repository.listManualPaymentHistory?.({ orgId: 'org-1' }))
        .resolves.toEqual([]);
    }
  );

  it('does not hide an undefined-function error raised inside the manual history RPC', async () => {
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '42883', message: 'operator does not exist: jsonb = text' },
      })),
    } as unknown as SettingsBillingQueryClient);

    await expect(repository.listManualPaymentHistory?.({ orgId: 'org-1' }))
      .rejects.toThrow('operator does not exist: jsonb = text');
  });

  it('surfaces manual history authorization and operational errors', async () => {
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '42501', message: 'active owner or admin membership is required' },
      })),
    } as unknown as SettingsBillingQueryClient);

    await expect(repository.listManualPaymentHistory?.({ orgId: 'org-1' }))
      .rejects.toThrow('active owner or admin membership is required');
  });

  it('normalizes one authoritative provider and manual payment history RPC', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        history: [
          {
            id: 'payment-order-1',
            plan: 'basic',
            provider: 'ecpay',
            amount_twd: 399,
            status: 'refunded',
            paid_at: '2026-07-21T04:30:00.000Z',
            period_start: '2026-07-21T04:30:00.000Z',
            period_end: '2026-08-21T04:30:00.000Z',
            created_at: '2026-07-21T04:29:00.000Z',
          },
          {
            id: 'manual:event-1',
            plan: null,
            provider: 'manual',
            amount_twd: 399,
            status: 'paid',
            paid_at: '2026-07-20T04:30:00.000Z',
            period_start: '2026-07-20T00:00:00+08:00',
            period_end: '2026-08-20T00:00:00+08:00',
            created_at: '2026-07-20T04:30:01.000Z',
          },
          {
            id: 'payment-order-invalid-period',
            plan: 'basic',
            provider: 'ecpay',
            amount_twd: 399,
            status: 'paid',
            paid_at: '2026-07-19T04:30:00.000Z',
            period_start: '2026-08-19T04:30:00.000Z',
            period_end: null,
            created_at: '2026-07-19T04:29:00.000Z',
          },
        ],
        current_entitlement_period: {
          payment_order_id: 'manual:event-1',
          period_start: '2026-07-20T00:00:00+08:00',
          period_end: '2026-08-20T00:00:00+08:00',
        },
      },
      error: null,
    }));
    const providerModeChain = createChain([
      { id: 'payment-order-1', provider_mode: 'test' },
    ]);
    const from = vi.fn(() => providerModeChain);
    const repository = createSettingsBillingDataRepository({
      from,
      rpc,
    } as unknown as SettingsBillingQueryClient);

    await expect(repository.listPaymentHistory?.({ orgId: 'org-1', limit: 30 }))
      .resolves.toEqual({
        history: [
          {
            id: 'payment-order-1',
            plan: 'basic',
            provider: 'ecpay',
            providerMode: 'test',
            amountTwd: 399,
            status: 'refunded',
            paidAt: '2026-07-21T04:30:00.000Z',
            periodStart: '2026-07-21T04:30:00.000Z',
            periodEnd: '2026-08-21T04:30:00.000Z',
            createdAt: '2026-07-21T04:29:00.000Z',
          },
          {
            id: 'manual:event-1',
            plan: null,
            provider: 'manual',
            providerMode: null,
            amountTwd: 399,
            status: 'paid',
            paidAt: '2026-07-20T04:30:00.000Z',
            periodStart: '2026-07-20T00:00:00+08:00',
            periodEnd: '2026-08-20T00:00:00+08:00',
            createdAt: '2026-07-20T04:30:01.000Z',
          },
        ],
        currentEntitlementPeriod: {
          paymentOrderId: 'manual:event-1',
          periodStart: '2026-07-20T00:00:00+08:00',
          periodEnd: '2026-08-20T00:00:00+08:00',
          providerMode: null,
        },
      });
    expect(rpc).toHaveBeenCalledWith('list_customer_payment_history', {
      p_org_id: 'org-1',
      p_limit: 30,
    });
    expect(from).toHaveBeenCalledWith('payment_orders');
    expect(providerModeChain.select).toHaveBeenCalledWith('id, provider_mode');
    expect(providerModeChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(providerModeChain.in).toHaveBeenCalledWith('id', ['payment-order-1']);
  });

  it.each([
    ['PGRST202', 'function is not available'],
    ['42883', 'function public.list_customer_payment_history(uuid, integer) does not exist'],
  ])(
    'uses the split-query fallback only while authoritative history RPC %s is unavailable',
    async (code, message) => {
      const repository = createSettingsBillingDataRepository({
        from: vi.fn(),
        rpc: vi.fn(async () => ({ data: null, error: { code, message } })),
      } as unknown as SettingsBillingQueryClient);

      await expect(repository.listPaymentHistory?.({ orgId: 'org-1' })).resolves.toBeNull();
    }
  );

  it('surfaces authoritative history authorization errors', async () => {
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '42501', message: 'active owner or admin membership is required' },
      })),
    } as unknown as SettingsBillingQueryClient);

    await expect(repository.listPaymentHistory?.({ orgId: 'org-1' }))
      .rejects.toThrow('active owner or admin membership is required');
  });

  it('keeps the newest 24 authoritative entries with deterministic ties and no fallback queries', async () => {
    const history = Array.from({ length: 26 }, (_, index) => ({
      id: `payment-${String(index).padStart(2, '0')}`,
      plan: 'basic',
      provider: 'ecpay',
      providerMode: null,
      amountTwd: 399,
      status: 'paid',
      paidAt: index < 2
        ? '2026-07-21T12:00:00.000Z'
        : new Date(Date.UTC(2026, 6, 21, 11, 59, 59 - index)).toISOString(),
      periodStart: '2026-07-21T00:00:00.000Z',
      periodEnd: '2026-08-21T00:00:00.000Z',
      createdAt: index < 2
        ? '2026-07-21T11:00:00.000Z'
        : new Date(Date.UTC(2026, 6, 21, 10, 59, 59 - index)).toISOString(),
    }));
    const repository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'History Store',
        plan: 'basic',
        status: 'active',
        suspensionSource: null,
        billingEmail: null,
        taxId: null,
      })),
      getSubscription: vi.fn(async () => null),
      getLatestInvoice: vi.fn(async () => null),
      listPaymentHistory: vi.fn(async () => ({
        history: [...history].reverse(),
        currentEntitlementPeriod: null,
      })),
      listPaymentOrders: vi.fn(async () => []),
      listManualPaymentHistory: vi.fn(async () => []),
      listSubscriptionPeriods: vi.fn(async () => []),
    };

    const input = await buildBillingSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: { canUpdateBilling: true, canCancelRenewal: false },
    });

    expect(input?.history).toHaveLength(24);
    expect(input?.history?.slice(0, 2).map((item) => item.id)).toEqual([
      'payment-00',
      'payment-01',
    ]);
    expect(repository.listPaymentOrders).not.toHaveBeenCalled();
    expect(repository.listManualPaymentHistory).not.toHaveBeenCalled();
    expect(repository.listSubscriptionPeriods).not.toHaveBeenCalled();
  });

  it('resolves the current entitlement independently from the bounded history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T04:30:00.000Z'));
    const history = Array.from({ length: 24 }, (_, index) => ({
      id: `pending-${index}`,
      plan: 'basic',
      provider: 'ecpay',
      providerMode: null,
      amountTwd: 399,
      status: 'pending',
      paidAt: null,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date(Date.UTC(2026, 6, 21, 4, 29, 59 - index)).toISOString(),
    }));
    const repository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'Early Renewal Store',
        plan: 'basic',
        status: 'active',
        suspensionSource: null,
        billingEmail: null,
        taxId: null,
      })),
      getSubscription: vi.fn(async () => ({
        provider: 'ecpay',
        currentPeriodStart: '2026-08-19T04:30:00.000Z',
        currentPeriodEnd: '2026-09-19T04:30:00.000Z',
        trialEnd: null,
        cancelAtPeriodEnd: false,
      })),
      getLatestInvoice: vi.fn(async () => null),
      listPaymentHistory: vi.fn(async () => ({
        history,
        currentEntitlementPeriod: {
          paymentOrderId: 'older-current-payment',
          periodStart: '2026-07-19T04:30:00.000Z',
          periodEnd: '2026-08-19T04:30:00.000Z',
        },
      })),
      listPaymentOrders: vi.fn(async () => []),
      listManualPaymentHistory: vi.fn(async () => []),
      listSubscriptionPeriods: vi.fn(async () => []),
    };

    const input = await buildBillingSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: { canUpdateBilling: true, canCancelRenewal: false },
    });

    expect(input?.history).toHaveLength(24);
    expect(input?.subscription?.currentPeriodStart).toBe('2026-07-19T04:30:00.000Z');
    expect(repository.listPaymentOrders).not.toHaveBeenCalled();
    expect(repository.listManualPaymentHistory).not.toHaveBeenCalled();
    expect(repository.listSubscriptionPeriods).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('fetches candidates by updated time and merges history by paid or created time', async () => {
    const paymentOrdersChain = createChain([
      {
        id: 'delayed-paid-order',
        plan: 'basic',
        provider: 'ecpay',
        amount_twd: 399,
        status: 'paid',
        paid_at: '2026-07-21T14:00:00.000Z',
        created_at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'newer-pending-order',
        plan: 'basic',
        provider: 'ecpay',
        amount_twd: 399,
        status: 'pending',
        paid_at: null,
        created_at: '2026-07-21T13:00:00.000Z',
      },
    ]);
    const paymentRepository = createSettingsBillingDataRepository({
      from: vi.fn(() => paymentOrdersChain),
    } as SettingsBillingQueryClient);
    const paymentOrders = await paymentRepository.listPaymentOrders?.({
      orgId: 'org-1',
      limit: 24,
    });
    expect(paymentOrdersChain.order).toHaveBeenCalledWith('updated_at', { ascending: false });

    const repository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'History Store',
        plan: 'basic',
        status: 'active',
        suspensionSource: null,
        billingEmail: null,
        taxId: null,
      })),
      getSubscription: vi.fn(async () => null),
      getLatestInvoice: vi.fn(async () => null),
      listPaymentOrders: vi.fn(async () => paymentOrders ?? []),
      listManualPaymentHistory: vi.fn(async () => [{
        id: 'manual:event-1',
        plan: null,
        provider: 'manual' as const,
        providerMode: null,
        amountTwd: 399,
        status: 'paid' as const,
        paidAt: '2026-07-21T12:00:00.000Z',
        periodStart: '2026-07-21T00:00:00+08:00',
        periodEnd: '2026-08-21T00:00:00+08:00',
        createdAt: '2026-07-21T12:00:01.000Z',
      }]),
    };

    const input = await buildBillingSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: { canUpdateBilling: true, canCancelRenewal: false },
    });

    expect(input?.history?.map((item) => item.id)).toEqual([
      'delayed-paid-order',
      'newer-pending-order',
      'manual:event-1',
    ]);
    expect(input?.history?.[2]).toMatchObject({ plan: null, provider: 'manual' });
    expect(repository.listManualPaymentHistory).toHaveBeenCalledWith({
      orgId: 'org-1',
      limit: 24,
    });
  });

  it('keeps only active unexpired offers for the current organization', async () => {
    const baseOffer = {
      id: 'custom-offer-active',
      title: '專屬方案',
      description: null,
      amountTwd: 1680,
      status: 'active' as const,
      expiresAt: '2099-08-31T12:00:00.000Z',
      billingPeriodMonths: 1,
      createdAt: '2026-07-20T00:00:00.000Z',
    };
    const repository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'Offer Store',
        plan: 'basic',
        status: 'trialing',
        suspensionSource: null,
        billingEmail: null,
        taxId: null,
      })),
      getSubscription: vi.fn(async () => null),
      getLatestInvoice: vi.fn(async () => null),
      listCustomPlanOffers: vi.fn(async () => [
        baseOffer,
        { ...baseOffer, id: 'custom-offer-paid', status: 'paid' as const },
        {
          ...baseOffer,
          id: 'custom-offer-expired',
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
      ]),
    };

    const input = await buildBillingSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: { canUpdateBilling: true, canCancelRenewal: false },
    });

    expect(repository.listCustomPlanOffers).toHaveBeenCalledWith({ orgId: 'org-1', limit: 12 });
    expect(input?.customOffers).toEqual([
      {
        id: 'custom-offer-active',
        title: '專屬方案',
        description: null,
        amountTwd: 1680,
        expiresAt: '2099-08-31T12:00:00.000Z',
        billingPeriodMonths: 1,
      },
    ]);
  });

  it('hides custom offers only while the optional migration schema is unavailable', async () => {
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(() => createChain(null, {
        code: 'PGRST205',
        message: 'custom_plan_offers was not found in the schema cache',
      })),
    } as SettingsBillingQueryClient);

    await expect(
      repository.listCustomPlanOffers?.({ orgId: 'org-1' })
    ).resolves.toEqual([]);

  });

  it('keeps public checkout available while surfacing a custom-offer query failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fallbackRepository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'Fallback Store',
        plan: 'basic',
        status: 'trialing',
        suspensionSource: null,
        billingEmail: null,
        taxId: null,
      })),
      getSubscription: vi.fn(async () => null),
      getLatestInvoice: vi.fn(async () => null),
      listCustomPlanOffers: vi.fn(async () => {
        throw new Error('custom_plan_offers is unavailable');
      }),
    };

    await expect(buildBillingSettingsViewInput(fallbackRepository, {
      orgId: 'org-1',
      actions: { canUpdateBilling: true, canCancelRenewal: false },
    })).resolves.toMatchObject({
      customOffers: [],
      customOffersUnavailable: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load custom plan offers for the billing view.'
    );
  });

  it('returns null when organization billing data is missing', async () => {
    const from = vi.fn().mockReturnValueOnce(createChain(null));
    const repository = createSettingsBillingDataRepository({ from } as SettingsBillingQueryClient);

    await expect(
      buildBillingSettingsViewInput(repository, {
        orgId: 'missing-org',
        actions: {
          canUpdateBilling: false,
          canCancelRenewal: false,
        },
      })
    ).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('uses the audit log only as a legacy suspension-source fallback', async () => {
    const repository = {
      getOrganizationBilling: vi.fn(async () => ({
        id: 'org-1',
        name: 'Legacy Store',
        plan: 'basic',
        status: 'suspended',
        billingEmail: null,
        taxId: null,
      })),
      getSubscription: vi.fn(async () => null),
      getLatestInvoice: vi.fn(async () => null),
      getSuspensionSource: vi.fn(async () => 'trial_expired' as const),
    };

    await expect(buildBillingSettingsViewInput(repository, {
      orgId: 'org-1',
      actions: { canUpdateBilling: true, canCancelRenewal: false },
    })).resolves.toMatchObject({
      org: { suspensionSource: 'trial_expired' },
    });
    expect(repository.getSuspensionSource).toHaveBeenCalledWith({ orgId: 'org-1' });
  });

  it('maps the latest trial-expiry suspension audit without guessing from trial dates', async () => {
    const auditChain = createChain({
      action: 'lifecycle.trial_expired_suspended',
      created_at: '2026-07-19T00:00:00.000Z',
    });
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(() => auditChain),
    } as SettingsBillingQueryClient);

    await expect(repository.getSuspensionSource?.({ orgId: 'org-1' })).resolves.toBe(
      'trial_expired'
    );
  });

  it('maps prepaid-period expiry suspension audits to billing', async () => {
    const auditChain = createChain({
      action: 'lifecycle.prepaid_period_expired_suspended',
      created_at: '2026-09-19T16:14:07.000Z',
    });
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(() => auditChain),
    } as SettingsBillingQueryClient);

    await expect(repository.getSuspensionSource?.({ orgId: 'org-1' })).resolves.toBe(
      'billing'
    );
    expect(auditChain.in).toHaveBeenCalledWith('action', expect.arrayContaining([
      'lifecycle.prepaid_period_expired_suspended',
    ]));
  });

  it('keeps the suspension source null when no matching audit exists', async () => {
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(() => createChain(null)),
    } as SettingsBillingQueryClient);

    await expect(repository.getSuspensionSource?.({ orgId: 'org-1' })).resolves.toBeNull();
  });

  it('surfaces repository query errors instead of serving partial billing data', async () => {
    const repository = createSettingsBillingDataRepository({
      from: vi.fn(() =>
        createChain(null, {
          message: 'database unavailable',
        })
      ),
    } as SettingsBillingQueryClient);

    await expect(
      repository.getOrganizationBilling({
        orgId: 'org-1',
      })
    ).rejects.toThrow('database unavailable');
  });
});
