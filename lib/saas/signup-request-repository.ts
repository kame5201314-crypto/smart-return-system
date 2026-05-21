import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type {
  SaaSPublicSignupRequestInput,
  SaaSPublicSignupRequestRepository,
} from '@/lib/saas/signup-request';

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

export interface SignupRequestQueryClient {
  from(table: string): {
    insert(values: Record<string, unknown>): SupabaseInsertQuery;
  };
}

export function buildSaaSPublicSignupRequestInsert(
  input: SaaSPublicSignupRequestInput
): Record<string, unknown> {
  return {
    company_name: input.companyName,
    contact_name: input.contactName,
    email: input.email,
    phone: input.phone ?? null,
    plan: input.plan,
    monthly_return_volume: input.monthlyReturnVolume ?? null,
    message: input.message ?? null,
    status: 'pending',
    source: 'public_signup',
  };
}

function normalizeInsertedId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }

  const id = (data as Record<string, unknown>).id;
  return typeof id === 'string' && id.trim() ? id : null;
}

export function createSaaSPublicSignupRequestRepository(
  client: SignupRequestQueryClient
): SaaSPublicSignupRequestRepository {
  return {
    async createRequest(input) {
      const { data, error } = await client
        .from('signup_requests')
        .insert(buildSaaSPublicSignupRequestInsert(input))
        .select('id')
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to create public signup request.');
      }

      return {
        id: normalizeInsertedId(data),
      };
    },
  };
}

export function createDefaultSaaSPublicSignupRequestRepository() {
  return createSaaSPublicSignupRequestRepository(createUntypedAdminClient());
}
