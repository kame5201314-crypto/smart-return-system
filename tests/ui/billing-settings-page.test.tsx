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
      customOffers: [],
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
    billingMocks.result.data.subscription!.currentPeriodStart = '2026-07-18T00:00:00.000Z';
    billingMocks.result.data.subscription!.currentPeriodEnd = '2026-07-21T00:00:00.000Z';
    billingMocks.result.data.subscription!.cancelAtPeriodEnd = false;
    billingMocks.result.data.history = [
      {
        id: 'payment-order-1',
        plan: 'basic',
        provider: 'ecpay',
        periodStart: '2026-06-18T00:00:00.000Z',
        periodEnd: '2026-07-18T00:00:00.000Z',
        amountTwd: 499,
        status: 'paid',
        paidAt: '2026-06-18T00:00:00.000Z',
        createdAt: '2026-06-18T00:00:00.000Z',
      },
    ];
    billingMocks.result.data.customOffers = [];
    delete billingMocks.result.data.customOffersUnavailable;
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

    expect(screen.getByRole('heading', { name: '系統訂閱' })).toBeInTheDocument();
    expect(screen.queryByText('測試商店')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '試用版' })).toBeInTheDocument();
    expect(screen.getByText('試用中')).toBeInTheDocument();
    expect(screen.getByText('2026/07/18')).toBeInTheDocument();
    expect(screen.getByText('2026/07/21')).toBeInTheDocument();
    expect(screen.getByText('升級方案')).toBeInTheDocument();
    expect(screen.getAllByText(/不會自動續扣/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '入門版' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '成長版' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '大量需求' })).not.toBeInTheDocument();
    expect(screen.getAllByText('NT$399').length).toBeGreaterThan(0);
    expect(screen.queryByText('NT$699')).not.toBeInTheDocument();
    expect(screen.getAllByText('NT$499').length).toBeGreaterThan(0);
    expect(screen.getAllByText('綠界科技').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已付款').length).toBeGreaterThan(0);
    expect(screen.getByText('NT$499', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('付款／建立時間')).toBeInTheDocument();
    expect(screen.getAllByText('2026/06/18 08:00').length).toBeGreaterThan(0);
    expect(screen.queryByText('聯絡客服')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/pricing"]')).toBeNull();
  });

  it('shows a fresh account as a three-day trial with no invented payment record', async () => {
    billingMocks.result.data.subscription!.currentPeriodStart = '2026-07-21T04:00:00.000Z';
    billingMocks.result.data.subscription!.currentPeriodEnd = '2026-07-24T04:00:00.000Z';
    billingMocks.result.data.subscription!.trialEnd = '2026-07-24T04:00:00.000Z';
    billingMocks.result.data.history = [];

    await renderPage();

    expect(screen.getByRole('heading', { name: '試用版' })).toBeInTheDocument();
    expect(screen.getByText('試用中')).toBeInTheDocument();
    expect(screen.getByText('試用開始日')).toBeInTheDocument();
    expect(screen.getByText('試用到期日')).toBeInTheDocument();
    expect(screen.getByText('2026/07/21')).toBeInTheDocument();
    expect(screen.getByText('2026/07/24')).toBeInTheDocument();
    expect(screen.getByText(/目前沒有付款紀錄/)).toBeInTheDocument();
  });

  it('labels ECPay test access and history without pretending it is a fresh trial', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T04:00:00.000Z'));
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.subscription!.provider = 'ecpay';
    billingMocks.result.data.subscription!.currentPeriodStart = '2026-07-20T00:14:00.000Z';
    billingMocks.result.data.subscription!.currentPeriodEnd = '2026-08-20T00:14:00.000Z';
    billingMocks.result.data.subscription!.trialEnd = null;
    billingMocks.result.data.history = [
      {
        id: 'ecpay-test-payment',
        plan: 'basic',
        provider: 'ecpay',
        providerMode: 'test',
        periodStart: '2026-07-20T00:14:00.000Z',
        periodEnd: '2026-08-20T00:14:00.000Z',
        amountTwd: 399,
        status: 'paid',
        paidAt: '2026-07-20T00:14:00.000Z',
        createdAt: '2026-07-20T00:13:00.000Z',
      },
    ];

    await renderPage();

    expect(screen.getByRole('heading', { name: '入門版（測試）' })).toBeInTheDocument();
    expect(screen.getByText('測試使用中')).toBeInTheDocument();
    expect(screen.getByText(/不是新帳號的 3 天試用/)).toBeInTheDocument();
    expect(screen.getAllByText('綠界測試環境').length).toBeGreaterThan(0);
    expect(screen.getAllByText('測試已付款').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: '試用版' })).not.toBeInTheDocument();
  });

  it('labels scrubbed manual payments without inventing a paid plan', async () => {
    billingMocks.result.data.history = [
      {
        id: 'manual:event-1',
        plan: null,
        provider: 'manual',
        periodStart: '2026-07-21T00:00:00+08:00',
        periodEnd: '2026-08-21T00:00:00+08:00',
        amountTwd: 399,
        status: 'paid',
        paidAt: '2026-07-21T04:30:00.000Z',
        createdAt: '2026-07-21T04:30:01.000Z',
      },
    ];

    await renderPage();

    expect(screen.getAllByText('人工入帳').length).toBeGreaterThan(0);
    expect(screen.getAllByText('方案未記錄').length).toBeGreaterThan(0);
    expect(screen.getByText('入帳時間')).toBeInTheDocument();
    expect(screen.getAllByText('2026/07/21 12:30').length).toBeGreaterThan(0);
  });

  it('keeps the original payment time visible after an order is refunded', async () => {
    billingMocks.result.data.history = [
      {
        id: 'refunded-order-1',
        plan: 'basic',
        provider: 'ecpay',
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-08-01T00:00:00.000Z',
        amountTwd: 399,
        status: 'refunded',
        paidAt: '2026-07-21T04:30:00.000Z',
        createdAt: '2026-07-01T01:00:00.000Z',
      },
    ];

    await renderPage();

    expect(screen.getByText('付款時間')).toBeInTheDocument();
    expect(screen.getAllByText('2026/07/21 12:30').length).toBeGreaterThan(0);
    expect(screen.queryByText('2026/07/01 09:00')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: /升級方案・NT\$399/ })).toBeDisabled();
    expect(screen.queryByText('試用已到期')).not.toBeInTheDocument();
  });

  it('shows scheduled expiry without implying automatic renewal', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.subscription!.cancelAtPeriodEnd = true;

    await renderPage();

    expect(screen.getByText(/目前方案將於 2026\/07\/21 到期/)).toBeInTheDocument();
    expect(screen.getAllByText(/不會自動續扣/).length).toBeGreaterThan(0);
  });

  it('labels paid access as a usage window instead of a future billing period', async () => {
    billingMocks.result.data.org.status = 'active';

    await renderPage();

    expect(screen.getByText('使用開始日')).toBeInTheDocument();
    expect(screen.getByText('使用到期日')).toBeInTheDocument();
    expect(screen.queryByText('本期開始日')).not.toBeInTheDocument();
  });

  it('pairs the paid usage dates from the period covering today after an early renewal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T04:00:00.000Z'));
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.subscription!.currentPeriodStart = '2026-08-18T16:00:00.000Z';
    billingMocks.result.data.subscription!.currentPeriodEnd = '2026-09-18T16:00:00.000Z';
    billingMocks.result.data.history = [
      {
        id: 'payment-order-current',
        plan: 'basic',
        provider: 'ecpay',
        periodStart: '2026-07-18T16:00:00.000Z',
        periodEnd: '2026-08-18T16:00:00.000Z',
        amountTwd: 399,
        status: 'paid',
        paidAt: '2026-07-18T16:00:00.000Z',
        createdAt: '2026-07-18T16:00:00.000Z',
      },
      {
        id: 'payment-order-queued',
        plan: 'basic',
        provider: 'ecpay',
        periodStart: '2026-08-18T16:00:00.000Z',
        periodEnd: '2026-09-18T16:00:00.000Z',
        amountTwd: 399,
        status: 'paid',
        paidAt: '2026-07-18T17:00:00.000Z',
        createdAt: '2026-07-18T17:00:00.000Z',
      },
    ];

    await renderPage();

    expect(screen.getByText('2026/07/19')).toBeInTheDocument();
    expect(screen.getByText('2026/08/19')).toBeInTheDocument();
    expect(screen.queryByText('2026/09/19')).not.toBeInTheDocument();
  });

  it('treats payment query parameters as a pending confirmation, not proof of payment', async () => {
    await renderPage(Promise.resolve({ payment: 'success', plan: 'basic' }));

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
    fireEvent.click(screen.getByRole('button', { name: /升級方案・NT\$399/ }));

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

  it('shows a private custom offer and checks out with only the server-side offer id', async () => {
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    billingMocks.result.data.customOffers = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: '首批導入專案',
        description: '包含初始資料整理與一個月系統使用。',
        amountTwd: 2_680,
        expiresAt: '2099-08-31T12:00:00.000Z',
        billingPeriodMonths: 1,
      },
    ];
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          checkout: {
            action: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
            fields: { MerchantTradeNo: 'custom-trade-1', TradeAmt: '2680' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);

    await renderPage();

    expect(screen.getByRole('heading', { name: '為你的工作區準備的方案' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '首批導入專案' })).toBeInTheDocument();
    expect(screen.getByText('包含初始資料整理與一個月系統使用。')).toBeInTheDocument();
    expect(screen.getByText('NT$2,680')).toBeInTheDocument();
    expect(screen.getByText('報價有效至 2099/08/31')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /使用專屬報價付款/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/saas/billing/checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ offerId: '11111111-1111-4111-8111-111111111111' }),
        signal: expect.any(AbortSignal),
      })
    );
    const requestInit = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    const requestBody = JSON.parse(String(requestInit.body));
    expect(requestBody).toEqual({ offerId: '11111111-1111-4111-8111-111111111111' });
    expect(requestBody).not.toHaveProperty('amountTwd');
    expect(requestBody).not.toHaveProperty('plan');
  });

  it('keeps the public plan available while reporting a recoverable custom-offer load error', async () => {
    billingMocks.result.data.customOffersUnavailable = true;

    await renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      '專屬報價暫時無法載入；公開 NT$399 方案仍可正常使用。'
    );
    expect(screen.getAllByText('NT$399').length).toBeGreaterThan(0);
  });

  it('shows a safe message when a private offer checkout is no longer available', async () => {
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;
    billingMocks.result.data.customOffers = [{
      id: '11111111-1111-4111-8111-111111111111',
      title: '限時專屬方案',
      description: null,
      amountTwd: 899,
      expiresAt: '2099-08-31T12:00:00.000Z',
      billingPeriodMonths: 1,
    }];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: false, code: 'offer_unavailable' }),
      { status: 409, headers: { 'content-type': 'application/json' } }
    )));

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /使用專屬報價付款/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      '這筆專屬報價已到期或付款連結已失效'
    ));
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
    fireEvent.click(screen.getByRole('button', { name: /升級方案・NT\$399/ }));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    const checkoutSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal | undefined;
    expect(checkoutSignal?.aborted).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('等待付款服務回應逾時，請稍後再試。');
    expect(screen.queryByText('internal timeout detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /升級方案・NT\$399/ })).toBeEnabled();
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
    fireEvent.click(screen.getByRole('button', { name: /升級方案・NT\$399/ }));

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
    fireEvent.click(screen.getByRole('button', { name: /升級方案・NT\$399/ }));

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

  it('keeps a legacy growth plan unavailable for self-service changes', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.org.plan = 'growth';
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;

    await renderPage();

    expect(screen.getByRole('button', {
      name: '舊版方案暫不支援線上變更',
    })).toBeDisabled();
    expect(screen.queryByText('NT$699')).not.toBeInTheDocument();
  });

  it('keeps enterprise plan changes unavailable without exposing a support link', async () => {
    billingMocks.result.data.org.status = 'active';
    billingMocks.result.data.org.plan = 'enterprise';
    billingMocks.result.data.actions.canUpdateBilling = true;
    billingMocks.result.data.actions.disabledReason = undefined;

    await renderPage();

    expect(screen.getByRole('button', {
      name: '舊版方案暫不支援線上變更',
    })).toBeDisabled();
    expect(screen.queryByText('NT$699')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /升級方案・NT\$399/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('付款服務回應不完整');
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelector('form[action="https://example.com/collect-payment"]')).toBeNull();
  });
});
