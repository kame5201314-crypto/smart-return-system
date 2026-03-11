import { describe, expect, it } from 'vitest';

import { buildAISkuAnalysisGroups } from '@/lib/utils/ai-sku-analysis';
import {
  buildAIAnalysisPromptPayload,
  buildTextOnlyAIAnalysisPrompt,
} from '@/lib/utils/ai-analysis-prompt';

describe('buildAIAnalysisPromptPayload', () => {
  it('includes buyer_note, return_reason and return_reason_note summaries without raw rows', () => {
    const skuGroups = buildAISkuAnalysisGroups([
      {
        productName: '商品 A',
        sku: 'APL-22X105-A',
        quantity: 3,
        reasonTexts: ['尺寸太大'],
        buyerNoteTexts: ['買家說太緊'],
        returnReasonNoteTexts: ['驗貨確認太緊'],
      },
    ]);

    const payload = buildAIAnalysisPromptPayload({
      period: '2026-03',
      returns: [
        {
          channel_source: '官網',
          reason_category: '尺寸問題',
          reason_detail: '太大',
          refund_type: 'refund',
          return_items: [{ reason: '穿戴太緊', resolution_type: 'full' }],
          inspection_records: [{ result: 'failed', inspector_comment: '尺寸不合' }],
        },
      ],
      shopeeReturns: [
        {
          platform: 'shopee',
          shipping_method: '蝦皮店到店',
          return_reason: '尺寸太小',
          buyer_note: '買家說太緊',
          return_reason_note: '驗貨確認太緊',
          note: '客服已聯繫',
        },
      ],
      pickupRecords: [
        {
          platform: '商城',
          logistics_provider: '黑貓',
          delivery_status: '已退回',
          received_status: '未收到',
          notes: '物流延遲',
        },
      ],
      skuGroups,
    });

    expect(payload.dataset_counts).toEqual({
      official_returns: 1,
      shopee_returns: 1,
      pickup_records: 1,
      total_rows: 3,
    });
    expect(payload.shopee_summary.return_reason_counts[0]).toMatchObject({
      label: '尺寸太小',
      count: 1,
    });
    expect(payload.shopee_summary.buyer_note_samples[0]).toMatchObject({
      label: '買家說太緊',
      count: 1,
    });
    expect(payload.shopee_summary.return_reason_note_samples[0]).toMatchObject({
      label: '驗貨確認太緊',
      count: 1,
    });
    expect(payload.sku_groups[0].buyer_note_texts).toEqual(['買家說太緊']);
    expect(payload.sku_groups[0].return_reason_note_texts).toEqual(['驗貨確認太緊']);
  });

  it('builds a compact text-only prompt', () => {
    const payload = buildAIAnalysisPromptPayload({
      period: '2026-03',
      returns: [],
      shopeeReturns: [],
      pickupRecords: [],
      skuGroups: [],
    });

    const prompt = buildTextOnlyAIAnalysisPrompt(payload);

    expect(prompt).toContain('No images are provided');
    expect(prompt).toContain('"dataset_counts"');
    expect(prompt).not.toContain('===== 退貨管理資料 =====');
    expect(prompt).not.toContain('request_number');
  });
});
