import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OrgBillingOperationControls,
  resolveMinimumManualPaymentEndDate,
  toTaipeiBillingBoundary,
} from '@/components/internal/org-billing-operation-controls';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('OrgBillingOperationControls', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    refresh.mockReset();
  });

  it('uses tomorrow in Taipei as the earliest manual payment end date', () => {
    expect(resolveMinimumManualPaymentEndDate(new Date('2026-12-31T23:30:00.000Z')))
      .toBe('2027-01-02');
    expect(resolveMinimumManualPaymentEndDate(new Date('2026-07-20T16:30:00.000Z')))
      .toBe('2026-07-22');
  });

  it('treats manual billing dates as Taipei midnight instead of UTC midnight', () => {
    expect(toTaipeiBillingBoundary('2026-07-21')).toBe('2026-07-21T00:00:00+08:00');
  });

  it('does not render billing controls without the billing operations permission', () => {
    render(
      <OrgBillingOperationControls
        orgId="11111111-1111-4111-8111-111111111111"
        orgName="support-only-org"
        status="trialing"
        suggestedAmountTwd={699}
        canManageBillingOperations={false}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains the read-only impact and suspends a tenant with an inline reason error', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <OrgBillingOperationControls
        orgId="11111111-1111-4111-8111-111111111111"
        orgName="待停權租戶"
        status="active"
        suggestedAmountTwd={699}
        canManageBillingOperations
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '停權租戶' }));
    expect(screen.getByText('停權後的影響')).toBeInTheDocument();
    expect(screen.getByText('客戶仍可登入並查看既有資料。')).toBeInTheDocument();
    expect(screen.getByText('禁止新增、匯入、匯出與 AI 分析。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '確認停權' }));
    expect(screen.getByRole('alert')).toHaveTextContent('至少 4 個字');
    expect(screen.getByLabelText('操作原因')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('操作原因'), {
      target: { value: '試用到期未續約' },
    });
    fireEvent.click(screen.getByRole('button', { name: '確認停權' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      operation: 'suspend_org',
      orgId: '11111111-1111-4111-8111-111111111111',
      reason: '試用到期未續約',
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('offers a clear restore action for suspended tenants', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <OrgBillingOperationControls
        orgId="22222222-2222-4222-8222-222222222222"
        orgName="已停權租戶"
        status="suspended"
        suggestedAmountTwd={699}
        canManageBillingOperations
      />
    );

    expect(screen.queryByRole('button', { name: '停權租戶' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '恢復使用權限' }));
    expect(screen.getByText('恢復後的影響')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('操作原因'), {
      target: { value: '款項已確認入帳' },
    });
    fireEvent.click(screen.getByRole('button', { name: '確認恢復' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      operation: 'resume_org',
      orgId: '22222222-2222-4222-8222-222222222222',
      reason: '款項已確認入帳',
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('submits a guarded manual payment with period and idempotency data', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <OrgBillingOperationControls
        orgId="11111111-1111-4111-8111-111111111111"
        orgName="測試租戶"
        status="trialing"
        suggestedAmountTwd={699}
        canManageBillingOperations
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '記錄人工付款' }));
    expect(screen.getByLabelText('付款金額（NT$）')).toHaveValue(699);
    fireEvent.change(screen.getByLabelText('服務開始日（選填）'), {
      target: { value: '2026-07-01' },
    });
    fireEvent.change(screen.getByLabelText('服務到期日'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('備註（選填）'), {
      target: { value: '銀行轉帳已核對' },
    });
    fireEvent.click(screen.getByRole('button', { name: '確認已收款' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      operation: 'mark_manual_payment',
      orgId: '11111111-1111-4111-8111-111111111111',
      amountTwd: 699,
      periodStart: '2026-07-01T00:00:00+08:00',
      periodEnd: '2026-08-01T00:00:00+08:00',
      reason: '銀行轉帳已核對',
      metadata: {
        source: 'internal_org_detail',
        orgName: '測試租戶',
        paymentMethod: 'manual',
      },
    });
    expect(body.idempotencyKey).toMatch(/^internal-manual-payment-/);
    expect(body.paidAt).toEqual(expect.any(String));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('reuses the manual payment idempotency key when the same dialog retries', async () => {
    let attempt = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      attempt += 1;
      const success = attempt > 1;
      return new Response(JSON.stringify(success
        ? { success: true }
        : { success: false, error: 'temporary failure' }), {
        status: success ? 200 : 500,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <OrgBillingOperationControls
        orgId="11111111-1111-4111-8111-111111111111"
        orgName="retry-org"
        status="trialing"
        suggestedAmountTwd={699}
        canManageBillingOperations
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '記錄人工付款' }));
    fireEvent.change(screen.getByLabelText('服務到期日'), {
      target: { value: '2099-08-01' },
    });
    const confirmButton = screen.getByRole('button', { name: '確認已收款' });

    fireEvent.click(confirmButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirmButton).toBeEnabled());

    fireEvent.click(confirmButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
    expect(firstBody.idempotencyKey).toMatch(/^internal-manual-payment-/);
    expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey);
    expect(secondBody.paidAt).toBe(firstBody.paidAt);
  });
});
