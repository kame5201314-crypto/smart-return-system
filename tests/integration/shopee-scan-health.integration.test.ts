import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { collectShopeeScanHealthSnapshot } from '@/lib/maintenance/shopee-scan-health';

type TableRow = Record<string, unknown>;

interface InMemoryState {
  shopee_scan_events: TableRow[];
  shopee_returns: TableRow[];
  shopee_unmatched_scans: TableRow[];
}

function projectColumns(rows: TableRow[], columns: string): TableRow[] {
  const clean = columns.trim();
  if (!clean || clean === '*') return rows;

  const selectedColumns = clean.split(',').map((item) => item.trim()).filter(Boolean);
  return rows.map((row) => {
    const projected: TableRow = {};
    for (const column of selectedColumns) {
      projected[column] = row[column];
    }
    return projected;
  });
}

function createInMemorySupabase(state: InMemoryState): SupabaseClient {
  const tables: InMemoryState = {
    shopee_scan_events: structuredClone(state.shopee_scan_events),
    shopee_returns: structuredClone(state.shopee_returns),
    shopee_unmatched_scans: structuredClone(state.shopee_unmatched_scans),
  };

  const from = (tableName: string) => ({
    select: (columns: string, options?: { count?: 'exact'; head?: boolean }) => {
      const sourceRows = [...((tables as Record<string, TableRow[]>)[tableName] || [])];
      const filters: Array<(row: TableRow) => boolean> = [];
      let sortField: string | null = null;
      let sortAscending = true;
      let rowLimit: number | null = null;

      const applyDateFilter = (value: unknown): number => {
        const parsed = new Date(String(value || '')).getTime();
        return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
      };

      const execute = () => {
        let rows = sourceRows.filter((row) => filters.every((matcher) => matcher(row)));

        if (sortField) {
          rows = rows.sort((a, b) => {
            const left = a[sortField as string];
            const right = b[sortField as string];
            if (left === right) return 0;
            if (left === null || left === undefined) return sortAscending ? -1 : 1;
            if (right === null || right === undefined) return sortAscending ? 1 : -1;
            return sortAscending
              ? String(left).localeCompare(String(right))
              : String(right).localeCompare(String(left));
          });
        }

        if (Number.isFinite(rowLimit || NaN)) {
          rows = rows.slice(0, rowLimit as number);
        }

        const count = options?.count === 'exact' ? rows.length : null;
        if (options?.head) {
          return { data: null, error: null, count };
        }

        return {
          data: projectColumns(rows, columns),
          error: null,
          count,
        };
      };

      const builder = {
        eq: (field: string, value: unknown) => {
          filters.push((row) => row[field] === value);
          return builder;
        },
        not: (field: string, operator: string, value: unknown) => {
          if (operator === 'is' && value === null) {
            filters.push((row) => row[field] !== null && row[field] !== undefined);
          }
          return builder;
        },
        is: (field: string, value: unknown) => {
          filters.push((row) => row[field] === value);
          return builder;
        },
        gte: (field: string, value: unknown) => {
          const boundary = applyDateFilter(value);
          filters.push((row) => applyDateFilter(row[field]) >= boundary);
          return builder;
        },
        lte: (field: string, value: unknown) => {
          const boundary = applyDateFilter(value);
          filters.push((row) => applyDateFilter(row[field]) <= boundary);
          return builder;
        },
        order: (field: string, config?: { ascending?: boolean }) => {
          sortField = field;
          sortAscending = config?.ascending ?? true;
          return builder;
        },
        limit: (limit: number) => {
          rowLimit = limit;
          return builder;
        },
        then: (
          onFulfilled?: (value: ReturnType<typeof execute>) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve(execute()).then(onFulfilled, onRejected),
        catch: (onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(execute()).catch(onRejected),
        finally: (onFinally?: () => void) => Promise.resolve(execute()).finally(onFinally),
      };

      return builder;
    },
  });

  return {
    from: from as SupabaseClient['from'],
  } as unknown as SupabaseClient;
}

describe('collectShopeeScanHealthSnapshot integration', () => {
  it('aggregates KPI/state and smoke checks from multi-table data', async () => {
    const supabase = createInMemorySupabase({
      shopee_scan_events: [
        {
          id: 'ev-1',
          scan_status: 'matched',
          scanned_at: '2026-03-04T01:00:00.000Z',
        },
        {
          id: 'ev-2',
          scan_status: 'unmatched',
          scanned_at: '2026-03-04T02:00:00.000Z',
        },
        {
          id: 'ev-3',
          scan_status: 'duplicate',
          scanned_at: '2026-03-04T03:00:00.000Z',
        },
        {
          id: 'ev-4',
          scan_status: 'matched',
          scanned_at: '2026-03-03T05:00:00.000Z',
        },
      ],
      shopee_returns: [
        { id: 'r1', is_scanned: true, scanned_at: '2026-03-04T01:00:00.000Z', is_inbound: false, inbound_at: null },
        { id: 'r2', is_scanned: true, scanned_at: '2026-03-04T01:30:00.000Z', is_inbound: true, inbound_at: '2026-03-04T04:00:00.000Z' },
        { id: 'r3', is_scanned: false, scanned_at: null, is_inbound: false, inbound_at: null },
        { id: 'r4', is_scanned: false, scanned_at: '2026-03-04T02:30:00.000Z', is_inbound: false, inbound_at: null },
        { id: 'r5', is_scanned: false, scanned_at: null, is_inbound: true, inbound_at: null },
      ],
      shopee_unmatched_scans: [
        {
          id: 'u1',
          sample_scanned_code: 'TW0001',
          normalized_code: 'TW0001',
          status: 'open',
          last_seen_at: '2026-03-02T00:00:00.000Z',
          hit_count: 3,
        },
        {
          id: 'u2',
          sample_scanned_code: 'TW0002',
          normalized_code: 'TW0002',
          status: 'open',
          last_seen_at: '2026-03-04T00:00:00.000Z',
          hit_count: 1,
        },
      ],
    });

    const snapshot = await collectShopeeScanHealthSnapshot(supabase, {
      now: new Date('2026-03-04T06:00:00.000Z'),
      slaHours: 24,
    });

    expect(snapshot.metricDate).toBe('2026-03-04');
    expect(snapshot.kpi.totalScans).toBe(3);
    expect(snapshot.kpi.matchedScans).toBe(1);
    expect(snapshot.kpi.unmatchedScans).toBe(1);
    expect(snapshot.kpi.duplicateScans).toBe(1);
    expect(snapshot.kpi.unmatchedRate).toBe(33.33);
    expect(snapshot.kpi.duplicateRate).toBe(33.33);

    expect(snapshot.state.totalRows).toBe(5);
    expect(snapshot.state.scannedRows).toBe(2);
    expect(snapshot.state.inboundRows).toBe(2);
    expect(snapshot.state.notInboundRows).toBe(3);
    expect(snapshot.state.staleUnmatchedOpenCount).toBe(1);
    expect(snapshot.staleUnmatchedOpenRows).toHaveLength(1);
    expect(snapshot.staleUnmatchedOpenRows[0]?.id).toBe('u1');

    expect(snapshot.smoke.passed).toBe(false);
    expect(snapshot.smoke.checks.scanTimestampMismatchCount).toBe(1);
    expect(snapshot.smoke.checks.inboundTimestampMissingCount).toBe(1);
    expect(snapshot.smoke.checks.inboundWithoutScanCount).toBe(1);
    expect(snapshot.smoke.checks.scanOnlyRowsCount).toBe(1);
    expect(snapshot.smoke.errors).toHaveLength(2);
    expect(snapshot.smoke.warnings).toHaveLength(1);
  });

  it('throws when schema probe fails', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'schema probe failed' },
          }),
        }),
      })),
    } as unknown as SupabaseClient;

    await expect(
      collectShopeeScanHealthSnapshot(supabase, {
        now: new Date('2026-03-04T06:00:00.000Z'),
        slaHours: 24,
      })
    ).rejects.toThrow('schema probe failed');
  });
});
