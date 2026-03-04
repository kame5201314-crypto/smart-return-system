import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createUntypedAdminClientMock,
  collectShopeeScanHealthSnapshotMock,
  emitSchemaDriftAlertMock,
} = vi.hoisted(() => ({
  createUntypedAdminClientMock: vi.fn(),
  collectShopeeScanHealthSnapshotMock: vi.fn(),
  emitSchemaDriftAlertMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createUntypedAdminClient: createUntypedAdminClientMock,
}));

vi.mock('@/lib/maintenance/shopee-scan-health', () => ({
  collectShopeeScanHealthSnapshot: collectShopeeScanHealthSnapshotMock,
}));

vi.mock('@/lib/observability/schema-drift', () => ({
  emitSchemaDriftAlert: emitSchemaDriftAlertMock,
}));

import { GET } from '@/app/api/cron/shopee-scan-smoke/route';

const PASSING_SNAPSHOT = {
  metricDate: '2026-03-04',
  periodStart: '2026-03-03T16:00:00.000Z',
  periodEnd: '2026-03-04T15:59:59.999Z',
  staleBefore: '2026-03-03T06:00:00.000Z',
  kpi: {
    totalScans: 10,
    matchedScans: 9,
    unmatchedScans: 1,
    duplicateScans: 0,
    unmatchedRate: 10,
    duplicateRate: 0,
  },
  state: {
    totalRows: 100,
    scannedRows: 90,
    inboundRows: 80,
    notInboundRows: 20,
    staleUnmatchedOpenCount: 0,
  },
  smoke: {
    passed: true,
    errors: [],
    warnings: [],
    checks: {
      scanTimestampMismatchCount: 0,
      inboundTimestampMismatchCount: 0,
      inboundTimestampMissingCount: 0,
      inboundWithoutScanCount: 0,
      scanOnlyRowsCount: 10,
    },
  },
  staleUnmatchedOpenRows: [],
};

const FAILING_SNAPSHOT = {
  ...PASSING_SNAPSHOT,
  smoke: {
    ...PASSING_SNAPSHOT.smoke,
    passed: false,
    errors: ['Found 1 rows where is_scanned = false but scanned_at is not null.'],
  },
};

describe('GET /api/cron/shopee-scan-smoke integration', () => {
  const envBackup = {
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createUntypedAdminClientMock.mockReturnValue({ from: vi.fn() });
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
  });

  afterEach(() => {
    process.env.CRON_SECRET = envBackup.CRON_SECRET;
    process.env.NODE_ENV = envBackup.NODE_ENV;
    process.env.VERCEL_ENV = envBackup.VERCEL_ENV;
  });

  it('returns 401 when authorization header is missing', async () => {
    const request = new Request('https://example.com/api/cron/shopee-scan-smoke');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Unauthorized');
    expect(collectShopeeScanHealthSnapshotMock).not.toHaveBeenCalled();
  });

  it('returns 200 when smoke check passed', async () => {
    collectShopeeScanHealthSnapshotMock.mockResolvedValue(PASSING_SNAPSHOT);
    const request = new Request('https://example.com/api/cron/shopee-scan-smoke?slaHours=24', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.metricDate).toBe('2026-03-04');
    expect(payload.data.smoke.passed).toBe(true);
    expect(emitSchemaDriftAlertMock).not.toHaveBeenCalled();
  });

  it('returns 500 and emits alert when smoke check failed', async () => {
    collectShopeeScanHealthSnapshotMock.mockResolvedValue(FAILING_SNAPSHOT);
    const request = new Request('https://example.com/api/cron/shopee-scan-smoke?slaHours=24', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    });

    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.data.smoke.passed).toBe(false);
    expect(emitSchemaDriftAlertMock).toHaveBeenCalledTimes(1);
    expect(emitSchemaDriftAlertMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        source: 'cron.shopee-scan-smoke',
        table: 'shopee_returns',
      })
    );
  });
});
