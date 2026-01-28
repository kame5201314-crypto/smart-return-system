'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// Simple admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'mefu888';
// Fixed UUID for admin user (for database foreign key compatibility)
const ADMIN_UUID = '00000000-0000-0000-0000-000000000001';

export interface AuthResult {
  success: boolean;
  error?: string;
}

// 管理員登入
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    // Trim inputs to avoid whitespace issues
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Check for simple admin login first (case-insensitive username)
    if (trimmedEmail === ADMIN_USERNAME.toLowerCase() && trimmedPassword === ADMIN_PASSWORD) {
      // Set admin session cookie
      const cookieStore = await cookies();
      cookieStore.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      revalidatePath('/', 'layout');
      return { success: true };
    }

    // If username is 'admin' but password is wrong
    if (trimmedEmail === ADMIN_USERNAME.toLowerCase()) {
      return {
        success: false,
        error: '密碼錯誤',
      };
    }

    // Fallback to Supabase auth for email login (only if it looks like an email)
    if (!trimmedEmail.includes('@')) {
      return {
        success: false,
        error: '帳號或密碼錯誤',
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
          ? '帳號或密碼錯誤'
          : error.message,
      };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    console.error('Login error:', err);
    return {
      success: false,
      error: '登入失敗，請稍後再試',
    };
  }
}

// 管理員登出
export async function signOut(): Promise<void> {
  // Clear admin session cookie
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');

  // Also sign out from Supabase
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}

// 取得當前使用者
export async function getCurrentUser() {
  // Check for admin session first
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');

  if (adminSession?.value === 'authenticated') {
    return {
      id: ADMIN_UUID,
      email: 'admin@system.local',
      name: '管理員',
      role: 'admin',
      orgId: undefined,
    };
  }

  // Fallback to Supabase auth
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // 查詢使用者詳細資訊
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
    name: userProfile?.name || user.email?.split('@')[0] || '使用者',
    role: userProfile?.role || 'staff',
    orgId: userProfile?.org_id,
  };
}

// 檢查是否已登入
export async function checkAuth(): Promise<boolean> {
  // Check for admin session first
  const cookieStore = await cookies();
  const adminSession = cookieStore.get('admin_session');

  if (adminSession?.value === 'authenticated') {
    return true;
  }

  // Fallback to Supabase auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

// 重設密碼請求
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    return {
      success: false,
      error: '發送重設密碼郵件失敗，請稍後再試',
    };
  }

  return { success: true };
}
