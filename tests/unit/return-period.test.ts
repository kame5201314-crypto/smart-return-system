import { describe, expect, it } from 'vitest';

import {
  getShopeeReturnReportPeriod,
  isShopeeReturnInReportPeriod,
  toYearMonth,
} from '@/lib/utils/return-period';

describe('return-period utilities', () => {
  it('parses normal dates and Excel serial dates into year-month', () => {
    expect(toYearMonth('2026-04-15')).toBe('2026-04');
    expect(toYearMonth('2026/4/15')).toBe('2026-04');
    expect(toYearMonth(46132)).toBe('2026-04');
  });

  it('uses Shopee customer order date before return workflow fallback dates', () => {
    const row = {
      order_date: '2026-01-15',
      dispute_deadline: '2026-04-18',
      created_at: '2026-04-12T00:00:00.000Z',
    };

    expect(getShopeeReturnReportPeriod(row)).toBe('2026-01');
    expect(isShopeeReturnInReportPeriod(row, '2026-01')).toBe(true);
    expect(isShopeeReturnInReportPeriod(row, '2026-04')).toBe(false);
  });

  it('falls back to created_at when order date and return workflow date are missing', () => {
    expect(
      getShopeeReturnReportPeriod({
        created_at: '2026-04-12T00:00:00.000Z',
      })
    ).toBe('2026-04');
  });
});
