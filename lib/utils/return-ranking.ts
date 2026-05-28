export interface ReturnRankingInput {
  name: string;
  sku: string | null | undefined;
  channel: string;
  quantity: number;
}

export interface ReturnRankingRow {
  name: string;
  sku: string;
  channel: string;
  quantity: number;
}

function extractApFamilySkuGroup(rawSku: string): string {
  const dashIndex = rawSku.indexOf('-');
  const suffix = dashIndex >= 0 ? rawSku.slice(dashIndex + 1) : rawSku.slice(2);
  const group = suffix.slice(0, 6);

  return group || rawSku.slice(0, 6);
}

export function getReturnRankingSkuGroup(sku: string | null | undefined): string | null {
  const rawSku = sku?.trim().toUpperCase() || '';
  if (!rawSku) return null;

  if (rawSku.startsWith('AP')) {
    return extractApFamilySkuGroup(rawSku);
  }

  return rawSku.slice(0, 5);
}

export function aggregateReturnRanking(rows: ReturnRankingInput[]): ReturnRankingRow[] {
  const grouped = new Map<string, ReturnRankingRow & { nameTotals: Map<string, number> }>();

  rows.forEach((row) => {
    const groupedSku = getReturnRankingSkuGroup(row.sku);
    if (!groupedSku) return;

    const channel = row.channel.trim() || '-';
    const key = `${groupedSku}||${channel}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        name: row.name,
        sku: groupedSku,
        channel,
        quantity: 0,
        nameTotals: new Map<string, number>(),
      });
    }

    const entry = grouped.get(key)!;
    entry.quantity += row.quantity;

    const nextNameTotal = (entry.nameTotals.get(row.name) || 0) + row.quantity;
    entry.nameTotals.set(row.name, nextNameTotal);

    const selectedNameTotal = entry.nameTotals.get(entry.name) || 0;
    if (nextNameTotal > selectedNameTotal) {
      entry.name = row.name;
    }
  });

  return Array.from(grouped.values())
    .map((row) => ({
      name: row.name,
      sku: row.sku,
      channel: row.channel,
      quantity: row.quantity,
    }))
    .sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
      return a.channel.localeCompare(b.channel);
    });
}
