import { describe, expect, it } from 'vitest';

import {
  buildAIJsonRepairPrompt,
  extractFirstJsonObject,
  parseAIAnalysisResponseText,
} from '@/lib/utils/ai-analysis-response';

describe('ai-analysis-response', () => {
  it('extracts JSON from markdown fences', () => {
    const raw = '```json\n{"summary":"ok","pain_points":[],"recommendations":[],"sku_analysis":[],"channel_analysis":[]}\n```';

    expect(extractFirstJsonObject(raw)).toContain('"summary":"ok"');
  });

  it('repairs trailing commas in JSON object', () => {
    const raw = '{"summary":"ok","pain_points":[],"recommendations":[],"sku_analysis":[],"channel_analysis":[],}';

    expect(parseAIAnalysisResponseText(raw)).toMatchObject({ summary: 'ok' });
  });

  it('extracts first balanced object from extra text', () => {
    const raw = 'Here is the result:\n{"summary":"ok","pain_points":[],"recommendations":[],"sku_analysis":[],"channel_analysis":[]}\nthanks';

    expect(parseAIAnalysisResponseText(raw)).toMatchObject({ summary: 'ok' });
  });

  it('builds repair prompt with required keys', () => {
    const prompt = buildAIJsonRepairPrompt('broken');

    expect(prompt).toContain('summary, pain_points, recommendations, sku_analysis, channel_analysis');
    expect(prompt).toContain('broken');
  });
});
