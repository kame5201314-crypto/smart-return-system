import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { assertDeploymentSafety } from '@/lib/config/deployment-safety';

/**
 * Admin client with service role key
 * ONLY use in server-side code (API routes, Server Actions)
 * NEVER expose to client-side
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\\n/g, '').trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\\n/g, '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  assertDeploymentSafety();

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Untyped admin client for tables not in generated types
 * Use this for shopee_returns and other dynamic tables
 */
export function createUntypedAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\\n/g, '').trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\\n/g, '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  assertDeploymentSafety();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });
}
