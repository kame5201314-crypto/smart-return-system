import { describe, expect, it } from 'vitest';
import {
  applyFallbackResolutionTypeToItems,
  normalizeResolutionTypeFromFallback,
} from '@/lib/utils/resolution-fallback';

describe('resolution fallback helpers', () => {
  it('normalizes legacy fallback labels to valid resolution type', () => {
    expect(normalizeResolutionTypeFromFallback('partial_refund')).toBe('partial');
    expect(normalizeResolutionTypeFromFallback('換貨')).toBe('exchange');
    expect(normalizeResolutionTypeFromFallback('來回件')).toBe('round_trip');
    expect(normalizeResolutionTypeFromFallback('unknown')).toBe('full');
  });

  it('applies fallback value when item resolution_type is missing or invalid', () => {
    const rows = [
      { id: '1', resolution_type: null },
      { id: '2', resolution_type: 'invalid_value' },
      { id: '3', resolution_type: 'exchange' },
    ];

    const result = applyFallbackResolutionTypeToItems(rows, 'round_trip');
    expect(result).toEqual([
      { id: '1', resolution_type: 'round_trip' },
      { id: '2', resolution_type: 'round_trip' },
      { id: '3', resolution_type: 'exchange' },
    ]);
  });
});

