import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows.mjs';
import { isAIReportDatasetStale } from '@/lib/utils/ai-analysis-cache';

describe('complete analytics reads', () => {
  it.each([0, 500, 1000, 1436])('reads all %i rows, including exact page boundaries', async (count) => {
    const rows = Array.from({ length: count }, (_, id) => ({ id }));
    const result = await fetchAllRows(async (from, to) => ({
      data: rows.slice(from, to + 1), error: null,
    }));
    expect(result.data).toEqual(rows);
  });

  it('continues when the server cap is smaller than the requested page', async () => {
    const rows = Array.from({ length: 1436 }, (_, id) => ({ id }));
    const result = await fetchAllRows(async (from, to) => ({
      data: rows.slice(from, Math.min(to + 1, from + 100)), error: null,
    }));
    expect(result.data).toEqual(rows);
  });

  it('discards partial results when a later page fails', async () => {
    const error = { message: 'unavailable' };
    const fetchPage = vi.fn(async (from: number) => from === 0
      ? { data: [{ id: 1 }], error: null }
      : { data: null, error });
    expect(await fetchAllRows(fetchPage)).toEqual({ data: null, error });
  });

  it('keeps a truncated analysis stale even after headline totals were reconciled', () => {
    expect(isAIReportDatasetStale(JSON.stringify({
      dataset_counts: { official_returns: 20, shopee_returns: 11, pickup_records: 5 },
    }), 221)).toBe(true);
    expect(isAIReportDatasetStale(JSON.stringify({
      dataset_counts: { official_returns: 20, shopee_returns: 201, pickup_records: 5 },
    }), 221)).toBe(false);
    expect(isAIReportDatasetStale('legacy prompt', 221)).toBe(true);
  });
});
