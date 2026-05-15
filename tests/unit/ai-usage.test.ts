import { describe, expect, it } from 'vitest';

import {
  buildAIUsageEventRecord,
  summarizeAIUsageMetadata,
} from '@/lib/utils/ai-usage';

describe('AI usage accounting', () => {
  it('summarizes direct Gemini usage metadata', () => {
    expect(
      summarizeAIUsageMetadata({
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      })
    ).toEqual({
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
    });
  });

  it('sums primary and repair Gemini usage metadata', () => {
    expect(
      summarizeAIUsageMetadata({
        primary: {
          promptTokenCount: 100,
          candidatesTokenCount: 200,
          totalTokenCount: 300,
        },
        repair: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      })
    ).toEqual({
      promptTokenCount: 110,
      candidatesTokenCount: 220,
      totalTokenCount: 330,
    });
  });

  it('builds a database insert record for cached analysis reuse', () => {
    expect(
      buildAIUsageEventRecord({
        feature: 'return_ai_analysis',
        reportPeriod: '2026-04',
        model: 'cache',
        requestFingerprint: 'fingerprint-1',
        cached: true,
        success: true,
        usageMetadata: null,
      })
    ).toMatchObject({
      feature: 'return_ai_analysis',
      report_period: '2026-04',
      model: 'cache',
      request_fingerprint: 'fingerprint-1',
      cached: true,
      success: true,
      total_token_count: 0,
      metadata: {
        usage_metadata: null,
      },
    });
  });
});
