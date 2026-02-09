import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/admin-session';

export async function isAuthenticatedRequest(request: NextRequest): Promise<boolean> {
  const adminSessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await verifyAdminSessionToken(adminSessionToken)) {
    return true;
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && !!user;
  } catch {
    return false;
  }
}
