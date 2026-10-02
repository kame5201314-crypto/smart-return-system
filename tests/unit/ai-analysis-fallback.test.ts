import { describe, expect, it } from 'vitest';

import { buildLocalAIAnalysisFallback } from '@/lib/utils/ai-analysis-fallback';
import { buildAIAnalysisPromptPayload } from '@/lib/utils/ai-analysis-prompt';
import { buildAISkuAnalysisGroups } from '@/lib/utils/ai-sku-analysis';

describe('buildLocalAIAnalysisFallback', () => {
  it('uses channel counts instead of treating every return request as official', () => {
    const payload = buildAIAnalysisPromptPayload({
      period: '2026-09',
      returns: Array.from({ length: 20 }, (_, i) => ({
        channel_source: i < 14 ? 'official' : 'shopee', reason_category: null, reason_detail: null, refund_type: 'original',
      })),
      shopeeReturns: Array.from({ length: 201 }, (_, i) => ({
        platform: i < 79 ? 'shopee' : 'mall', shipping_method: null, return_reason: null,
        buyer_note: null, return_reason_note: null, note: null,
      })),
      pickupRecords: [], skuGroups: [],
    });
    const report = buildLocalAIAnalysisFallback(payload);
    expect(report.summary).toContain('共分析 221 筆');
    for (const text of ['官網 14 筆', '蝦皮 85 筆', '商城 122 筆']) {
      expect(report.summary).toContain(text);
    }
    expect(report.summary).not.toContain('官網 20 筆');
  });

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
