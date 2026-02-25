import { describe, expect, it } from 'vitest';
import {
  containsLikelyMojibake,
  isLikelyMojibakeText,
} from '@/lib/utils/text-hygiene';

describe('text hygiene utilities', () => {
  it('detects mojibake-like text', () => {
    const doubledQuestion = '?'.repeat(2);
    const mixedQuestion = '?';

    expect(isLikelyMojibakeText(`蝦皮${doubledQuestion}商城${doubledQuestion}來回件`)).toBe(true);
    expect(isLikelyMojibakeText(`蝦皮${mixedQuestion}商城${mixedQuestion}來回件`)).toBe(true);
    expect(isLikelyMojibakeText('含有\uFFFD替代字元')).toBe(true);
  });

  it('does not flag normal traditional chinese text', () => {
    expect(isLikelyMojibakeText('2026年2月共55筆退貨，主要集中在蝦皮商城。')).toBe(false);
    expect(isLikelyMojibakeText('請用 JSON 格式回覆')).toBe(false);
  });

  it('recursively scans nested objects', () => {
    const mixedQuestion = '?';
    const payload = {
      summary: '正常內容',
      pain_points: [
        {
          issue: '品質問題',
          details: `蝦皮${mixedQuestion}商城${mixedQuestion}來回件`,
        },
      ],
    };

    expect(containsLikelyMojibake(payload)).toBe(true);
    expect(containsLikelyMojibake({ summary: '內容正常', recommendations: [] })).toBe(false);
  });
});
