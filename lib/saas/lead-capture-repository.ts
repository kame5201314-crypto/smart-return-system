import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { SaaSLeadAttribution, SaaSPublicLeadInput } from '@/lib/saas/lead-capture';

interface SupabaseQueryError {
  message?: string;
}

interface SupabaseInsertResult {
  data: unknown;
  error: SupabaseQueryError | null;
}

interface SupabaseInsertQuery {
  select(columns: string): {
    single(): PromiseLike<SupabaseInsertResult>;
  };
}

export interface PublicLeadQueryClient {
  from(table: string): {
    insert(values: Record<string, unknown>): SupabaseInsertQuery;
  };
}

export interface SaaSPublicLeadRepository {
  createLead(input: SaaSPublicLeadInput): Promise<{ id: string | null }>;
}

function compactRecord(values: SaaSLeadAttribution): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

export function buildSaaSPublicLeadInsert(
  input: SaaSPublicLeadInput
): Record<string, unknown> {
  return {
    company_name: input.companyName,
    contact_name: input.contactName,
    email: input.email ?? null,
    line_id: input.lineId ?? null,
    phone: input.phone ?? null,
    preferred_contact_channel: input.preferredContactChannel,
    plan: input.requestedPlan,
    monthly_return_volume: null,
    monthly_return_band: input.monthlyReturnBand,
    message: input.painPoint ?? null,
    status: 'pending',
    source: 'public_lead',
    metadata: {
      platform: input.platform ?? null,
      privacyConsent: true,
      privacyConsentVersion: '2026-07-14',
      attribution: compactRecord(input.attribution),
    },
  };
}

function normalizeInsertedId(data: unknown): string | null {
  if (!isRecord(data)) return null;
  return typeof data.id === 'string' && data.id.trim() ? data.id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSaaSPublicLeadRepository(
  client: PublicLeadQueryClient
): SaaSPublicLeadRepository {
  return {
    async createLead(input) {
      const { data, error } = await client
        .from('signup_requests')
        .insert(buildSaaSPublicLeadInsert(input))
        .select('id')
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to create public lead.');
      }
      return { id: normalizeInsertedId(data) };
    },
  };
}

export function createDefaultSaaSPublicLeadRepository() {
  return createSaaSPublicLeadRepository(createUntypedAdminClient());
}
