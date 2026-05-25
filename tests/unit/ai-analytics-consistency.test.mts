import { describe, expect, it } from 'vitest';

import {
  getShopeeReturnReportPeriod,
  isMissingColumnError,
  loadShopeeReturnsWithCompatibleColumns,
  toYearMonth,
} from '../../scripts/predeploy/check-ai-analytics-consistency.mjs';

function createShopeeClient(results: Record<string, { data: unknown[] | null; error: { message: string } | null }>) {
  const calls: string[] = [];
  return {
    calls,
    supabase: {
      from(table: string) {
        expect(table).toBe('shopee_returns');
        return {
          async select(columns: string) {
            calls.push(columns);
            return results[columns] ?? {
              data: null,
              error: { message: `Unexpected select: ${columns}` },
            };
          },
        };
      },
    },
  };
}

describe('AI analytics consistency predeploy helpers', () => {
  it('normalizes dates from ISO strings, raw month text, and Excel serial values', () => {
    expect(toYearMonth('2026-05-25T00:00:00.000Z')).toBe('2026-05');
    expect(toYearMonth('2026/6/1')).toBe('2026-06');
    expect(toYearMonth('2026 年 7 月')).toBe('2026-07');
    expect(toYearMonth('45800')).toBe('2025-05');
    expect(toYearMonth('not a date')).toBeNull();
  });

  it('uses optional Shopee date fields when they are present', () => {
    expect(
      getShopeeReturnReportPeriod({
        order_date: null,
        dispute_deadline: '2026-08-10',
        processed_at: '2026-09-10',
        created_at: '2026-10-10',
      })
    ).toBe('2026-08');
    expect(
      getShopeeReturnReportPeriod({
        order_date: null,
        dispute_deadline: null,
        created_at: '2026-10-10',
        processed_at: '2026-09-10',
      })
    ).toBe('2026-10');
  });

  it('detects Supabase missing-column errors for optional legacy columns', () => {
    expect(
      isMissingColumnError(
        { message: 'column shopee_returns.dispute_deadline does not exist' },
        'dispute_deadline'
      )
    ).toBe(true);
    expect(
      isMissingColumnError(
        { message: "Could not find the 'processed_at' column of 'shopee_returns'" },
        'processed_at'
      )
    ).toBe(true);
    expect(isMissingColumnError({ message: 'permission denied' }, 'processed_at')).toBe(false);
  });

  it('falls back when optional Shopee date columns do not exist', async () => {
    const fullSelect = 'id, order_date, dispute_deadline, processed_at, created_at';
    const processedSelect = 'id, order_date, processed_at, created_at';
    const baseSelect = 'id, order_date, created_at';
    const { calls, supabase } = createShopeeClient({
      [fullSelect]: {
        data: null,
        error: { message: 'column shopee_returns.dispute_deadline does not exist' },
      },
      [processedSelect]: {
        data: null,
        error: { message: 'column shopee_returns.processed_at does not exist' },
      },
      [baseSelect]: {
        data: [{ id: 'shopee-1', order_date: '2026-05-01', created_at: '2026-05-02' }],
        error: null,
      },
    });

    await expect(loadShopeeReturnsWithCompatibleColumns(supabase)).resolves.toEqual({
      data: [{ id: 'shopee-1', order_date: '2026-05-01', created_at: '2026-05-02' }],
      error: null,
    });
    expect(calls).toEqual([fullSelect, processedSelect, baseSelect]);
  });

  it('does not hide non-schema Shopee query errors', async () => {
    const fullSelect = 'id, order_date, dispute_deadline, processed_at, created_at';
    const { calls, supabase } = createShopeeClient({
      [fullSelect]: {
        data: null,
        error: { message: 'permission denied for table shopee_returns' },
      },
    });

    await expect(loadShopeeReturnsWithCompatibleColumns(supabase)).resolves.toEqual({
      data: null,
      error: { message: 'permission denied for table shopee_returns' },
    });
    expect(calls).toEqual([fullSelect]);
  });
});
