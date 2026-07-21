import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMocks,
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

import { SelfServiceTrialForm } from '@/components/auth/self-service-trial-form';

describe('SelfServiceTrialForm', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'trial-idempotency-key' });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('collects merchant data after Google identity verification without trusting client identity fields', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, redirectTo: '/analytics' }),
    });

    render(
      <SelfServiceTrialForm
        identityLabel="owner@example.com"
        identityProvider="google"
        verifiedEmail="owner@example.com"
        initialContactName="王小明"
        initialReferralCode="FRIEND-88"
        initialPlan="basic"
      />
    );

    expect(screen.getByText('登入身分已驗證')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Google 只用於確認登入身分/)).toBeInTheDocument();
    expect(screen.getByLabelText(/聯絡人姓名/)).toHaveValue('王小明');
    expect(screen.queryByLabelText(/主要銷售平台/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/每月退貨量/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/偏好聯絡方式/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/LINE ID/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/試用方案/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/推薦碼/)).not.toBeInTheDocument();
    expect(screen.queryByText(/商家資料只用於建立工作區/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/品牌或商店名稱/), {
      target: { value: '好好生活選物' },
    });
    fireEvent.change(screen.getByLabelText(/聯絡電話/), {
      target: { value: '0912-345-678' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '完成資料並開始 3 天免費試用' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body)) as Record<string, unknown>;

    expect(fetchMock).toHaveBeenCalledWith('/api/saas/trial', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }));
    expect(payload).toEqual(expect.objectContaining({
      orgName: '好好生活選物',
      contactName: '王小明',
      contactPhone: '0912345678',
      lineId: '',
      preferredContactChannel: 'phone',
      platform: 'other',
      monthlyReturnBand: '30_100',
      referralCode: 'FRIEND-88',
      plan: 'basic',
      termsAccepted: true,
      termsVersion: expect.any(String),
      idempotencyKey: 'trial-idempotency-key',
    }));
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('identityProvider');
    expect(toastMocks.success).toHaveBeenCalledWith('商家資料已完成，3 天試用工作區已建立。');
    expect(navigationMocks.replace).toHaveBeenCalledWith('/analytics');
    expect(navigationMocks.refresh).toHaveBeenCalled();
  });

  it('rejects an invalid Taiwan contact phone before sending merchant data', () => {
    render(
      <SelfServiceTrialForm
        identityLabel="owner@example.com"
        identityProvider="google"
        verifiedEmail="owner@example.com"
        initialPlan="basic"
      />
    );

    fireEvent.change(screen.getByLabelText(/品牌或商店名稱/), {
      target: { value: '好好生活選物' },
    });
    fireEvent.change(screen.getByLabelText(/聯絡人姓名/), {
      target: { value: '王小明' },
    });
    fireEvent.change(screen.getByLabelText(/聯絡電話/), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByTestId('merchant-profile-form'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith(
      '請輸入有效的台灣手機號碼，例如 0912345678。'
    );
  });

  it('does not announce a new three-day trial when an expired claim is reused', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        redirectTo: '/analytics',
        data: {
          reused: true,
          trialEnd: '2000-01-01T00:00:00.000Z',
        },
      }),
    });

    const { container } = render(
      <SelfServiceTrialForm
        identityLabel="owner@example.com"
        identityProvider="google"
        verifiedEmail="owner@example.com"
        initialPlan="basic"
      />
    );

    fireEvent.change(container.querySelector('#trial-org-name') as HTMLInputElement, {
      target: { value: 'Existing Store' },
    });
    fireEvent.change(container.querySelector('#trial-contact-name') as HTMLInputElement, {
      target: { value: 'Owner' },
    });
    fireEvent.change(container.querySelector('#trial-contact-phone') as HTMLInputElement, {
      target: { value: '0912345678' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByTestId('merchant-profile-form'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(toastMocks.info).toHaveBeenCalledWith(
      '此帳號的試用已到期，將返回原工作區。'
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(navigationMocks.replace).toHaveBeenCalledWith('/analytics');
    expect(navigationMocks.refresh).toHaveBeenCalled();
  });

  it('keeps a verified phone read-only and provisions with hidden contract defaults', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, redirectTo: '/analytics' }),
    });

    render(
      <SelfServiceTrialForm
        identityLabel="0912345678"
        identityProvider="phone_otp"
        verifiedPhone="0912345678"
        initialPlan="basic"
      />
    );

    expect(screen.getByLabelText(/聯絡電話/)).toHaveValue('0912345678');
    expect(screen.getByLabelText(/聯絡電話/)).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText(/品牌或商店名稱/), {
      target: { value: '好好生活選物' },
    });
    fireEvent.change(screen.getByLabelText(/聯絡人姓名/), {
      target: { value: '王小明' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByTestId('merchant-profile-form'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual(expect.objectContaining({
      contactPhone: '0912345678',
      lineId: '',
      preferredContactChannel: 'phone',
      platform: 'other',
      monthlyReturnBand: '30_100',
      referralCode: '',
      plan: 'basic',
    }));
  });
});
