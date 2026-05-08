import { describe, expect, it } from 'vitest';

import { buildLocalAIAnalysisFallback } from '@/lib/utils/ai-analysis-fallback';
import { buildAIAnalysisPromptPayload } from '@/lib/utils/ai-analysis-prompt';
import { buildAISkuAnalysisGroups } from '@/lib/utils/ai-sku-analysis';

describe('buildLocalAIAnalysisFallback', () => {
  it('builds a usable text-only report when the AI provider is unavailable', () => {
    const skuGroups = buildAISkuAnalysisGroups([
      {
        productName: 'MEFU AI 雲眼 跟拍棒',
        sku: 'CY139-A',
        quantity: 2,
        channel: 'shopee',
        reasonTexts: ['尺寸太大'],
        buyerNoteTexts: ['夾在手機上太緊'],
        returnReasonNoteTexts: ['開合不順'],
      },
      {
        productName: 'MEFU AI 雲眼 跟拍棒',
        sku: 'CY139-C',
        quantity: 1,
        channel: 'shopee',
        reasonTexts: ['尺寸太大'],
      },
    ]);

    const payload = buildAIAnalysisPromptPayload({
      period: '2026-04',
      returns: [],
      shopeeReturns: [
        {
          platform: 'shopee',
          shipping_method: '店到店',
          return_reason: '尺寸太大',
          buyer_note: '夾在手機上太緊',
          return_reason_note: '開合不順',
          note: null,
        },
        {
          platform: 'shopee',
          shipping_method: '店到店',
          return_reason: '尺寸太大',
          buyer_note: null,
          return_reason_note: null,
          note: null,
        },
      ],
      pickupRecords: [],
      skuGroups,
    });

    const report = buildLocalAIAnalysisFallback(payload);

    expect(report.summary).toContain('2026-04');
    expect(report.summary).toContain('共分析 2 筆退貨資料');
    expect(report.pain_points[0]).toMatchObject({
      issue: '尺寸太大',
      frequency: 'high',
    });
    expect(report.sku_analysis[0]).toMatchObject({
      sku_group: 'CY139',
      return_count: 3,
    });
    expect(report.sku_analysis[0].variants.map((variant) => variant.sku)).toEqual([
      'CY139-A',
      'CY139-C',
    ]);
    expect(report.channel_analysis[0]).toMatchObject({
      channel: '蝦皮',
      return_count: 2,
    });
  });

  it('still returns structured defaults when reason text is missing', () => {
    const payload = buildAIAnalysisPromptPayload({
      period: '2026-04',
      returns: [],
      shopeeReturns: [],
      pickupRecords: [],
      skuGroups: [],
    });

    const report = buildLocalAIAnalysisFallback(payload);

    expect(report.pain_points[0].issue).toBe('待確認退貨原因');
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.sku_analysis).toEqual([]);
  });
});
