import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { scanShopeeReturnMock, getShopeeScanDashboardMock, toastMock } = vi.hoisted(() => ({
  scanShopeeReturnMock: vi.fn(),
  getShopeeScanDashboardMock: vi.fn(),
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
  getShopeeScanDashboard: (...args: unknown[]) => getShopeeScanDashboardMock(...args),
}));

import ShopeeReturnScanPage from '@/app/(admin)/shopee-returns/scan/page';

const EMPTY_DASHBOARD = {
  success: true,
  data: {
    kpi: {
      todayTotalScans: 0,
      todayMatchedScans: 0,
      todayUnmatchedScans: 0,
      todayDuplicateScans: 0,
      unmatchedRate: 0,
      duplicateRate: 0,
      scannedCompletionRate: 0,
    },
    recentEvents: [],
    unmatchedOpenCount: 0,
  },
};

describe('ShopeeReturnScanPage UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getShopeeScanDashboardMock.mockResolvedValue(EMPTY_DASHBOARD);
  });
  afterEach(() => {
    cleanup();
  });

  it('shows platform and write count after manual scan success', async () => {
    getShopeeScanDashboardMock
      .mockResolvedValueOnce(EMPTY_DASHBOARD)
      .mockResolvedValue({
        success: true,
        data: {
          ...EMPTY_DASHBOARD.data,
          recentEvents: [
            {
              id: 'event-1',
              scanned_code: '260130D0X7N6FH',
              normalized_code: '260130D0X7N6FH',
              scan_status: 'matched',
              matched_order_id: 'scan-row-1',
              matched_order_number: '260130D0X7N6FH',
              matched_tracking_number: 'TW2631984572320',
              platform: 'mall',
              matched_count: 2,
              updated_count: 2,
              message: '掃描成功',
              scanned_at: '2026-02-25T11:00:00.000Z',
              created_at: '2026-02-25T11:00:00.000Z',
            },
          ],
        },
      });

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
        scanStatus: 'matched',
        eventId: 'event-1',
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
      expect(toastMock.error).toHaveBeenCalledWith('請先輸入條碼內容');
    });
    expect(scanShopeeReturnMock).not.toHaveBeenCalled();
  });
});
