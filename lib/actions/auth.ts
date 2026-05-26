'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  ADMIN_UUID,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/auth/admin-session';
import { getConfiguredAdminUsername, isAdminLoginId } from '@/lib/auth/admin-login';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPostLoginRedirect, type PostLoginRedirectPath } from '@/lib/auth/post-login-redirect';

// Defensive trim: Vercel env values can accidentally include trailing newlines.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

export interface AuthResult {
  success: boolean;
  error?: string;
  redirectTo?: PostLoginRedirectPath;
}

async function loadUserProfileRoleForRedirect(userId: string | null, email: string): Promise<string | null> {
  try {
    const adminClient = createAdminClient();

    if (userId) {
      const { data, error } = await adminClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Post-login role check by id failed:', error);
      }

      const role = (data as { role?: string } | null)?.role ?? null;
      if (role) {
        return role;
      }
    }

    const { data, error } = await adminClient
      .from('users')
      .select('role')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Post-login role check by email failed:', error);
    }

    return (data as { role?: string } | null)?.role ?? null;
  } catch (error) {
    console.error('Post-login role check failed:', error);
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (isAdminLoginId(trimmedEmail)) {
      if (!ADMIN_PASSWORD) {
        return {
          success: false,
          error: 'Admin password is not configured',
        };
      }

      if (trimmedPassword !== ADMIN_PASSWORD) {
        return {
          success: false,
          error: 'Invalid password',
        };
      }

      const cookieStore = await cookies();
      const sessionToken = await createAdminSessionToken(getConfiguredAdminUsername());
      cookieStore.set(ADMIN_SESSION_COOKIE, sessionToken, ADMIN_SESSION_COOKIE_OPTIONS);

      revalidatePath('/', 'layout');
      return { success: true, redirectTo: getPostLoginRedirect({ isAdmin: true }) };
    }

    if (!trimmedEmail.includes('@')) {
      return {
        success: false,
        error: 'Please use email or configured admin username',
      };
    }

    const supabase = await createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message === 'Invalid login credentials' ? 'Invalid login credentials' : error.message,
      };
    }

    const profileRole = await loadUserProfileRoleForRedirect(signInData.user?.id ?? null, trimmedEmail);

    revalidatePath('/', 'layout');
    return {
      success: true,
      redirectTo: getPostLoginRedirect({ profileRole }),
    };
  } catch (err) {
    console.error('Login error:', err);
    return {
      success: false,
      error: 'Login failed, please try again later',
    };
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const adminSession = await verifyAdminSessionToken(adminToken);

  if (adminSession) {
    return {
      id: ADMIN_UUID,
      email: 'admin@system.local',
      name: 'Administrator',
      role: 'admin',
      orgId: undefined,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  let userProfile: { name?: string; role?: string; org_id?: string } | null = null;
  if (user.email) {
    const { data } = await supabase
      .from('users')
      .select('name, role, org_id')
      .eq('email', user.email)
      .single();
    userProfile = data as { name?: string; role?: string; org_id?: string } | null;
  }

  return {
    id: user.id,
    email: user.email,
    name: userProfile?.name || user.email?.split('@')[0] || 'User',
    role: userProfile?.role || 'staff',
    orgId: userProfile?.org_id,
  };
}

export async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (await verifyAdminSessionToken(adminToken)) {
    return true;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    return {
      success: false,
      error: 'Failed to send password reset email',
    };
  }

  return { success: true };
}
