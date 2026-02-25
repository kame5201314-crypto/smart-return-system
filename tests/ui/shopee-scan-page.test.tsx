import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { scanShopeeReturnMock, toastMock } = vi.hoisted(() => ({
  scanShopeeReturnMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('next/link', () => ({
  default: (props: {
    href: string;
    className?: string;
    children: React.ReactNode;
  }) => <a href={props.href} className={props.className}>{props.children}</a>,
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

vi.mock('@/lib/actions/shopee-returns.actions', () => ({
  scanShopeeReturn: (...args: unknown[]) => scanShopeeReturnMock(...args),
}));

import ShopeeReturnScanPage from '@/app/(admin)/shopee-returns/scan/page';

describe('ShopeeReturnScanPage UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('shows platform and write count after manual scan success', async () => {
    scanShopeeReturnMock.mockResolvedValue({
      success: true,
      data: {
        matched: {
          id: 'scan-row-1',
          order_number: '260130D0X7N6FH',
          platform: 'mall',
          tracking_number: 'TW2631984572320',
          scanned_at: '2026-02-25T11:00:00.000Z',
        },
        alreadyScanned: false,
        matchedCount: 2,
        updatedCount: 2,
      },
    });

    render(<ShopeeReturnScanPage />);

    fireEvent.change(screen.getByLabelText('條碼內容'), {
      target: { value: '260130D0X7N6FH' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: '送出比對' })[0]!);

    await waitFor(() => {
      expect(scanShopeeReturnMock).toHaveBeenCalledWith('260130D0X7N6FH');
    });

    expect(screen.getByText('最新掃描結果')).toBeInTheDocument();
    expect(screen.getAllByText('商城').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/寫入筆數：2/).length).toBeGreaterThan(0);
    expect(toastMock.success).toHaveBeenCalled();
    expect(toastMock.success.mock.calls[0]?.[0]).toContain('商城');
  });

  it('blocks empty manual input and shows error toast', async () => {
    render(<ShopeeReturnScanPage />);

    fireEvent.click(screen.getByRole('button', { name: '送出比對' }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('請輸入條碼內容');
    });
    expect(scanShopeeReturnMock).not.toHaveBeenCalled();
  });
});
