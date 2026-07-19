import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  buildBillingSettingsViewInput,
  createSettingsBillingDataRepository,
  type SettingsBillingQueryBuilder,
  type SettingsBillingQueryClient,
} from '@/lib/saas/settings-billing-data';
import { buildBillingSettingsView } from '@/lib/saas/ui-backend-contracts';

interface QueryResult {
  data: unknown;
  error: { message?: string } | null;
}

interface TestQueryBuilder extends SettingsBillingQueryBuilder {
  select: Mock<(columns: string) => SettingsBillingQueryBuilder>;
  eq: Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  in: Mock<(column: string, values: readonly unknown[]) => SettingsBillingQueryBuilder>;
  order: Mock<(column: string, options: { ascending: boolean }) => SettingsBillingQueryBuilder>;
  limit: Mock<(count: number) => SettingsBillingQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
}

function createChain(data: unknown, error: { message?: string } | null = null): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;

  chain.select = vi.fn(() => chain) as Mock<(columns: string) => SettingsBillingQueryBuilder>;
  chain.eq = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
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
        created_at: '2026-05-20T00:00:00.000Z',
      },
    ]);
    const from = vi
      .fn()
      .mockReturnValueOnce(organizationChain)
      .mockReturnValueOnce(subscriptionChain)
      .mockReturnValueOnce(invoiceChain)
      .mockReturnValueOnce(paymentOrdersChain)
      .mockReturnValueOnce(subscriptionPeriodsChain);
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
          status: 'paid',
          periodStart: '2026-05-20T00:00:00.000Z',
          periodEnd: '2026-06-20T00:00:00.000Z',
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
    expect(from).toHaveBeenNthCalledWith(4, 'payment_orders');
    expect(from).toHaveBeenNthCalledWith(5, 'subscription_periods');
    expect(subscriptionChain.select).toHaveBeenCalledWith(
      'provider, current_period_start, current_period_end, trial_end, cancel_at_period_end'
    );
    expect(organizationChain.select).toHaveBeenCalledWith(
      'id, name, plan, status, suspension_source, billing_email, tax_id'
    );
    expect(invoiceChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(invoiceChain.limit).toHaveBeenCalledWith(1);
    expect(from).not.toHaveBeenCalledWith('audit_logs');
    expect(paymentOrdersChain.limit).toHaveBeenCalledWith(24);
    expect(subscriptionPeriodsChain.limit).toHaveBeenCalledWith(24);
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
