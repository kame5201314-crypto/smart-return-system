import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { ADMIN_SESSION_COOKIE, ADMIN_UUID, verifyAdminSessionToken } from '@/lib/auth/admin-session';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';

export interface RouteAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
  userEmail?: string;
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
      userEmail: undefined,
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
      userEmail: userEmail ?? undefined,
      isAdmin: false,
    };
  }

  if (
    isExplicitPlatformAdminPrincipal({
      userId,
      userEmail,
    })
  ) {
    return {
      ok: true,
      status: 200,
      userId: userId ?? undefined,
      userEmail: userEmail ?? undefined,
      isAdmin: true,
    };
  }

  return {
    ok: false,
    status: 403,
    error: 'Forbidden',
    isAdmin: false,
  };
}
