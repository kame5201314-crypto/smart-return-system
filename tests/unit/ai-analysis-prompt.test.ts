import { describe, expect, it } from 'vitest';

import { buildAISkuAnalysisGroups } from '@/lib/utils/ai-sku-analysis';
import {
  buildAIAnalysisPromptPayload,
  buildAIAnalysisPromptStorageSnapshot,
  buildAIAnalysisResponseSnapshot,
  buildTextOnlyAIAnalysisPrompt,
} from '@/lib/utils/ai-analysis-prompt';

describe('buildAIAnalysisPromptPayload', () => {
  it('includes buyer note and reason note summaries without raw rows', () => {
    const skuGroups = buildAISkuAnalysisGroups([
      {
        productName: 'Lens A',
        sku: 'APL-22X105-A',
        quantity: 3,
        reasonTexts: ['too large'],
        buyerNoteTexts: ['hard to open'],
        returnReasonNoteTexts: ['inspection note'],
      },
    ]);

    const payload = buildAIAnalysisPromptPayload({
      period: '2026-03',
      returns: [
        {
          channel_source: 'official',
          reason_category: 'quality',
          reason_detail: 'focus issue',
          refund_type: 'refund',
          return_items: [{ reason: 'damaged', resolution_type: 'full' }],
          inspection_records: [{ result: 'failed', inspector_comment: 'lens scratch' }],
        },
      ],
      shopeeReturns: [
        {
          platform: 'shopee',
          shipping_method: 'store pickup',
          return_reason: 'size issue',
          buyer_note: 'hard to open',
          return_reason_note: 'inspection note',
          note: 'admin follow-up',
        },
      ],
      pickupRecords: [
        {
          platform: 'mall',
          logistics_provider: 'hct',
          delivery_status: 'delivered',
          received_status: 'pending',
          notes: 'manual follow-up',
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
      label: 'size issue',
      count: 1,
    });
    expect(payload.shopee_summary.buyer_note_samples[0]).toMatchObject({
      label: 'hard to open',
      count: 1,
    });
    expect(payload.shopee_summary.return_reason_note_samples[0]).toMatchObject({
      label: 'inspection note',
      count: 1,
    });
    expect(payload.sku_groups[0].buyer_note_texts).toEqual(['hard to open']);
    expect(payload.sku_groups[0].return_reason_note_texts).toEqual(['inspection note']);
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
    expect(prompt).not.toContain('request_number');
  });

  it('stores a prompt snapshot without raw text arrays', () => {
    const payload = buildAIAnalysisPromptPayload({
      period: '2026-03',
      returns: [],
      shopeeReturns: [],
      pickupRecords: [],
      skuGroups: buildAISkuAnalysisGroups([
        {
          productName: 'Lens A',
          sku: 'APL-22X105-A',
          quantity: 3,
          reasonTexts: ['too large', 'too tight'],
          buyerNoteTexts: ['hard to open'],
          returnReasonNoteTexts: ['inspection note'],
        },
      ]),
    });

    const prompt = buildTextOnlyAIAnalysisPrompt(payload);
    const snapshot = buildAIAnalysisPromptStorageSnapshot({
      period: '2026-03',
      prompt,
      payload,
      modelCandidates: ['models/gemini-2.0-flash-lite'],
    });

    expect(snapshot.prompt_character_count).toBe(prompt.length);
    expect(snapshot.sku_group_overview[0]).toMatchObject({
      sku_group: '22X105',
      variant_count: 1,
      reason_sample_count: 2,
      buyer_note_sample_count: 1,
      return_reason_note_sample_count: 1,
    });
    expect(JSON.stringify(snapshot)).not.toContain('too large');
  });

  it('stores response diagnostics with model and usage metadata', () => {
    const snapshot = buildAIAnalysisResponseSnapshot({
      model: 'models/gemini-2.0-flash-lite',
      text: '{"summary":"ok"}',
      usageMetadata: {
        promptTokenCount: 123,
        totalTokenCount: 456,
      },
    });

    expect(snapshot).toMatchObject({
      model: 'models/gemini-2.0-flash-lite',
      response_character_count: 16,
    });
    expect(snapshot.usage_metadata).toMatchObject({
      promptTokenCount: 123,
      totalTokenCount: 456,
    });
  });
});
