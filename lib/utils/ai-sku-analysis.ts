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

export interface AISkuAnalysisVariantResult {
  product_name: string;
  sku: string;
  return_count: number;
  main_issues: string[];
  suggestion: string;
}

export interface AISkuAnalysisGroupResult {
  sku_group: string;
  sku: string;
  product_name: string;
  return_count: number;
  return_rate?: string;
  main_issues: string[];
  suggestion: string;
  variants: AISkuAnalysisVariantResult[];
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

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  value.forEach((item) => {
    const normalized = normalizeTextSample(item);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

interface MutableVariantResult extends AISkuAnalysisVariantResult {
  mainIssueSet: Set<string>;
  productWeight: number;
  suggestionWeight: number;
  order: number;
}

interface MutableGroupResult extends AISkuAnalysisGroupResult {
  mainIssueSet: Set<string>;
  productWeight: number;
  suggestionWeight: number;
  order: number;
  variantMap: Map<string, MutableVariantResult>;
}

function ensureGroup(
  groups: Map<string, MutableGroupResult>,
  skuGroup: string,
  fallbackProductName: string,
  order: number
): MutableGroupResult {
  const existing = groups.get(skuGroup);
  if (existing) {
    existing.order = Math.min(existing.order, order);
    return existing;
  }

  const created: MutableGroupResult = {
    sku_group: skuGroup,
    sku: skuGroup,
    product_name: fallbackProductName || '-',
    return_count: 0,
    main_issues: [],
    suggestion: '',
    order,
    mainIssueSet: new Set<string>(),
    productWeight: 0,
    suggestionWeight: 0,
    variantMap: new Map(),
    variants: [],
  };

  groups.set(skuGroup, created);
  return created;
}

function applyGroupDetails(
  group: MutableGroupResult,
  productName: string,
  mainIssues: string[],
  suggestion: string,
  weight: number
) {
  if (productName && (group.product_name === '-' || weight >= group.productWeight)) {
    group.product_name = productName;
    group.productWeight = weight;
  }

  mainIssues.forEach((issue) => {
    if (issue && !group.mainIssueSet.has(issue)) {
      group.mainIssueSet.add(issue);
    }
  });

  if (suggestion && weight >= group.suggestionWeight) {
    group.suggestion = suggestion;
    group.suggestionWeight = weight;
  }
}

function ensureVariant(
  group: MutableGroupResult,
  rawSku: string,
  fallbackProductName: string,
  order: number
): MutableVariantResult {
  const normalizedSku = rawSku.trim().toUpperCase();
  const existing = group.variantMap.get(normalizedSku);
  if (existing) {
    existing.order = Math.min(existing.order, order);
    return existing;
  }

  const created: MutableVariantResult = {
    product_name: fallbackProductName || '-',
    sku: normalizedSku,
    return_count: 0,
    main_issues: [],
    suggestion: '',
    order,
    mainIssueSet: new Set<string>(),
    productWeight: 0,
    suggestionWeight: 0,
  };

  group.variantMap.set(normalizedSku, created);
  return created;
}

function applyVariantDetails(
  variant: MutableVariantResult,
  productName: string,
  mainIssues: string[],
  suggestion: string,
  weight: number
) {
  if (productName && (variant.product_name === '-' || weight >= variant.productWeight)) {
    variant.product_name = productName;
    variant.productWeight = weight;
  }

  mainIssues.forEach((issue) => {
    if (issue && !variant.mainIssueSet.has(issue)) {
      variant.mainIssueSet.add(issue);
    }
  });

  if (suggestion && weight >= variant.suggestionWeight) {
    variant.suggestion = suggestion;
    variant.suggestionWeight = weight;
  }
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
    .map((group) => ({
      sku_group: group.sku_group,
      product_name: group.product_name,
      return_count: group.return_count,
      channels: sortTextList(group.channels),
      reason_texts: sortTextList(group.reason_texts),
      buyer_note_texts: sortTextList(group.buyer_note_texts),
      return_reason_note_texts: sortTextList(group.return_reason_note_texts),
      variants: Array.from(group.variantMap.values())
        .map((variant) => ({
          product_name: variant.product_name,
          sku: variant.sku,
          return_count: variant.return_count,
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

export function normalizeAISkuAnalysisOutput(
  rawValue: unknown,
  candidates?: AISkuAnalysisGroupInput[]
): AISkuAnalysisGroupResult[] {
  const groups = new Map<string, MutableGroupResult>();
  const rawItems = Array.isArray(rawValue) ? rawValue : [];

  rawItems.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const itemRecord = item as Record<string, unknown>;
    const rawSkuGroup = toStringOrEmpty(itemRecord.sku_group) || toStringOrEmpty(itemRecord.sku);
    const normalizedGroup = getReturnRankingSkuGroup(rawSkuGroup) || rawSkuGroup.toUpperCase();
    if (!normalizedGroup) {
      return;
    }

    const rawReturnCount = Number(itemRecord.return_count);
    const groupWeight = Number.isFinite(rawReturnCount) && rawReturnCount > 0 ? rawReturnCount : 0;
    const group = ensureGroup(
      groups,
      normalizedGroup,
      toStringOrEmpty(itemRecord.product_name) || '-',
      index
    );

    if (!candidates) {
      group.return_count += groupWeight;
    }

    applyGroupDetails(
      group,
      toStringOrEmpty(itemRecord.product_name) || '-',
      toStringArray(itemRecord.main_issues),
      toStringOrEmpty(itemRecord.suggestion),
      groupWeight
    );

    const rawVariants = Array.isArray(itemRecord.variants) ? itemRecord.variants : [];

    if (rawVariants.length > 0) {
      rawVariants.forEach((variant, variantIndex) => {
        if (!variant || typeof variant !== 'object') {
          return;
        }

        const variantRecord = variant as Record<string, unknown>;
        const rawSku = toStringOrEmpty(variantRecord.sku).toUpperCase();
        if (!rawSku) {
          return;
        }

        const rawVariantCount = Number(variantRecord.return_count);
        const variantWeight =
          Number.isFinite(rawVariantCount) && rawVariantCount > 0 ? rawVariantCount : 0;
        const groupVariant = ensureVariant(
          group,
          rawSku,
          toStringOrEmpty(variantRecord.product_name) || '-',
          index * 100 + variantIndex
        );

        if (!candidates) {
          groupVariant.return_count += variantWeight;
        }

        applyVariantDetails(
          groupVariant,
          toStringOrEmpty(variantRecord.product_name) || '-',
          toStringArray(variantRecord.main_issues),
          toStringOrEmpty(variantRecord.suggestion),
          variantWeight
        );
      });
      return;
    }

    const rawSku = toStringOrEmpty(itemRecord.sku).toUpperCase();
    if (!rawSku) {
      return;
    }

    const shouldTreatAsVariant = rawSku !== normalizedGroup;
    if (!shouldTreatAsVariant) {
      return;
    }

    const groupVariant = ensureVariant(
      group,
      rawSku,
      toStringOrEmpty(itemRecord.product_name) || '-',
      index
    );

    if (!candidates) {
      groupVariant.return_count += groupWeight;
    }

    applyVariantDetails(
      groupVariant,
      toStringOrEmpty(itemRecord.product_name) || '-',
      toStringArray(itemRecord.main_issues),
      toStringOrEmpty(itemRecord.suggestion),
      groupWeight
    );
  });

  if (Array.isArray(candidates)) {
    candidates.forEach((candidate, index) => {
      const group = ensureGroup(groups, candidate.sku_group, candidate.product_name || '-', index);
      group.return_count = candidate.return_count;

      if (!group.mainIssueSet.size && candidate.reason_texts.length > 0) {
        candidate.reason_texts.slice(0, TEXT_SAMPLE_LIMIT).forEach((issue) => {
          if (issue) {
            group.mainIssueSet.add(issue);
          }
        });
      }

      candidate.variants.forEach((candidateVariant, variantIndex) => {
        const variant = ensureVariant(
          group,
          candidateVariant.sku,
          candidateVariant.product_name || '-',
          index * 100 + variantIndex
        );
        variant.return_count = candidateVariant.return_count;

        if (!variant.mainIssueSet.size && candidateVariant.reason_texts.length > 0) {
          candidateVariant.reason_texts.slice(0, TEXT_SAMPLE_LIMIT).forEach((issue) => {
            if (issue) {
              variant.mainIssueSet.add(issue);
            }
          });
        }
      });
    });
  }

  const sortedGroups = Array.from(groups.values())
    .filter((group) => group.return_count > 0 || group.variantMap.size > 0)
    .map((group) => {
      const variants = Array.from(group.variantMap.values())
        .filter((variant) => variant.return_count > 0 || variant.mainIssueSet.size > 0)
        .map((variant) => ({
          product_name: variant.product_name,
          sku: variant.sku,
          return_count: variant.return_count,
          suggestion: variant.suggestion,
          main_issues: Array.from(variant.mainIssueSet),
        }))
        .sort((a, b) => {
          if (b.return_count !== a.return_count) return b.return_count - a.return_count;
          return a.sku.localeCompare(b.sku);
        });

      const result: AISkuAnalysisGroupResult & { order: number } = {
        sku_group: group.sku_group,
        sku: group.sku,
        product_name: group.product_name,
        return_count: group.return_count,
        suggestion: group.suggestion,
        main_issues: Array.from(group.mainIssueSet),
        variants,
        order: group.order,
      };

      if (group.return_rate !== undefined) {
        result.return_rate = group.return_rate;
      }

      return result;
    })
    .sort((a, b) => {
      if (Array.isArray(candidates)) {
        if (a.order !== b.order) return a.order - b.order;
      }

      if (b.return_count !== a.return_count) return b.return_count - a.return_count;
      return a.sku_group.localeCompare(b.sku_group);
    });

  return sortedGroups.map((group) => {
    const result: AISkuAnalysisGroupResult = {
      sku_group: group.sku_group,
      sku: group.sku,
      product_name: group.product_name,
      return_count: group.return_count,
      main_issues: group.main_issues,
      suggestion: group.suggestion,
      variants: group.variants,
    };

    if (group.return_rate !== undefined) {
      result.return_rate = group.return_rate;
    }

    return result;
  });
}
