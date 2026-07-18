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
  order: Mock<(column: string, options: { ascending: boolean }) => SettingsBillingQueryBuilder>;
  limit: Mock<(count: number) => SettingsBillingQueryBuilder>;
  maybeSingle: Mock<() => Promise<QueryResult>>;
}

function createChain(data: unknown, error: { message?: string } | null = null): TestQueryBuilder {
  const chain = {} as TestQueryBuilder;

  chain.select = vi.fn(() => chain) as Mock<(columns: string) => SettingsBillingQueryBuilder>;
  chain.eq = vi.fn(() => chain) as Mock<(column: string, value: unknown) => SettingsBillingQueryBuilder>;
  chain.order = vi.fn(() => chain) as Mock<(column: string, options: { ascending: boolean }) => SettingsBillingQueryBuilder>;
  chain.limit = vi.fn(() => chain) as Mock<(count: number) => SettingsBillingQueryBuilder>;
  chain.maybeSingle = vi.fn(async () => ({ data, error }));

  return chain;
}

describe('SaaS settings billing data repository', () => {
  it('loads organization, subscription, and latest invoice data for billing settings DTOs', async () => {
    const organizationChain = createChain({
      id: 'org-1',
      name: 'Demo Store',
      plan: 'growth',
      status: 'active',
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
    const from = vi
      .fn()
      .mockReturnValueOnce(organizationChain)
      .mockReturnValueOnce(subscriptionChain)
      .mockReturnValueOnce(invoiceChain);
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
        status: 'active',
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
    });
    expect(buildBillingSettingsView(input!)).toMatchObject({
      invoiceSummary: {
        latestInvoiceStatus: 'failed',
      },
    });
    expect(from).toHaveBeenNthCalledWith(1, 'organizations');
    expect(from).toHaveBeenNthCalledWith(2, 'subscriptions');
    expect(from).toHaveBeenNthCalledWith(3, 'invoices');
    expect(subscriptionChain.select).toHaveBeenCalledWith(
      'provider, current_period_start, current_period_end, trial_end, cancel_at_period_end'
    );
    expect(invoiceChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(invoiceChain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when organization billing data is missing', async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(createChain(null))
      .mockReturnValueOnce(createChain(null))
      .mockReturnValueOnce(createChain(null));
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
