export interface AIUsageSummary {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface AIUsageEventInput {
  feature: 'return_ai_analysis';
  reportPeriod?: string | null;
  model: string;
  requestFingerprint?: string | null;
  cached?: boolean;
  success?: boolean;
  usageMetadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

function toTokenCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sumUsage(a: AIUsageSummary, b: AIUsageSummary): AIUsageSummary {
  return {
    promptTokenCount: a.promptTokenCount + b.promptTokenCount,
    candidatesTokenCount: a.candidatesTokenCount + b.candidatesTokenCount,
    totalTokenCount: a.totalTokenCount + b.totalTokenCount,
  };
}

export function summarizeAIUsageMetadata(metadata: unknown): AIUsageSummary {
  if (!isRecord(metadata)) {
    return {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    };
  }

  const directUsage: AIUsageSummary = {
    promptTokenCount: toTokenCount(
      metadata.promptTokenCount ?? metadata.prompt_token_count
    ),
    candidatesTokenCount: toTokenCount(
      metadata.candidatesTokenCount ?? metadata.candidates_token_count
    ),
    totalTokenCount: toTokenCount(
      metadata.totalTokenCount ?? metadata.total_token_count
    ),
  };

  const nestedUsage = ['primary', 'repair'].reduce<AIUsageSummary>(
    (summary, key) => sumUsage(summary, summarizeAIUsageMetadata(metadata[key])),
    {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    }
  );

  return sumUsage(directUsage, nestedUsage);
}

export function buildAIUsageEventRecord(input: AIUsageEventInput) {
  const usageSummary = summarizeAIUsageMetadata(input.usageMetadata);

  return {
    feature: input.feature,
    report_period: input.reportPeriod || null,
    model: input.model,
    request_fingerprint: input.requestFingerprint || null,
    cached: input.cached ?? false,
    success: input.success ?? true,
    prompt_token_count: usageSummary.promptTokenCount,
    candidates_token_count: usageSummary.candidatesTokenCount,
    total_token_count: usageSummary.totalTokenCount,
    metadata: {
      ...(input.metadata || {}),
      usage_metadata: input.usageMetadata || null,
    },
  };
}
