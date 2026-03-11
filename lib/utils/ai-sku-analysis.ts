import { getReturnRankingSkuGroup } from '@/lib/utils/return-ranking';

export interface AISkuAnalysisSourceRow {
  productName: string | null | undefined;
  sku: string | null | undefined;
  quantity: number | null | undefined;
  channel?: string | null | undefined;
  reasonTexts?: Array<string | null | undefined>;
  buyerNoteTexts?: Array<string | null | undefined>;
  returnReasonNoteTexts?: Array<string | null | undefined>;
}

export interface AISkuAnalysisVariantInput {
  product_name: string;
  sku: string;
  return_count: number;
  channels: string[];
  reason_texts: string[];
  buyer_note_texts: string[];
  return_reason_note_texts: string[];
}

export interface AISkuAnalysisGroupInput {
  sku_group: string;
  product_name: string;
  return_count: number;
  channels: string[];
  reason_texts: string[];
  buyer_note_texts: string[];
  return_reason_note_texts: string[];
  variants: AISkuAnalysisVariantInput[];
}

const TEXT_SAMPLE_LIMIT = 8;

function normalizeTextSample(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function pushUniqueText(target: string[], rawValue: string | null | undefined) {
  const value = normalizeTextSample(rawValue);
  if (!value) return;
  if (target.includes(value)) return;
  if (target.length >= TEXT_SAMPLE_LIMIT) return;
  target.push(value);
}

function sortTextList(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, 'en'));
}

export function buildAISkuAnalysisGroups(
  rows: AISkuAnalysisSourceRow[],
  limit = 20
): AISkuAnalysisGroupInput[] {
  const grouped = new Map<
    string,
    AISkuAnalysisGroupInput & {
      productNameTotals: Map<string, number>;
      variantMap: Map<string, AISkuAnalysisVariantInput & { productNameTotals: Map<string, number> }>;
    }
  >();

  rows.forEach((row) => {
    const skuGroup = getReturnRankingSkuGroup(row.sku);
    const rawSku = row.sku?.trim().toUpperCase() || '';
    const productName = row.productName?.trim() || '-';
    const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : 0;

    if (!skuGroup || !rawSku || quantity <= 0) {
      return;
    }

    const channels = Array.isArray(row.channel) ? row.channel : [row.channel];
    const safeChannels = channels
      .map((value) => normalizeTextSample(value))
      .filter((value): value is string => Boolean(value));

    const reasonTexts = row.reasonTexts || [];
    const buyerNoteTexts = row.buyerNoteTexts || [];
    const returnReasonNoteTexts = row.returnReasonNoteTexts || [];

    if (!grouped.has(skuGroup)) {
      grouped.set(skuGroup, {
        sku_group: skuGroup,
        product_name: productName,
        return_count: 0,
        channels: [],
        reason_texts: [],
        buyer_note_texts: [],
        return_reason_note_texts: [],
        variants: [],
        productNameTotals: new Map<string, number>(),
        variantMap: new Map(),
      });
    }

    const group = grouped.get(skuGroup)!;
    group.return_count += quantity;

    const nextGroupNameTotal = (group.productNameTotals.get(productName) || 0) + quantity;
    group.productNameTotals.set(productName, nextGroupNameTotal);

    if (nextGroupNameTotal > (group.productNameTotals.get(group.product_name) || 0)) {
      group.product_name = productName;
    }

    safeChannels.forEach((channel) => {
      if (!group.channels.includes(channel)) {
        group.channels.push(channel);
      }
    });

    reasonTexts.forEach((text) => pushUniqueText(group.reason_texts, text));
    buyerNoteTexts.forEach((text) => pushUniqueText(group.buyer_note_texts, text));
    returnReasonNoteTexts.forEach((text) => pushUniqueText(group.return_reason_note_texts, text));

    if (!group.variantMap.has(rawSku)) {
      group.variantMap.set(rawSku, {
        product_name: productName,
        sku: rawSku,
        return_count: 0,
        channels: [],
        reason_texts: [],
        buyer_note_texts: [],
        return_reason_note_texts: [],
        productNameTotals: new Map<string, number>(),
      });
    }

    const variant = group.variantMap.get(rawSku)!;
    variant.return_count += quantity;

    const nextVariantNameTotal = (variant.productNameTotals.get(productName) || 0) + quantity;
    variant.productNameTotals.set(productName, nextVariantNameTotal);

    if (nextVariantNameTotal > (variant.productNameTotals.get(variant.product_name) || 0)) {
      variant.product_name = productName;
    }

    safeChannels.forEach((channel) => {
      if (!variant.channels.includes(channel)) {
        variant.channels.push(channel);
      }
    });

    reasonTexts.forEach((text) => pushUniqueText(variant.reason_texts, text));
    buyerNoteTexts.forEach((text) => pushUniqueText(variant.buyer_note_texts, text));
    returnReasonNoteTexts.forEach((text) => pushUniqueText(variant.return_reason_note_texts, text));
  });

  return Array.from(grouped.values())
    .map(({ productNameTotals: _groupTotals, variantMap, ...group }) => ({
      ...group,
      channels: sortTextList(group.channels),
      reason_texts: sortTextList(group.reason_texts),
      buyer_note_texts: sortTextList(group.buyer_note_texts),
      return_reason_note_texts: sortTextList(group.return_reason_note_texts),
      variants: Array.from(variantMap.values())
        .map(({ productNameTotals: _variantTotals, ...variant }) => ({
          ...variant,
          channels: sortTextList(variant.channels),
          reason_texts: sortTextList(variant.reason_texts),
          buyer_note_texts: sortTextList(variant.buyer_note_texts),
          return_reason_note_texts: sortTextList(variant.return_reason_note_texts),
        }))
        .sort((a, b) => {
          if (b.return_count !== a.return_count) return b.return_count - a.return_count;
          return a.sku.localeCompare(b.sku);
        }),
    }))
    .sort((a, b) => {
      if (b.return_count !== a.return_count) return b.return_count - a.return_count;
      return a.sku_group.localeCompare(b.sku_group);
    })
    .slice(0, limit);
}
