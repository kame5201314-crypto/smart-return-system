'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/auth/admin-session';

// Fixed UUID for admin user (for database foreign key compatibility)
const ADMIN_UUID = '00000000-0000-0000-0000-000000000001';

export interface AuthResult {
  success: boolean;
  error?: string;
}

function getAdminCredentials() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  return {
    username,
    password,
  };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const adminCredentials = getAdminCredentials();

    if (adminCredentials.username && trimmedEmail === adminCredentials.username) {
      if (!adminCredentials.password) {
        return {
          success: false,
          error: 'Admin credentials are not fully configured',
        };
      }

      if (trimmedPassword !== adminCredentials.password) {
        return {
          success: false,
          error: 'Invalid password',
        };
      }

      const sessionToken = await createAdminSessionToken();
      if (!sessionToken) {
        return {
          success: false,
          error: 'Admin session secret is not configured',
        };
      }

      const cookieStore = await cookies();
      cookieStore.set(ADMIN_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
        path: '/',
      });

      revalidatePath('/', 'layout');
      return { success: true };
    }

    if (!trimmedEmail.includes('@')) {
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message === 'Invalid login credentials'
          ? 'Invalid email or password'
          : error.message,
      };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    console.error('Login error:', err);
    return {
      success: false,
      error: 'Login failed. Please try again.',
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
  const adminSession = cookieStore.get(ADMIN_SESSION_COOKIE);
  const isAdminAuthenticated = await verifyAdminSessionToken(adminSession?.value);

  if (isAdminAuthenticated) {
    return {
      id: ADMIN_UUID,
      email: 'admin@system.local',
      name: 'Administrator',
      role: 'admin',
      orgId: undefined,
    };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

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
  const adminSession = cookieStore.get(ADMIN_SESSION_COOKIE);
  const isAdminAuthenticated = await verifyAdminSessionToken(adminSession?.value);

  if (isAdminAuthenticated) {
    return true;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      error: 'Failed to send reset email. Please try again later.',
    };
  }

  return { success: true };
}
