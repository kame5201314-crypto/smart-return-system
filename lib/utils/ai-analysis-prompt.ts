import { createHash } from 'crypto';

import type { AISkuAnalysisGroupInput } from '@/lib/utils/ai-sku-analysis';

export interface PromptReturnAnalysisData {
  channel_source: string | null;
  reason_category: string | null;
  reason_detail: string | null;
  refund_type: string;
  return_items?: {
    reason: string | null;
    resolution_type?: string | null;
  }[];
  inspection_records?: {
    result: string | null;
    inspector_comment: string | null;
  }[];
}

export interface PromptShopeeReturnData {
  platform: string | null;
  shipping_method: string | null;
  return_reason: string | null;
  buyer_note: string | null;
  return_reason_note: string | null;
  note: string | null;
}

export interface PromptPickupRecordData {
  platform: string;
  logistics_provider: string;
  delivery_status: string;
  received_status: string;
  notes: string | null;
}

export interface PromptCountRow {
  label: string;
  count: number;
}

export interface AIAnalysisPromptPayload {
  period: string;
  dataset_counts: {
    official_returns: number;
    shopee_returns: number;
    pickup_records: number;
    total_rows: number;
  };
  official_summary: {
    channel_counts: PromptCountRow[];
    reason_category_counts: PromptCountRow[];
    reason_detail_counts: PromptCountRow[];
    item_reason_counts: PromptCountRow[];
    refund_type_counts: PromptCountRow[];
    resolution_type_counts: PromptCountRow[];
    inspection_result_counts: PromptCountRow[];
    inspection_comment_samples: PromptCountRow[];
  };
  shopee_summary: {
    platform_counts: PromptCountRow[];
    shipping_method_counts: PromptCountRow[];
    return_reason_counts: PromptCountRow[];
    buyer_note_samples: PromptCountRow[];
    return_reason_note_samples: PromptCountRow[];
    admin_note_samples: PromptCountRow[];
  };
  pickup_summary: {
    platform_counts: PromptCountRow[];
    logistics_provider_counts: PromptCountRow[];
    delivery_status_counts: PromptCountRow[];
    received_status_counts: PromptCountRow[];
    note_samples: PromptCountRow[];
  };
  sku_groups: Array<{
    sku_group: string;
    product_name: string;
    return_count: number;
    channels: string[];
    reason_texts: string[];
    buyer_note_texts: string[];
    return_reason_note_texts: string[];
    variants: Array<{
      product_name: string;
      sku: string;
      return_count: number;
      channels: string[];
      reason_texts: string[];
      buyer_note_texts: string[];
      return_reason_note_texts: string[];
    }>;
  }>;
}

export interface AIAnalysisPromptStorageSnapshot {
  version: 2;
  mode: 'text-only-summary';
  prompt_template_version: string;
  payload_fingerprint: string;
  period: string;
  prompt_character_count: number;
  model_candidates: string[];
  dataset_counts: AIAnalysisPromptPayload['dataset_counts'];
  official_summary: AIAnalysisPromptPayload['official_summary'];
  shopee_summary: AIAnalysisPromptPayload['shopee_summary'];
  pickup_summary: AIAnalysisPromptPayload['pickup_summary'];
  sku_group_overview: Array<{
    sku_group: string;
    product_name: string;
    return_count: number;
    variant_count: number;
    channels: string[];
    reason_sample_count: number;
    buyer_note_sample_count: number;
    return_reason_note_sample_count: number;
  }>;
}

export interface AIAnalysisResponseSnapshot {
  version: 1;
  mode: 'text-only-summary';
  model: string;
  usage_metadata: Record<string, unknown> | null;
  response_character_count: number;
  text: string;
}

const DEFAULT_COUNT_LIMIT = 10;
const DEFAULT_SAMPLE_LIMIT = 8;
const MAX_TEXT_LENGTH = 80;
export const AI_ANALYSIS_PROMPT_TEMPLATE_VERSION = 'text-only-summary-v2';

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return normalized.length > MAX_TEXT_LENGTH
    ? `${normalized.slice(0, MAX_TEXT_LENGTH - 3)}...`
    : normalized;
}

function countTopValues(
  values: Array<string | null | undefined>,
  limit = DEFAULT_COUNT_LIMIT
): PromptCountRow[] {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = normalizeValue(value);
    if (!normalized) return;

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'zh-Hant');
    })
    .slice(0, limit);
}

function limitTextRows(rows: PromptCountRow[], limit = DEFAULT_SAMPLE_LIMIT): PromptCountRow[] {
  return rows.slice(0, limit);
}

