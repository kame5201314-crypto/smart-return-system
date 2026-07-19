import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        suspensionSource: null,
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

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMocks,
}));

vi.mock('@/lib/saas/settings-live-data', () => ({
  loadBillingSettingsView: () => billingMocks.result,
}));

import BillingSettingsPage from '@/app/(admin)/settings/billing/page';

async function renderPage(searchParams?: Promise<{
  payment?: string;
  plan?: string;
  trade?: string;
}>) {
  return render(await BillingSettingsPage({ searchParams }));
}

describe('BillingSettingsPage', () => {
  beforeEach(() => {
    navigationMocks.replace.mockReset();
    navigationMocks.refresh.mockReset();
    billingMocks.result.data.org.status = 'trialing';
    billingMocks.result.data.org.plan = 'basic';
    billingMocks.result.data.org.suspensionSource = null;
    billingMocks.result.data.subscription!.cancelAtPeriodEnd = false;
    billingMocks.result.data.actions.canUpdateBilling = false;
    billingMocks.result.data.actions.disabledReason = '線上付款目前尚未開放。';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows current plan, period dates, in-app plans, and payment history', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: '帳務與訂閱' })).toBeInTheDocument();
    expect(screen.queryByText('測試商店')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '試用版' })).toBeInTheDocument();
    expect(screen.getByText('試用中')).toBeInTheDocument();
    expect(screen.getByText('2026/07/18')).toBeInTheDocument();
    expect(screen.getByText('2026/07/21')).toBeInTheDocument();
    expect(screen.getByText('升級方案')).toBeInTheDocument();
    expect(screen.getAllByText(/不會自動續扣/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '入門版' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '成長版' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '大量需求' })).not.toBeInTheDocument();
    expect(screen.getByText('NT$399')).toBeInTheDocument();
    expect(screen.getAllByText('NT$499').length).toBeGreaterThan(0);
    expect(screen.getAllByText('綠界科技').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已付款').length).toBeGreaterThan(0);
    expect(screen.getByText('NT$499', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('聯絡客服')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/pricing"]')).toBeNull();
  });

  it('shows an expired self-service trial as 試用版 without exposing the organization name', async () => {
    billingMocks.result.data.org.status = 'suspended';
    billingMocks.result.data.org.suspensionSource = 'trial_expired';

    await renderPage();

    expect(screen.getByRole('heading', { name: '試用版' })).toBeInTheDocument();
    expect(screen.getByText('試用已到期')).toBeInTheDocument();
    expect(screen.getByText('試用到期日')).toBeInTheDocument();
    expect(screen.queryByText('測試商店')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '入門版', level: 2 })).not.toBeInTheDocument();
  });

  it('does not mislabel a platform-suspended paid workspace as a trial', async () => {
    billingMocks.result.data.org.status = 'suspended';
    billingMocks.result.data.org.suspensionSource = 'platform_admin';
    billingMocks.result.data.actions.canUpdateBilling = false;
    billingMocks.result.data.actions.disabledReason =
      '此工作區已由平台管理員停權，暫時無法線上付款；請由平台管理員解除停權後再試。';

    await renderPage();

    expect(screen.getByRole('heading', { name: '入門版', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('已暫停')).toBeInTheDocument();
    expect(screen.getByText(/平台管理員停權/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /升級至入門版/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /升級至成長版/ })).toBeDisabled();
    expect(screen.queryByText('試用已到期')).not.toBeInTheDocument();
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

  it('polls the exact pending order and refreshes after server-confirmed payment', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ success: true, status: 'pending' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ success: true, status: 'paid' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ));
    vi.stubGlobal('fetch', fetchMock);

    await renderPage(Promise.resolve({ payment: 'pending', trade: 'SR20260720PAY01' }));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/saas/billing/payment-status?trade=SR20260720PAY01',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      })
    );
    expect(navigationMocks.replace).toHaveBeenCalledWith(
      '/settings/billing?payment=success'
    );
    expect(navigationMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['failed', 'failed'],
    ['manual_review', 'review'],
    ['expired', 'expired'],
    ['cancelled', 'cancelled'],
    ['refunded', 'refunded'],
  ] as const)('maps terminal payment status %s to %s', async (status, queryState) => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, status }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )));

    await renderPage(Promise.resolve({ payment: 'pending', trade: 'SR20260720PAY01' }));
    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(navigationMocks.replace).toHaveBeenCalledWith(
      `/settings/billing?payment=${queryState}`
    );
    expect(navigationMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('stops polling after fifteen attempts instead of polling forever', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ success: true, status: 'pending' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    await renderPage(Promise.resolve({ payment: 'pending', trade: 'SR20260720PAY01' }));
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchMock).toHaveBeenCalledTimes(15);

    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(navigationMocks.replace).not.toHaveBeenCalled();
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });

  it('does not poll without a validated trade number and stops after unmount', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ success: true, status: 'pending' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    await renderPage(Promise.resolve({ payment: 'pending' }));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).not.toHaveBeenCalled();

    cleanup();
    const view = await renderPage(
      Promise.resolve({ payment: 'pending', trade: 'SR20260720PAY01' })
    );
    view.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).not.toHaveBeenCalled();
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
            fields: { MerchantTradeNo: 'trade-1', TradeAmt: '399' },
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
    fireEvent.click(screen.getByRole('button', { name: /升級至入門版 NT\$399/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/saas/billing/checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ plan: 'basic' }),
        signal: expect.any(AbortSignal),
      })
    );
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const form = document.querySelector(
      'form[action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5"]'
    );
    expect(form).not.toBeNull();
    expect(form?.querySelector('input[name="MerchantTradeNo"]')).toHaveValue('trade-1');
    expect(form?.querySelector('input[name="TradeAmt"]')).toHaveValue('399');
  });

  it('aborts checkout after ten seconds and lets the user retry', async () => {
    vi.useFakeTimers();
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const abortError = new Error('internal timeout detail');
          abortError.name = 'AbortError';
          reject(abortError);
        }, { once: true });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /升級至入門版 NT\$399/ }));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    const checkoutSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal | undefined;
    expect(checkoutSignal?.aborted).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('等待付款服務回應逾時，請稍後再試。');
    expect(screen.queryByText('internal timeout detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /升級至入門版 NT\$399/ })).toBeEnabled();
  });

  it('shows a friendly Traditional Chinese checkout rate-limit message', async () => {
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: false,
      error: 'Too many checkout orders were created. Please retry later.',
      code: 'checkout_rate_limited',
      retryAfterSeconds: 73,
    }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    })));

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /升級至入門版 NT\$399/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '付款操作過於頻繁，請在 73 秒後再試。'
    );
    expect(screen.queryByText(/Too many checkout orders/)).not.toBeInTheDocument();
  });

  it('does not expose backend checkout error details', async () => {
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      success: false,
      error: 'relation payment_orders does not exist; tenant=secret-org',
      code: 'lookup_failed',
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })));

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /升級至成長版 NT\$699/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '目前無法建立付款流程，請稍後再試。'
    );
    expect(screen.queryByText(/payment_orders|secret-org/)).not.toBeInTheDocument();
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

  it('keeps enterprise plan changes unavailable without exposing a support link', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.org.plan = 'enterprise';
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;

    await renderPage();

    const unavailableButtons = screen.getAllByRole('button', {
      name: '目前方案不支援線上變更',
    });
    expect(unavailableButtons).toHaveLength(2);
    unavailableButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByText('聯絡客服')).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/contact"]')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /升級至成長版 NT\$699/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('付款服務回應不完整');
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelector('form[action="https://example.com/collect-payment"]')).toBeNull();
  });
});
