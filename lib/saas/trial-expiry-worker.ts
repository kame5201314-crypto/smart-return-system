import { resolveSaaSSubscriptionTimedStatus } from '@/lib/saas/subscription-lifecycle';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export interface TrialExpiryCandidate {
  subscriptionId: string;
  orgId: string;
  status: 'trialing';
  trialEnd: string;
}

export interface PaidPeriodExpiryCandidate {
  subscriptionId: string;
  orgId: string;
  status: 'active';
  provider: 'ecpay' | 'manual';
  currentPeriodEnd: string;
}

export interface TrialExpirySuspensionResult {
  changed: boolean;
  orgId: string;
  subscriptionId: string | null;
  auditLogId: string | null;
  reason: string;
}

export interface TrialExpiryRepository {
  listExpiredTrials(input: { now: string; limit: number }): Promise<TrialExpiryCandidate[]>;
  suspendExpiredTrial(input: {
    orgId: string;
    effectiveAt: string;
  }): Promise<TrialExpirySuspensionResult>;
  listExpiredPaidSubscriptions?(input: {
    now: string;
    limit: number;
  }): Promise<PaidPeriodExpiryCandidate[]>;
  suspendExpiredPaidSubscription?(input: {
    orgId: string;
    effectiveAt: string;
  }): Promise<TrialExpirySuspensionResult>;
}

interface ExpirySummary {
  scanned: number;
  suspended: number;
  skipped: number;
  failed: number;
}

export interface ExpiryScopeErrors {
  trials?: string;
  paidPeriods?: string;
}

export interface TrialExpiryRunResult {
  checkedAt: string;
  summary: ExpirySummary;
  scopeSummary?: {
    trials: ExpirySummary;
    paidPeriods: ExpirySummary;
  };
  scopeErrors?: ExpiryScopeErrors;
  results: Array<TrialExpirySuspensionResult & { error?: string }>;
}

interface SupabaseError {
  message?: string;
}

interface TrialExpiryQueryBuilder extends PromiseLike<{
  data: unknown;
  error: SupabaseError | null;
}> {
  select(columns: string): TrialExpiryQueryBuilder;
  eq(column: string, value: unknown): TrialExpiryQueryBuilder;
  in(column: string, values: readonly unknown[]): TrialExpiryQueryBuilder;
  lte(column: string, value: unknown): TrialExpiryQueryBuilder;
  order(column: string, options: { ascending: boolean }): TrialExpiryQueryBuilder;
  limit(count: number): TrialExpiryQueryBuilder;
}

interface TrialExpiryClient {
  from(table: string): TrialExpiryQueryBuilder;
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: SupabaseError | null }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeCandidate(value: unknown): TrialExpiryCandidate | null {
  if (!isRecord(value)) return null;
  const subscriptionId = stringOrNull(value.id);
  const orgId = stringOrNull(value.org_id);
  const trialEnd = stringOrNull(value.trial_end);
  const selfServiceOrg = isRecord(value.self_service_org) ? value.self_service_org : null;
  const selfServiceClaim = selfServiceOrg && isRecord(selfServiceOrg.self_service_claim)
    ? selfServiceOrg.self_service_claim
    : null;
  const claimedOrgId = selfServiceClaim ? stringOrNull(selfServiceClaim.org_id) : null;
  if (
    !subscriptionId ||
    !orgId ||
    !trialEnd ||
    value.status !== 'trialing' ||
    claimedOrgId !== orgId
  ) return null;
  return { subscriptionId, orgId, status: 'trialing', trialEnd };
}

function normalizePaidPeriodCandidate(value: unknown): PaidPeriodExpiryCandidate | null {
  if (!isRecord(value)) return null;
  const subscriptionId = stringOrNull(value.id);
  const orgId = stringOrNull(value.org_id);
  const currentPeriodEnd = stringOrNull(value.current_period_end);
  const provider = stringOrNull(value.provider)?.toLowerCase();
  if (
    !subscriptionId ||
    !orgId ||
    !currentPeriodEnd ||
    value.status !== 'active' ||
    (provider !== 'ecpay' && provider !== 'manual')
  ) return null;
  return {
    subscriptionId,
    orgId,
    status: 'active',
    provider,
    currentPeriodEnd,
  };
}

