'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export interface AuthResult {
  success: boolean;
  error?: string;
}

// 管理員登入
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
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
}

// 管理員登出
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// 取得當前使用者
export async function getCurrentUser() {
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
