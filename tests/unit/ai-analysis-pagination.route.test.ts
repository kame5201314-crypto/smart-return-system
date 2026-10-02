// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  failTable: '',
  writes: [] as { table: string; row: Record<string, unknown> }[],
}));

vi.mock('@/lib/auth/request-auth', () => ({ isAuthenticatedRequest: async () => true }));
vi.mock('@/lib/observability/schema-drift', () => ({ emitSchemaDriftAlert: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => {
  const client = () => ({
    from(table: string) {
      let start = 0, end = 999;
      let single = false;
      let inserted: Record<string, unknown> | null = null;
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      const query = {
        select: () => query,
        order: () => query,
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
        gte: (key: string, value: string) => { filters.push(row => String(row[key]) >= value); return query; },
        lt: (key: string, value: string) => { filters.push(row => String(row[key]) < value); return query; },
        range: (from: number, to: number) => { start = from; end = to; return query; },
        limit: (limit: number) => { end = limit - 1; return query; },
        maybeSingle: () => { single = true; return query; },
        single: () => { single = true; return query; },
        insert: (row: Record<string, unknown>) => { inserted = row; return query; },
        then(resolve: (result: unknown) => unknown) {
          if (state.failTable === table && start >= 500) return Promise.resolve(resolve({ data: null, error: { message: 'page failed' } }));
          if (inserted) {
            state.writes.push({ table, row: inserted });
            return Promise.resolve(resolve({ data: single ? { id: 'new-report' } : [], error: null }));
          }
          const rows = (state.tables[table] || []).filter(row => filters.every(filter => filter(row))).slice(start, end + 1);
          return Promise.resolve(resolve({ data: single ? rows[0] || null : rows, error: null }));
        },
      };
      return query;
    },
  });
  return { createAdminClient: client, createUntypedAdminClient: client };
});

import { GET, POST } from '@/app/api/v1/ai/analyze/route';

beforeEach(() => {
  state.failTable = '';
  state.writes = [];
  state.tables = {
    return_requests: Array.from({ length: 20 }, (_, id) => ({
      id: `r${id}`, created_at: '2026-09-15', channel_source: id < 14 ? 'official' : 'shopee', refund_amount: 10,
    })),
    // Reproduce production: first 1000 contain 11 September rows; all 1436 contain 201.
    shopee_returns: Array.from({ length: 1436 }, (_, id) => ({
      id: `s${id}`, order_date: id < 11 || (id >= 1000 && id < 1190) ? '2026-09-15' : '2026-08-15',
      platform: 'shopee', refund_amount: 10,
    })),
    ai_analysis_reports: [{
      id: 'old-report', report_period: '2026-09', total_returns: 31,
      raw_prompt: JSON.stringify({ dataset_counts: { official_returns: 20, shopee_returns: 11 } }),
    }],
    pickup_records: [],
  };
  vi.stubEnv('GEMINI_API_KEY', 'test-only');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      summary: 'Complete analysis', pain_points: [], recommendations: [], sku_analysis: [], channel_analysis: [],
    }) }] } }],
  }), { status: 200 })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('AI monthly analysis pagination', () => {
  it('rejects the old 31-row report against the full 221-row dataset', async () => {
    const response = await GET(new NextRequest('http://localhost/api/v1/ai/analyze?period=2026-09'));
    expect(response.status).toBe(200);
    expect((await response.json()).data[0]).toMatchObject({ is_stale: true, expected_total_returns: 221 });
  });

  it('still rejects the old narrative after cron repairs its headline total', async () => {
    state.tables.ai_analysis_reports[0].total_returns = 221;
    const response = await GET(new NextRequest('http://localhost/api/v1/ai/analyze?period=2026-09'));
    expect((await response.json()).data[0].is_stale).toBe(true);
  });

  it('generates and saves statistics and prompt using all 221 September rows', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/ai/analyze', {
      method: 'POST', body: JSON.stringify({ period: '2026-09' }),
    }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.statistics).toMatchObject({ totalReturns: 221, totalRefundAmount: 2210 });
    const report = state.writes.find(write => write.table === 'ai_analysis_reports')!.row;
    expect(report.total_returns).toBe(221);
    expect(JSON.parse(String(report.raw_prompt)).dataset_counts).toMatchObject({ official_returns: 20, shopee_returns: 201 });
  });

  it('does not serve reports when a source page fails', async () => {
    state.failTable = 'shopee_returns';
    const response = await GET(new NextRequest('http://localhost/api/v1/ai/analyze?period=2026-09'));
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });

  it('does not call AI or save a report when a source page fails', async () => {
    state.failTable = 'shopee_returns';
    const response = await POST(new NextRequest('http://localhost/api/v1/ai/analyze', {
      method: 'POST', body: JSON.stringify({ period: '2026-09' }),
    }));
    expect(response.status).toBe(500);
    expect(state.writes).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
