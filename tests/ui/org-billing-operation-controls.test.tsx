import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrgBillingOperationControls } from '@/components/internal/org-billing-operation-controls';

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
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      reason: '銀行轉帳已核對',
      metadata: {
        source: 'internal_org_detail',
        orgName: '測試租戶',
        paymentMethod: 'manual',
      },
    });
    expect(body.idempotencyKey).toMatch(/^internal-manual-payment-/);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
