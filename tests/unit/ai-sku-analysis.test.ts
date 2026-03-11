import { describe, expect, it } from 'vitest';

import { buildAISkuAnalysisGroups } from '@/lib/utils/ai-sku-analysis';

describe('buildAISkuAnalysisGroups', () => {
  it('groups APL sku families by the 6 characters after the prefix', () => {
    const groups = buildAISkuAnalysisGroups([
      {
        productName: '商品 A',
        sku: 'APL-22X105-A',
        quantity: 3,
        reasonTexts: ['尺寸太大'],
        buyerNoteTexts: ['太緊'],
        returnReasonNoteTexts: ['驗貨後確認尺寸不合'],
      },
      {
        productName: '商品 A',
        sku: 'APL-22X105-B',
        quantity: 2,
        reasonTexts: ['尺寸太小'],
      },
      {
        productName: '商品 B',
        sku: 'APL-T18ZJ',
        quantity: 4,
        reasonTexts: ['不符合需求'],
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      sku_group: '22X105',
      return_count: 5,
    });
    expect(groups[0].variants.map((variant) => variant.sku)).toEqual([
      'APL-22X105-A',
      'APL-22X105-B',
    ]);
    expect(groups[0].buyer_note_texts).toContain('太緊');
    expect(groups[0].return_reason_note_texts).toContain('驗貨後確認尺寸不合');
  });

  it('groups non-APL sku families by the first 5 characters', () => {
    const groups = buildAISkuAnalysisGroups([
      {
        productName: '商品 C',
        sku: 'CY147-A',
        quantity: 5,
        reasonTexts: ['太重'],
      },
      {
        productName: '商品 C',
        sku: 'CY147-C',
        quantity: 1,
        reasonTexts: ['太大'],
      },
      {
        productName: '商品 D',
        sku: 'CY139-A',
        quantity: 3,
        reasonTexts: ['畫質不佳'],
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      sku_group: 'CY147',
      return_count: 6,
    });
    expect(groups[0].variants.map((variant) => variant.sku)).toEqual([
      'CY147-A',
      'CY147-C',
    ]);
    expect(groups[1]).toMatchObject({
      sku_group: 'CY139',
      return_count: 3,
    });
  });

  it('deduplicates and limits repeated text samples', () => {
    const groups = buildAISkuAnalysisGroups([
      {
        productName: '商品 E',
        sku: 'CY139-D',
        quantity: 2,
        reasonTexts: [' 畫質模糊 ', '畫質模糊'],
        buyerNoteTexts: ['買家說畫面不清楚', '買家說畫面不清楚'],
        returnReasonNoteTexts: ['驗貨註記 1', '驗貨註記 1'],
      },
    ]);

    expect(groups[0].reason_texts).toEqual(['畫質模糊']);
    expect(groups[0].buyer_note_texts).toEqual(['買家說畫面不清楚']);
    expect(groups[0].return_reason_note_texts).toEqual(['驗貨註記 1']);
  });
});
