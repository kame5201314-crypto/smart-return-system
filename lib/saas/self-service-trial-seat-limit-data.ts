import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { SelfServiceTrialSeatLimitRepository } from '@/lib/saas/self-service-trial-seat-limit';

interface TrialClaimQueryError {
  message?: string;
}

interface TrialClaimQueryResult {
  data: unknown;
  error: TrialClaimQueryError | null;
}

interface TrialClaimQueryBuilder extends PromiseLike<TrialClaimQueryResult> {
  select(columns: string): TrialClaimQueryBuilder;
  eq(column: string, value: unknown): TrialClaimQueryBuilder;
  maybeSingle(): PromiseLike<TrialClaimQueryResult>;
}

export interface SelfServiceTrialSeatLimitQueryClient {
  from(table: string): TrialClaimQueryBuilder;
}

/**
 * Service-role reads for trial claims live behind this narrow, read-only
 * repository. Callers must supply an organization id that was already
 * resolved from authenticated organization context.
 */
export function createSelfServiceTrialSeatLimitDataRepository(
  client: SelfServiceTrialSeatLimitQueryClient
): SelfServiceTrialSeatLimitRepository {
  return {
    async hasSelfServiceTrialClaim(orgId) {
      const { data, error } = await client
        .from('saas_self_service_trial_claims')
        .select('org_id')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || 'Failed to load trial claim.');
      }

      return Boolean(data);
    },
  };
}

export function createDefaultSelfServiceTrialSeatLimitDataRepository(): SelfServiceTrialSeatLimitRepository {
  return createSelfServiceTrialSeatLimitDataRepository(
    createUntypedAdminClient() as unknown as SelfServiceTrialSeatLimitQueryClient
  );
}