function normalizeSuspensionResult(value: unknown): TrialExpirySuspensionResult {
  if (!isRecord(value)) {
    throw new Error('Trial expiry RPC returned invalid data.');
  }
  const orgId = stringOrNull(value.org_id);
  if (!orgId) throw new Error('Trial expiry RPC did not return org_id.');
  return {
    changed: value.changed === true,
    orgId,
    subscriptionId: stringOrNull(value.subscription_id),
    auditLogId: stringOrNull(value.audit_log_id),
    reason: stringOrNull(value.reason) ?? 'unknown',
  };
}

function normalizeLimit(value: number): number {
  if (!Number.isInteger(value) || value <= 0) return 50;
  return Math.min(value, 500);
}

export function isTrialExpiryCronEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = (env.ENABLE_TRIAL_EXPIRY_CRON || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isPaidPeriodExpiryCronEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = (env.ENABLE_PAID_PERIOD_EXPIRY_CRON || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function createTrialExpiryRepository(client: TrialExpiryClient): TrialExpiryRepository {
  return {
    async listExpiredTrials(input) {
      const { data, error } = await client
        .from('subscriptions')
        .select(
          'id, org_id, status, trial_end, self_service_org:organizations!inner(self_service_claim:saas_self_service_trial_claims!inner(org_id))'
        )
        .eq('status', 'trialing')
        .lte('trial_end', input.now)
        .order('trial_end', { ascending: true })
        .limit(normalizeLimit(input.limit));

      if (error) throw new Error(error.message || 'Failed to load expired trials.');
      if (!Array.isArray(data)) return [];
      return data.map(normalizeCandidate).filter((row): row is TrialExpiryCandidate => row !== null);
    },

    async suspendExpiredTrial(input) {
      const { data, error } = await client.rpc('suspend_expired_trial_organization', {
        p_org_id: input.orgId,
        p_effective_at: input.effectiveAt,
      });
      if (error) throw new Error(error.message || 'Failed to suspend expired trial.');
      return normalizeSuspensionResult(data);
    },

    async listExpiredPaidSubscriptions(input) {
      const { data, error } = await client
        .from('subscriptions')
        .select('id, org_id, status, provider, current_period_end')
        .eq('status', 'active')
        .in('provider', ['ecpay', 'manual'])
        .lte('current_period_end', input.now)
        .order('current_period_end', { ascending: true })
        .limit(normalizeLimit(input.limit));

      if (error) throw new Error(error.message || 'Failed to load expired paid periods.');
      if (!Array.isArray(data)) return [];
      return data
        .map(normalizePaidPeriodCandidate)
        .filter((row): row is PaidPeriodExpiryCandidate => row !== null);
    },

    async suspendExpiredPaidSubscription(input) {
      const { data, error } = await client.rpc('suspend_expired_paid_organization', {
        p_org_id: input.orgId,
        p_effective_at: input.effectiveAt,
      });
      if (error) throw new Error(error.message || 'Failed to suspend expired paid period.');
      return normalizeSuspensionResult(data);
    },
  };
}

export function createDefaultTrialExpiryRepository(): TrialExpiryRepository {
  return createTrialExpiryRepository(createUntypedAdminClient() as unknown as TrialExpiryClient);
}

export async function runScopedTrialExpiry(
  repository: TrialExpiryRepository,
  options: {
    now?: Date;
    limit?: number;
    includeTrials?: boolean;
    includePaidPeriods?: boolean;
    paidPeriodLimit?: number;
  } = {}
): Promise<TrialExpiryRunResult> {
  const now = options.now ?? new Date();
  const checkedAt = now.toISOString();
  const includeTrials = options.includeTrials !== false;
  const includePaidPeriods = options.includePaidPeriods === true;
  if (
    includePaidPeriods
    && (
      typeof repository.listExpiredPaidSubscriptions !== 'function'
      || typeof repository.suspendExpiredPaidSubscription !== 'function'
    )
  ) {
    throw new Error('Paid period expiry repository methods are not configured.');
  }

  let candidates: TrialExpiryCandidate[] = [];
  let paidPeriodCandidates: PaidPeriodExpiryCandidate[] = [];
  const scopeErrors: ExpiryScopeErrors = {};

  if (includeTrials) {
    try {
      candidates = await repository.listExpiredTrials({
        now: checkedAt,
        limit: normalizeLimit(options.limit ?? 50),
      });
    } catch (error) {
      scopeErrors.trials = error instanceof Error
        ? error.message
        : 'Unknown trial expiry candidate query failure.';
    }
  }

  if (includePaidPeriods) {
    try {
      paidPeriodCandidates = await repository.listExpiredPaidSubscriptions!({
        now: checkedAt,
        limit: normalizeLimit(options.paidPeriodLimit ?? options.limit ?? 50),
      });
    } catch (error) {
      scopeErrors.paidPeriods = error instanceof Error
        ? error.message
        : 'Unknown paid period expiry candidate query failure.';
    }
  }
  const results: TrialExpiryRunResult['results'] = [];
  const trialResults: TrialExpiryRunResult['results'] = [];
  const paidPeriodResults: TrialExpiryRunResult['results'] = [];

  for (const candidate of candidates) {
    const lifecycle = resolveSaaSSubscriptionTimedStatus({
      status: candidate.status,
      trialEnd: candidate.trialEnd,
      now,
    });
    if (
      lifecycle.currentStatus !== 'trialing' ||
      lifecycle.nextStatus !== 'suspended' ||
      lifecycle.reason !== 'trial_expired'
    ) {
      const skippedResult = {
        changed: false,
        orgId: candidate.orgId,
        subscriptionId: candidate.subscriptionId,
        auditLogId: null,
        reason: 'not_expired_trial',
      };
      results.push(skippedResult);
      trialResults.push(skippedResult);
      continue;
    }

    try {
      const suspensionResult = await repository.suspendExpiredTrial({
        orgId: candidate.orgId,
        effectiveAt: lifecycle.effectiveAt,
      });
      results.push(suspensionResult);
      trialResults.push(suspensionResult);
    } catch (error) {
      const failedResult = {
        changed: false,
        orgId: candidate.orgId,
        subscriptionId: candidate.subscriptionId,
        auditLogId: null,
        reason: 'operation_failed',
        error: error instanceof Error ? error.message : 'Unknown trial expiry failure.',
      };
      results.push(failedResult);
      trialResults.push(failedResult);
    }
  }

  for (const candidate of paidPeriodCandidates) {
    const lifecycle = resolveSaaSSubscriptionTimedStatus({
      status: candidate.status,
      currentPeriodEnd: candidate.currentPeriodEnd,
      requiresCurrentPeriodEnd: true,
      now,
    });
    if (
      lifecycle.currentStatus !== 'active'
      || lifecycle.nextStatus !== 'suspended'
      || lifecycle.reason !== 'prepaid_period_expired'
    ) {
      const skippedResult = {
        changed: false,
        orgId: candidate.orgId,
        subscriptionId: candidate.subscriptionId,
        auditLogId: null,
        reason: 'not_expired_paid_period',
      };
      results.push(skippedResult);
      paidPeriodResults.push(skippedResult);
      continue;
    }

    try {
      const suspensionResult = await repository.suspendExpiredPaidSubscription!({
        orgId: candidate.orgId,
        effectiveAt: lifecycle.effectiveAt,
      });
      results.push(suspensionResult);
      paidPeriodResults.push(suspensionResult);
    } catch (error) {
      const failedResult = {
        changed: false,
        orgId: candidate.orgId,
        subscriptionId: candidate.subscriptionId,
        auditLogId: null,
        reason: 'operation_failed',
        error: error instanceof Error ? error.message : 'Unknown paid period expiry failure.',
      };
      results.push(failedResult);
      paidPeriodResults.push(failedResult);
    }
  }

  const summarize = (
    scanned: number,
    scopedResults: TrialExpiryRunResult['results'],
    scopeError?: string
  ): ExpirySummary => ({
    scanned,
    suspended: scopedResults.filter((result) => result.changed).length,
    skipped: scopedResults.filter((result) => !result.changed && !result.error).length,
    failed: scopedResults.filter((result) => Boolean(result.error)).length + (scopeError ? 1 : 0),
  });

  const trialSummary = summarize(candidates.length, trialResults, scopeErrors.trials);
  const paidPeriodSummary = summarize(
    paidPeriodCandidates.length,
    paidPeriodResults,
    scopeErrors.paidPeriods
  );

  return {
    checkedAt,
    summary: {
      scanned: candidates.length + paidPeriodCandidates.length,
      suspended: results.filter((result) => result.changed).length,
      skipped: results.filter((result) => !result.changed && !result.error).length,
      failed: trialSummary.failed + paidPeriodSummary.failed,
    },
    scopeSummary: {
      trials: trialSummary,
      paidPeriods: paidPeriodSummary,
    },
    ...(Object.keys(scopeErrors).length > 0 ? { scopeErrors } : {}),
    results,
  };
}