export function buildAIAnalysisDatasetFingerprint(
  payload: AIAnalysisPromptPayload
): string {
  return createHash('sha256')
    .update(AI_ANALYSIS_PROMPT_TEMPLATE_VERSION)
    .update('\n')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function buildAIAnalysisPromptPayload(params: {
  period: string;
  returns: PromptReturnAnalysisData[];
  shopeeReturns: PromptShopeeReturnData[];
  pickupRecords: PromptPickupRecordData[];
  skuGroups: AISkuAnalysisGroupInput[];
}): AIAnalysisPromptPayload {
  const { period, returns, shopeeReturns, pickupRecords, skuGroups } = params;

  return {
    period,
    dataset_counts: {
      official_returns: returns.length,
      shopee_returns: shopeeReturns.length,
      pickup_records: pickupRecords.length,
      total_rows: returns.length + shopeeReturns.length + pickupRecords.length,
    },
    official_summary: {
      channel_counts: countTopValues(returns.map((row) => row.channel_source), 6),
      reason_category_counts: countTopValues(returns.map((row) => row.reason_category), 10),
      reason_detail_counts: countTopValues(returns.map((row) => row.reason_detail), 12),
      item_reason_counts: countTopValues(
        returns.flatMap((row) => (row.return_items || []).map((item) => item.reason)),
        12
      ),
      refund_type_counts: countTopValues(returns.map((row) => row.refund_type), 6),
      resolution_type_counts: countTopValues(
        returns.flatMap((row) => (row.return_items || []).map((item) => item.resolution_type || null)),
        6
      ),
      inspection_result_counts: countTopValues(
        returns.map((row) => row.inspection_records?.[0]?.result ?? null),
        6
      ),
      inspection_comment_samples: limitTextRows(
        countTopValues(
          returns.map((row) => row.inspection_records?.[0]?.inspector_comment ?? null),
          DEFAULT_SAMPLE_LIMIT
        )
      ),
    },
    shopee_summary: {
      platform_counts: countTopValues(shopeeReturns.map((row) => row.platform), 4),
      shipping_method_counts: countTopValues(shopeeReturns.map((row) => row.shipping_method), 8),
      return_reason_counts: countTopValues(shopeeReturns.map((row) => row.return_reason), 12),
      buyer_note_samples: limitTextRows(
        countTopValues(shopeeReturns.map((row) => row.buyer_note), DEFAULT_SAMPLE_LIMIT)
      ),
      return_reason_note_samples: limitTextRows(
        countTopValues(shopeeReturns.map((row) => row.return_reason_note), DEFAULT_SAMPLE_LIMIT)
      ),
      admin_note_samples: limitTextRows(
        countTopValues(shopeeReturns.map((row) => row.note), DEFAULT_SAMPLE_LIMIT)
      ),
    },
    pickup_summary: {
      platform_counts: countTopValues(pickupRecords.map((row) => row.platform), 4),
      logistics_provider_counts: countTopValues(
        pickupRecords.map((row) => row.logistics_provider),
        6
      ),
      delivery_status_counts: countTopValues(pickupRecords.map((row) => row.delivery_status), 8),
      received_status_counts: countTopValues(pickupRecords.map((row) => row.received_status), 8),
      note_samples: limitTextRows(
        countTopValues(pickupRecords.map((row) => row.notes), DEFAULT_SAMPLE_LIMIT)
      ),
    },
    sku_groups: skuGroups.map((group) => ({
      sku_group: group.sku_group,
      product_name: group.product_name,
      return_count: group.return_count,
      channels: group.channels,
      reason_texts: group.reason_texts.slice(0, 4),
      buyer_note_texts: group.buyer_note_texts.slice(0, 4),
      return_reason_note_texts: group.return_reason_note_texts.slice(0, 4),
      variants: group.variants.slice(0, 6).map((variant) => ({
        product_name: variant.product_name,
        sku: variant.sku,
        return_count: variant.return_count,
        channels: variant.channels,
        reason_texts: variant.reason_texts.slice(0, 4),
        buyer_note_texts: variant.buyer_note_texts.slice(0, 4),
        return_reason_note_texts: variant.return_reason_note_texts.slice(0, 4),
      })),
    })),
  };
}

export function buildTextOnlyAIAnalysisPrompt(payload: AIAnalysisPromptPayload): string {
  return [
    `You are a returns analyst. Analyze only the text data for ${payload.period}.`,
    'No images are provided. Do not infer from images.',
    'Reply in Traditional Chinese.',
    'Return strict JSON only with keys: summary, pain_points, recommendations, sku_analysis, channel_analysis.',
    'sku_analysis must follow the provided sku_groups exactly, keep the same order, keep the same sku_group and return_count, and provide group-level plus variant-level issues/suggestions.',
    'Use these text sources when reasoning: official return reason_category/reason_detail/item reason; shopee return_reason/buyer_note/return_reason_note; pickup logistics statuses/notes.',
    'channel_analysis.return_count must reflect actual counts across official returns and shopee returns.',
    'Payload:',
    JSON.stringify(payload),
  ].join('\n');
}

export function buildAIAnalysisPromptStorageSnapshot(params: {
  period: string;
  prompt: string;
  payload: AIAnalysisPromptPayload;
  modelCandidates: string[];
}): AIAnalysisPromptStorageSnapshot {
  const { period, prompt, payload, modelCandidates } = params;

  return {
    version: 2,
    mode: 'text-only-summary',
    prompt_template_version: AI_ANALYSIS_PROMPT_TEMPLATE_VERSION,
    payload_fingerprint: buildAIAnalysisDatasetFingerprint(payload),
    period,
    prompt_character_count: prompt.length,
    model_candidates: modelCandidates,
    dataset_counts: payload.dataset_counts,
    official_summary: payload.official_summary,
    shopee_summary: payload.shopee_summary,
    pickup_summary: payload.pickup_summary,
    sku_group_overview: payload.sku_groups.map((group) => ({
      sku_group: group.sku_group,
      product_name: group.product_name,
      return_count: group.return_count,
      variant_count: group.variants.length,
      channels: group.channels,
      reason_sample_count: group.reason_texts.length,
      buyer_note_sample_count: group.buyer_note_texts.length,
      return_reason_note_sample_count: group.return_reason_note_texts.length,
    })),
  };
}

export function buildAIAnalysisResponseSnapshot(params: {
  model: string;
  text: string;
  usageMetadata?: Record<string, unknown> | null;
}): AIAnalysisResponseSnapshot {
  const { model, text, usageMetadata = null } = params;

  return {
    version: 1,
    mode: 'text-only-summary',
    model,
    usage_metadata: usageMetadata,
    response_character_count: text.length,
    text,
  };
}
