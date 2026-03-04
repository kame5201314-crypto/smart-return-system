import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUntypedAdminClientMock } = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

import { getShopeeScanDashboard } from '@/lib/actions/shopee-returns.actions';

const schemaCacheMissingTableError = {
  message: "Could not find the table 'public.shopee_scan_events' in the schema cache",
  code: 'PGRST205',
};

describe('getShopeeScanDashboard fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gracefully degrades when scan event tables are missing', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'shopee_scan_events') {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            if (columns === '*') {
              return {
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: schemaCacheMissingTableError,
                  }),
                }),
              };
            }
            return {
              gte: vi.fn().mockResolvedValue({
                data: null,
                error: schemaCacheMissingTableError,
              }),
            };
          }),
        };
      }

      if (table === 'shopee_unmatched_scans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              count: null,
              error: schemaCacheMissingTableError,
            }),
          }),
        };
      }

      if (table === 'shopee_returns') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { id: '1', is_scanned: true },
              { id: '2', is_scanned: false },
            ],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createUntypedAdminClientMock.mockReturnValue({
      from: fromMock,
    });

    const result = await getShopeeScanDashboard(30);

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data?.recentEvents).toEqual([]);
    expect(result.data?.unmatchedOpenCount).toBe(0);
    expect(result.data?.kpi.todayTotalScans).toBe(0);
    expect(result.data?.kpi.todayMatchedScans).toBe(0);
    expect(result.data?.kpi.todayUnmatchedScans).toBe(0);
    expect(result.data?.kpi.todayDuplicateScans).toBe(0);
    expect(result.data?.kpi.scannedCompletionRate).toBe(50);
  });

  it('returns failure for non-schema-cache errors', async () => {
    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'shopee_scan_events') {
        return {
          select: vi.fn().mockImplementation((columns: string) => {
            if (columns === '*') {
              return {
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                      message: 'permission denied',
                      code: '42501',
                    },
                  }),
                }),
              };
            }
            return {
              gte: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            };
          }),
        };
      }

      if (table === 'shopee_unmatched_scans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              count: 0,
              error: null,
            }),
          }),
        };
      }

      if (table === 'shopee_returns') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createUntypedAdminClientMock.mockReturnValue({
      from: fromMock,
    });

    const result = await getShopeeScanDashboard(10);

    expect(result.success).toBe(false);
    expect(result.error).toContain('載入掃描儀表失敗');
  });
});
