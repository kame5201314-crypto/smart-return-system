import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

import { CustomPlanOfferControls } from '@/components/internal/custom-plan-offer-controls';

const orgId = '11111111-1111-4111-8111-111111111111';
const activeOffer = {
  id: '22222222-2222-4222-8222-222222222222',
  orgId,
  title: '朋友測試專案',
  description: '包含一次資料整理協助。',
  amountTwd: 899,
  billingPeriodMonths: 1,
  status: 'active',
  expiresAt: '2026-07-27T12:00:00.000Z',
  paymentOrderId: null,
  cancellationReason: null,
  createdAt: '2026-07-20T12:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CustomPlanOfferControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('defaults a new designated-account offer to the NT$100 friend price', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      success: true,
      data: { offers: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="朋友測試帳號"
        canManageBillingOperations
      />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '建立客製報價' }));

    expect(screen.getByLabelText('一次付款金額（NT$）')).toHaveValue(100);
    expect(screen.getByLabelText('報價名稱')).toHaveValue('朋友專屬優惠');
    expect(screen.getByLabelText('方案說明（選填）')).toHaveValue(
      '指定帳號優惠價 NT$100；付款後提供一個月 AI 退貨管理系統使用權。'
    );
  });

  it('loads private offers and clearly labels one-time prepaid terms', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      success: true,
      data: { offers: [activeOffer] },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="測試租戶"
        canManageBillingOperations
      />
    );

    expect(await screen.findByText('朋友測試專案')).toBeInTheDocument();
    expect(screen.getByText('NT$899')).toBeInTheDocument();
    expect(screen.getByText('待客戶付款')).toBeInTheDocument();
    expect(screen.getAllByText(/一次預付.*1 個月.*不自動續扣/).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/saas/custom-plan-offers?orgId=${orgId}`,
      { method: 'GET', cache: 'no-store' }
    );
  });

  it('requires explicit prepaid confirmation before creating an offer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { offers: [] } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { offer: activeOffer } }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { offers: [activeOffer] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="測試租戶"
        canManageBillingOperations
      />
    );
    await screen.findByText(/尚未建立客製報價/);

    fireEvent.click(screen.getByRole('button', { name: '建立客製報價' }));
    fireEvent.change(screen.getByLabelText('報價名稱'), { target: { value: '朋友測試專案' } });
    fireEvent.change(screen.getByLabelText('一次付款金額（NT$）'), { target: { value: '899' } });

    const submit = screen.getByRole('button', { name: '確認建立報價' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, createRequest] = fetchMock.mock.calls[1]!;
    const createBody = JSON.parse(String((createRequest as RequestInit).body));
    expect(createBody).toMatchObject({
      orgId,
      title: '朋友測試專案',
      amountTwd: 899,
    });
    expect(createBody).not.toHaveProperty('merchantId');
    expect(createBody).not.toHaveProperty('hashKey');
    expect(createBody).not.toHaveProperty('hashIv');
  });

  it.each([
    {
      label: '不足 1 小時 1 分鐘',
      expiresAt: () => new Date(Date.now() + 60 * 60 * 1000),
      message: '報價付款期限至少需設定為 1 小時 1 分鐘後。',
    },
    {
      label: '超過 90 天',
      expiresAt: () => new Date(Date.now() + 91 * 24 * 60 * 60 * 1000),
      message: '報價付款期限最長只能設定在 90 天內。',
    },
  ])('送出前阻擋$label的付款期限', async ({ expiresAt, message }) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { offers: [] } }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="測試租戶"
        canManageBillingOperations
      />
    );
    await screen.findByText(/尚未建立客製報價/);

    fireEvent.click(screen.getByRole('button', { name: '建立客製報價' }));
    const requestedExpiry = expiresAt();
    const localExpiry = new Date(
      requestedExpiry.getTime() - requestedExpiry.getTimezoneOffset() * 60_000
    ).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText('付款期限'), { target: { value: localExpiry } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '確認建立報價' }));

    expect(toastMocks.error).toHaveBeenCalledWith(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires a reason and sends a separate confirmed cancellation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { offers: [activeOffer] } }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { offer: { ...activeOffer, status: 'cancelled' } },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: { offers: [{ ...activeOffer, status: 'cancelled' }] },
      }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="測試租戶"
        canManageBillingOperations
      />
    );
    await screen.findByText('朋友測試專案');

    fireEvent.click(screen.getByRole('button', { name: '取消報價' }));
    fireEvent.change(screen.getByLabelText('取消原因'), {
      target: { value: '客戶需求調整，重新報價' },
    });
    fireEvent.click(screen.getByRole('button', { name: '確認取消報價' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [endpoint, cancelRequest] = fetchMock.mock.calls[1]!;
    expect(endpoint).toBe('/api/internal/saas/custom-plan-offers');
    expect((cancelRequest as RequestInit).method).toBe('DELETE');
    expect(JSON.parse(String((cancelRequest as RequestInit).body))).toEqual({
      offerId: activeOffer.id,
      reason: '客戶需求調整，重新報價',
    });
  });

  it('does not expose controls without billing-operation permission', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="測試租戶"
        canManageBillingOperations={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('distinguishes an issued closed checkout from a quote that simply expired', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      success: true,
      data: {
        offers: [{
          ...activeOffer,
          status: 'expired',
          paymentOrderId: '33333333-3333-4333-8333-333333333333',
        }],
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CustomPlanOfferControls
        orgId={orgId}
        orgName="測試租戶"
        canManageBillingOperations
      />
    );

    expect(await screen.findByText('付款已關閉')).toBeInTheDocument();
    expect(screen.queryByText('已到期')).not.toBeInTheDocument();
  });
});
