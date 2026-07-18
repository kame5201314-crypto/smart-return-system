import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BillingSettingsView } from '@/lib/saas/ui-backend-contracts';

const billingMocks = vi.hoisted(() => ({
  result: {
    state: 'ready' as const,
    data: {
      org: {
        id: 'org-1',
        name: '測試商店',
        plan: 'basic' as const,
        status: 'trialing' as const,
      },
      subscription: {
        provider: 'manual' as const,
        currentPeriodStart: '2026-07-18T00:00:00.000Z',
        currentPeriodEnd: '2026-07-21T00:00:00.000Z',
        trialEnd: '2026-07-21T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
      invoiceSummary: {
        latestInvoiceId: 'invoice-1',
        latestInvoiceStatus: 'paid' as const,
        billingEmail: 'owner@example.com',
        taxId: null,
      },
      history: [
        {
          id: 'payment-order-1',
          plan: 'basic' as const,
          provider: 'ecpay' as const,
          periodStart: '2026-06-18T00:00:00.000Z',
          periodEnd: '2026-07-18T00:00:00.000Z',
          amountTwd: 499,
          status: 'paid' as const,
          paidAt: '2026-06-18T00:00:00.000Z',
          createdAt: '2026-06-18T00:00:00.000Z',
        },
      ],
      actions: {
        canUpdateBilling: false,
        canCancelRenewal: false,
        disabledReason: '線上付款目前尚未開放。',
      },
    } as BillingSettingsView,
  },
}));

vi.mock('@/lib/saas/settings-live-data', () => ({
  loadBillingSettingsView: () => billingMocks.result,
}));

import BillingSettingsPage from '@/app/(admin)/settings/billing/page';

async function renderPage(searchParams?: Promise<{ payment?: string; plan?: string }>) {
  render(await BillingSettingsPage({ searchParams }));
}

describe('BillingSettingsPage', () => {
  beforeEach(() => {
    billingMocks.result.data.org.status = 'trialing';
    billingMocks.result.data.org.plan = 'basic';
    billingMocks.result.data.subscription!.cancelAtPeriodEnd = false;
    billingMocks.result.data.actions.canUpdateBilling = false;
    billingMocks.result.data.actions.disabledReason = '線上付款目前尚未開放。';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows current plan, period dates, in-app plans, and payment history', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: '帳務與訂閱' })).toBeInTheDocument();
    expect(screen.getByText('測試商店')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '試用版' })).toBeInTheDocument();
    expect(screen.getByText('試用中')).toBeInTheDocument();
    expect(screen.getByText('2026/07/18')).toBeInTheDocument();
    expect(screen.getByText('2026/07/21')).toBeInTheDocument();
    expect(screen.getByText('選擇升級方案')).toBeInTheDocument();
    expect(screen.getAllByText(/不會自動續扣/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '入門版' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '成長版' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '大量需求' })).toBeInTheDocument();
    expect(screen.getByText('NT$499')).toBeInTheDocument();
    expect(screen.getByText('綠界科技')).toBeInTheDocument();
    expect(screen.getByText('已付款')).toBeInTheDocument();
    expect(screen.getByText('NT$499', { selector: 'td' })).toBeInTheDocument();
  });

  it('shows scheduled expiry without implying automatic renewal', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.subscription!.cancelAtPeriodEnd = true;

    await renderPage();

    expect(screen.getByText(/目前方案將於 2026\/07\/21 到期/)).toBeInTheDocument();
    expect(screen.getAllByText(/不會自動續扣/).length).toBeGreaterThan(0);
  });

  it('treats payment query parameters as a pending confirmation, not proof of payment', async () => {
    await renderPage(Promise.resolve({ payment: 'success', plan: 'growth' }));

    expect(screen.getByText('付款結果已送出')).toBeInTheDocument();
    expect(screen.getByText(/請以本頁的目前方案及付款紀錄為準/)).toBeInTheDocument();
  });

  it('posts the selected plan and submits the provider hidden form', async () => {
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          checkout: {
            action: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
            fields: { MerchantTradeNo: 'trade-1', TradeAmt: '699' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => undefined);

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /選擇成長版並付款/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/saas/billing/checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ plan: 'growth' }),
      })
    );
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const form = document.querySelector(
      'form[action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"]'
    );
    expect(form).not.toBeNull();
    expect(form?.querySelector('input[name="MerchantTradeNo"]')).toHaveValue('trade-1');
  });

  it('allows an active customer to prepay one more month on the current plan', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;

    await renderPage();

    expect(screen.getByRole('button', { name: /續購 1 個月/ })).toBeEnabled();
  });

  it('keeps growth-to-basic downgrade disabled while allowing growth renewal', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.org.plan = 'growth';
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;

    await renderPage();

    expect(screen.getByRole('button', { name: '暫不支援線上降級' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /續購 1 個月/ })).toBeEnabled();
  });

  it('requires assisted plan changes for an enterprise customer', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.org.plan = 'enterprise';
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;

    await renderPage();

    const assistedChangeButtons = screen.getAllByRole('button', {
      name: '請聯絡客服變更方案',
    });
    expect(assistedChangeButtons).toHaveLength(2);
    assistedChangeButtons.forEach((button) => expect(button).toBeDisabled());
  });

  it('rejects checkout forms that point outside the ECPay allowlist', async () => {
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          checkout: {
            action: 'https://example.com/collect-payment',
            fields: { MerchantTradeNo: 'trade-unsafe' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => undefined);

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /選擇成長版並付款/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('付款服務回應不完整');
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelector('form[action="https://example.com/collect-payment"]')).toBeNull();
  });
});
