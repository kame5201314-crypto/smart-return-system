function parseExcelDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  if (serial < 1 || serial > 100000) return null;

  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(serial) * 24 * 60 * 60 * 1000);
}

function extractYearMonthFromRaw(raw: string): string | null {
  const match = raw.match(/(\d{4})\D+(\d{1,2})/);
  if (!match) return null;

  const year = match[1];
  const monthNum = Number(match[2]);
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null;

  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

export function toYearMonth(value: unknown): string | null {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const excelDate = parseExcelDate(Number(raw));
    if (excelDate && !Number.isNaN(excelDate.getTime())) {
      const year = excelDate.getUTCFullYear();
      const month = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  }

  // Prefer raw text extraction first to avoid timezone shifting month boundaries.
  const rawYearMonth = extractYearMonthFromRaw(raw);
  if (rawYearMonth) return rawYearMonth;

  const parsedDate = new Date(raw);
  if (!Number.isNaN(parsedDate.getTime())) {
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
}

export interface ShopeeReturnPeriodSource {
  dispute_deadline?: unknown;
  created_at?: unknown;
  processed_at?: unknown;
  order_date?: unknown;
}

export function getShopeeReturnReportPeriod(row: ShopeeReturnPeriodSource): string | null {
  // `order_date` is the original purchase date and can be months before the return.
  // For return analytics, use the return workflow date first, then safe fallbacks.
  return (
    toYearMonth(row.dispute_deadline)
    ?? toYearMonth(row.created_at)
    ?? toYearMonth(row.processed_at)
    ?? toYearMonth(row.order_date)
  );
}

export function isShopeeReturnInReportPeriod(row: ShopeeReturnPeriodSource, period: string): boolean {
  return getShopeeReturnReportPeriod(row) === period;
}
