import { describe, expect, it } from 'vitest';

import {
  buildAISkuAnalysisGroups,
  normalizeAISkuAnalysisOutput,
} from '@/lib/utils/ai-sku-analysis';

describe('normalizeAISkuAnalysisOutput', () => {
  it('merges legacy top-level sku rows into the same family group', () => {
    const normalized = normalizeAISkuAnalysisOutput([
      {
        sku_group: 'CY139-A',
        sku: 'CY139-A',
        product_name: 'Product A',
        return_count: 3,
        main_issues: ['too large'],
        suggestion: 'shrink size',
      },
      {
        sku_group: 'CY139-E',
        sku: 'CY139-E',
        product_name: 'Product A',
        return_count: 1,
        main_issues: ['too small'],
        suggestion: 'review dimensions',
      },
      {
        sku_group: 'APL-20-40X-C',
        sku: 'APL-20-40X-C',
        product_name: 'Lens C',
        return_count: 1,
        main_issues: ['not compatible'],
        suggestion: 'clarify phone compatibility',
      },
      {
        sku_group: 'APL-20-40XJJ04-A',
        sku: 'APL-20-40XJJ04-A',
        product_name: 'Lens JJ04',
        return_count: 1,
        main_issues: ['fit issue'],
        suggestion: 'adjust adapter design',
      },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({
      sku_group: 'CY139',
      return_count: 4,
    });
    expect(normalized[0].variants.map((variant) => variant.sku)).toEqual([
      'CY139-A',
      'CY139-E',
    ]);
    expect(normalized[1]).toMatchObject({
      sku_group: '20-40X',
      return_count: 2,
    });
    expect(normalized[1].variants.map((variant) => variant.sku)).toEqual([
      'APL-20-40X-C',
      'APL-20-40XJJ04-A',
    ]);
  });

  it('keeps candidate ordering and exact variant counts when ai returns split groups', () => {
    const candidates = buildAISkuAnalysisGroups([
      {
        productName: 'Product A',
        sku: 'CY139-A',
        quantity: 3,
        reasonTexts: ['too large'],
      },
      {
        productName: 'Product A',
        sku: 'CY139-E',
        quantity: 1,
        reasonTexts: ['too small'],
      },
      {
        productName: 'Lens C',
        sku: 'APL-20-40X-C',
        quantity: 1,
        reasonTexts: ['not compatible'],
      },
      {
        productName: 'Lens JJ04',
        sku: 'APL-20-40XJJ04-A',
        quantity: 1,
        reasonTexts: ['fit issue'],
      },
    ]);

    const normalized = normalizeAISkuAnalysisOutput(
      [
        {
          sku_group: 'CY139-A',
          sku: 'CY139-A',
          product_name: 'Product A',
          return_count: 3,
          main_issues: ['too large'],
          suggestion: 'shrink size',
        },
        {
          sku_group: 'CY139-E',
          sku: 'CY139-E',
          product_name: 'Product A',
          return_count: 1,
          main_issues: ['too small'],
          suggestion: 'review dimensions',
        },
        {
          sku_group: 'APL-20-40X-C',
          sku: 'APL-20-40X-C',
          product_name: 'Lens C',
          return_count: 1,
          main_issues: ['not compatible'],
          suggestion: 'clarify phone compatibility',
        },
        {
          sku_group: 'APL-20-40XJJ04-A',
          sku: 'APL-20-40XJJ04-A',
          product_name: 'Lens JJ04',
          return_count: 1,
          main_issues: ['fit issue'],
          suggestion: 'adjust adapter design',
        },
      ],
      candidates
    );

    expect(normalized.map((group) => group.sku_group)).toEqual(['CY139', '20-40X']);
    expect(normalized[0].return_count).toBe(4);
    expect(normalized[0].variants).toEqual([
      expect.objectContaining({ sku: 'CY139-A', return_count: 3, suggestion: 'shrink size' }),
      expect.objectContaining({ sku: 'CY139-E', return_count: 1, suggestion: 'review dimensions' }),
    ]);
    expect(normalized[1].variants).toEqual([
      expect.objectContaining({
        sku: 'APL-20-40X-C',
        return_count: 1,
        suggestion: 'clarify phone compatibility',
      }),
      expect.objectContaining({
        sku: 'APL-20-40XJJ04-A',
        return_count: 1,
        suggestion: 'adjust adapter design',
      }),
    ]);
  });
});
