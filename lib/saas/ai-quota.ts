import type { SaaSOrgContext } from '@/lib/saas/org-context';

export const RETURN_AI_ANALYSIS_FEATURE = 'return_ai_analysis';

export interface AIUsageWindow {
  periodStartIso: string;
  periodEndIso: string;
}

export interface AIQuotaDecision {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  periodStartIso: string;
  periodEndIso: string;
  reason: 'feature_disabled' | 'unlimited' | 'within_limit' | 'limit_reached';
}

export interface AIQuotaQueryError {
  message?: string;
}

export interface AIQuotaQueryResult {
  data?: unknown;
  count?: number | null;
  error: AIQuotaQueryError | null;
}

export interface AIQuotaFromBuilder {
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): AIQuotaFilterBuilder;
}

export interface AIQuotaFilterBuilder {
  eq(column: string, value: unknown): AIQuotaQueryBuilder;
  gte(column: string, value: string): AIQuotaQueryBuilder;
  lt(column: string, value: string): AIQuotaQueryBuilder;
}

export interface AIQuotaQueryBuilder extends AIQuotaFilterBuilder {
  then<TResult1 = AIQuotaQueryResult, TResult2 = never>(
    onfulfilled?: ((value: AIQuotaQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

export interface AIQuotaQueryClient {
  from(table: string): AIQuotaFromBuilder;
}

export class SaaSAIQuotaError extends Error {
  readonly code = 'ai_quota_exceeded';
  readonly status = 402;
  readonly decision: AIQuotaDecision;

  constructor(decision: AIQuotaDecision) {
    super('Monthly AI usage limit has been reached for this organization.');
    this.name = 'SaaSAIQuotaError';
    this.decision = decision;
  }
}

export function buildCurrentAIUsageWindow(now = new Date()): AIUsageWindow {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStartIso: periodStart.toISOString(),
    periodEndIso: periodEnd.toISOString(),
  };
}

export function shouldCountAIUsageEvent(input: {
  cached?: boolean | null;
  success?: boolean | null;
}): boolean {
  return input.cached !== true && input.success !== false;
}

export function resolveAIQuotaDecision(input: {
  context: Pick<SaaSOrgContext, 'featureFlags' | 'planDefinition'>;
  used: number;
  window?: AIUsageWindow;
}): AIQuotaDecision {
  const window = input.window ?? buildCurrentAIUsageWindow();
  const used = Math.max(0, Math.floor(input.used));

  if (!input.context.featureFlags.ai_usage_limit) {
    return {
      allowed: true,
      limit: null,
      used,
      remaining: null,
      ...window,
      reason: 'feature_disabled',
    };
  }

  const limit = input.context.planDefinition.aiMonthlyLimit;
  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      used,
      remaining: null,
      ...window,
      reason: 'unlimited',
    };
  }

  const remaining = Math.max(limit - used, 0);
  return {
    allowed: used < limit,
    limit,
    used,
    remaining,
    ...window,
    reason: used < limit ? 'within_limit' : 'limit_reached',
  };
}

export async function getMonthlyAIUsageCount(input: {
  client: AIQuotaQueryClient;
  orgId: string;
  window?: AIUsageWindow;
}): Promise<number> {
  const window = input.window ?? buildCurrentAIUsageWindow();
  const { data, count, error } = await input.client
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', input.orgId)
    .eq('feature', RETURN_AI_ANALYSIS_FEATURE)
    .eq('cached', false)
    .eq('success', true)
    .gte('created_at', window.periodStartIso)
    .lt('created_at', window.periodEndIso);

  if (error) {
    throw new Error(error.message || 'Failed to load monthly AI usage.');
  }

  if (typeof count === 'number' && Number.isFinite(count)) {
    return Math.max(0, Math.floor(count));
  }

  return Array.isArray(data) ? data.length : 0;
}

export async function assertAIQuotaAvailable(input: {
  client: AIQuotaQueryClient;
  context: SaaSOrgContext;
  window?: AIUsageWindow;
}): Promise<AIQuotaDecision> {
  const window = input.window ?? buildCurrentAIUsageWindow();
  const used = await getMonthlyAIUsageCount({
    client: input.client,
    orgId: input.context.orgId,
    window,
  });
  const decision = resolveAIQuotaDecision({
    context: input.context,
    used,
    window,
  });

  if (!decision.allowed) {
    throw new SaaSAIQuotaError(decision);
  }

  return decision;
}
