import { describe, expect, it } from 'vitest';

import { aggregateReturnRanking, getReturnRankingSkuGroup } from '@/lib/utils/return-ranking';

describe('getReturnRankingSkuGroup', () => {
  it('extracts the first 6 characters after the AP family prefix', () => {
    expect(getReturnRankingSkuGroup('APL-22X105-A')).toBe('22X105');
    expect(getReturnRankingSkuGroup('APL-T18ZJ')).toBe('T18ZJ');
    expect(getReturnRankingSkuGroup('APL-20-40X-C')).toBe('20-40X');
  });

  it('extracts the first 5 characters for non-APL sku values', () => {
    expect(getReturnRankingSkuGroup('CY147-A')).toBe('CY147');
    expect(getReturnRankingSkuGroup('CY139-D')).toBe('CY139');
    expect(getReturnRankingSkuGroup('DE005')).toBe('DE005');
  });
});

describe('aggregateReturnRanking', () => {
  it('groups the same classified sku together and sorts by total return quantity', () => {
    const result = aggregateReturnRanking([
      { name: 'MEFU A', sku: 'CY147-A', channel: '蝦皮', quantity: 5 },
      { name: 'MEFU A', sku: 'CY147-C', channel: '蝦皮', quantity: 3 },
      { name: 'APL 20-40', sku: 'APL-20-40X-C', channel: '商城', quantity: 6 },
      { name: 'APL 20-40', sku: 'APL-20-40X-D', channel: '商城', quantity: 2 },
      { name: 'DE005 Product', sku: 'DE005', channel: '蝦皮', quantity: 6 },
    ]);

    expect(result).toEqual([
      { name: 'APL 20-40', sku: '20-40X', channel: '商城', quantity: 8 },
      { name: 'MEFU A', sku: 'CY147', channel: '蝦皮', quantity: 8 },
      { name: 'DE005 Product', sku: 'DE005', channel: '蝦皮', quantity: 6 },
    ]);
  });

  it('keeps the same classified sku separated across different channels', () => {
    const result = aggregateReturnRanking([
      { name: 'MEFU A', sku: 'CY147-A', channel: '蝦皮', quantity: 5 },
      { name: 'MEFU A', sku: 'CY147-C', channel: '商城', quantity: 4 },
    ]);

    expect(result).toEqual([
      { name: 'MEFU A', sku: 'CY147', channel: '蝦皮', quantity: 5 },
      { name: 'MEFU A', sku: 'CY147', channel: '商城', quantity: 4 },
    ]);
  });
});
