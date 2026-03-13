import { describe, expect, it } from 'vitest';

import { extractTextScanCandidates } from '@/lib/utils/text-scan-candidates';

describe('extractTextScanCandidates', () => {
  it('extracts pickup code from OCR text block', () => {
    const rawText = `
      P02972589847
      sample
      mixed OCR text
    `;

    expect(extractTextScanCandidates(rawText)).toContain('P02972589847');
  });

  it('extracts tracking and order-like codes from mixed OCR text', () => {
    const rawText = `
      TW2631984572320
      260130D0X7N6FH
    `;

    const candidates = extractTextScanCandidates(rawText);

    expect(candidates).toContain('TW2631984572320');
    expect(candidates).toContain('260130D0X7N6FH');
  });

  it('deduplicates repeated OCR candidates', () => {
    const rawText = `
      P02972589847
      P02972589847
    `;

    expect(extractTextScanCandidates(rawText)).toEqual(['P02972589847']);
  });
});
