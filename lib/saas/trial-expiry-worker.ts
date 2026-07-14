import { resolveSaaSSubscriptionTimedStatus } from '@/lib/saas/subscription-lifecycle';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

export interface TrialExpiryCandidate {
  subscriptionId: string;
  orgId: string;
  status: 'trialing';
  trialEnd: string;
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
}

export interface TrialExpiryRunResult {
  checkedAt: string;
  summary: {
    scanned: number;
    suspended: number;
    skipped: number;
    failed: number;
  };
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
  if (!subscriptionId || !orgId || !trialEnd || value.status !== 'trialing') return null;
  return { subscriptionId, orgId, status: 'trialing', trialEnd };
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

export function createTrialExpiryRepository(client: TrialExpiryClient): TrialExpiryRepository {
  return {
    async listExpiredTrials(input) {
      const { data, error } = await client
        .from('subscriptions')
        .select('id, org_id, status, trial_end')
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
  };
}

export function createDefaultTrialExpiryRepository(): TrialExpiryRepository {
  return createTrialExpiryRepository(createUntypedAdminClient() as unknown as TrialExpiryClient);
}

export async function runScopedTrialExpiry(
  repository: TrialExpiryRepository,
  options: { now?: Date; limit?: number } = {}
): Promise<TrialExpiryRunResult> {
  const now = options.now ?? new Date();
  const checkedAt = now.toISOString();
  const candidates = await repository.listExpiredTrials({
    now: checkedAt,
    limit: normalizeLimit(options.limit ?? 50),
  });
  const results: TrialExpiryRunResult['results'] = [];

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
      results.push({
        changed: false,
        orgId: candidate.orgId,
        subscriptionId: candidate.subscriptionId,
        auditLogId: null,
        reason: 'not_expired_trial',
      });
      continue;
    }

    try {
      results.push(
        await repository.suspendExpiredTrial({
          orgId: candidate.orgId,
          effectiveAt: lifecycle.effectiveAt,
        })
      );
    } catch (error) {
      results.push({
        changed: false,
        orgId: candidate.orgId,
        subscriptionId: candidate.subscriptionId,
        auditLogId: null,
        reason: 'operation_failed',
        error: error instanceof Error ? error.message : 'Unknown trial expiry failure.',
      });
    }
  }

  return {
    checkedAt,
    summary: {
      scanned: candidates.length,
      suspended: results.filter((result) => result.changed).length,
      skipped: results.filter((result) => !result.changed && !result.error).length,
      failed: results.filter((result) => Boolean(result.error)).length,
    },
    results,
  };
}
