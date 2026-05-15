import { describe, expect, it } from 'vitest';

import {
  decideAIAnalysisCacheReuse,
  isAIAnalysisCacheEnabled,
} from '@/lib/utils/ai-analysis-cache';

describe('AI analysis cache controls', () => {
  it('enables cache by default', () => {
    expect(isAIAnalysisCacheEnabled(undefined)).toBe(true);
    expect(isAIAnalysisCacheEnabled('')).toBe(true);
  });

  it('allows cache to be disabled by environment value', () => {
    expect(isAIAnalysisCacheEnabled('false')).toBe(false);
    expect(isAIAnalysisCacheEnabled('0')).toBe(false);
    expect(isAIAnalysisCacheEnabled('off')).toBe(false);
  });

  it('reuses a report only when cache is enabled and fingerprints match', () => {
    expect(
      decideAIAnalysisCacheReuse({
        cacheEnabled: true,
        existingFingerprint: 'abc',
        payloadFingerprint: 'abc',
      })
    ).toEqual({ reuse: true, reason: 'fingerprint_match' });

    expect(
      decideAIAnalysisCacheReuse({
        cacheEnabled: true,
        existingFingerprint: 'abc',
        payloadFingerprint: 'def',
      })
    ).toEqual({ reuse: false, reason: 'fingerprint_mismatch' });

    expect(
      decideAIAnalysisCacheReuse({
        cacheEnabled: false,
        existingFingerprint: 'abc',
        payloadFingerprint: 'abc',
      })
    ).toEqual({ reuse: false, reason: 'cache_disabled' });
  });
});
