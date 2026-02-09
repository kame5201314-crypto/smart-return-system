import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_SESSION_COOKIE, ADMIN_UUID, verifyAdminSessionToken } from '@/lib/auth/admin-session';

export interface RouteAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
  isAdmin: boolean;
}

export async function requireRouteAuth(options?: { requireAdmin?: boolean }): Promise<RouteAuthResult> {
  const requireAdmin = options?.requireAdmin ?? false;

  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const adminSession = await verifyAdminSessionToken(adminToken);

  if (adminSession) {
    return {
      ok: true,
      status: 200,
      userId: ADMIN_UUID,
      isAdmin: true,
    };
  }

  let userId: string | null = null;
  let userEmail: string | null = null;

  try {
    const authClient = await createClient();
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser();

    if (error || !user) {
      return {
        ok: false,
        status: 401,
        error: 'Unauthorized',
        isAdmin: false,
      };
    }

    userId = user.id;
    userEmail = user.email ?? null;
  } catch {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
      isAdmin: false,
    };
  }

  if (!requireAdmin) {
    return {
      ok: true,
      status: 200,
      userId: userId ?? undefined,
      isAdmin: false,
    };
  }

  try {
    const adminClient = createAdminClient();

    const { data: byId, error: byIdError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (byIdError) {
      console.error('Role check by id failed:', byIdError);
    }

    let role = (byId as { role?: string } | null)?.role ?? null;

    if (!role && userEmail) {
      const { data: byEmail, error: byEmailError } = await adminClient
        .from('users')
        .select('role')
        .eq('email', userEmail)
        .maybeSingle();

      if (byEmailError) {
        console.error('Role check by email failed:', byEmailError);
      }

      role = (byEmail as { role?: string } | null)?.role ?? null;
    }

    if (role === 'admin') {
      return {
        ok: true,
        status: 200,
        userId: userId ?? undefined,
        isAdmin: true,
      };
    }
  } catch (error) {
    console.error('Admin role check failed:', error);
  }

  return {
    ok: false,
    status: 403,
    error: 'Forbidden',
    isAdmin: false,
  };
}