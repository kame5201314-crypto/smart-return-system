'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  ADMIN_UUID,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/auth/admin-session';
import { getConfiguredAdminUsername, isAdminLoginId } from '@/lib/auth/admin-login';
import {
  buildAdminLoginRateLimitKey,
  checkAdminLoginRateLimit,
  getClientIpFromHeaders,
  recordAdminLoginFailure,
  recordAdminLoginSuccess,
} from '@/lib/auth/admin-login-rate-limit';
import { getPostLoginRedirect, type PostLoginRedirectPath } from '@/lib/auth/post-login-redirect';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { normalizeTaiwanPhoneIdentifier } from '@/lib/auth/verified-signup';

// Defensive trim: Vercel env values can accidentally include trailing newlines.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

export interface AuthResult {
  success: boolean;
  error?: string;
  redirectTo?: PostLoginRedirectPath;
}

export async function signIn(
  identifier: string,
  password: string,
  requestedPath?: string,
  captchaToken?: string
): Promise<AuthResult> {
  try {
    const normalizedLoginId = identifier.trim().toLowerCase();

    if (isAdminLoginId(normalizedLoginId)) {
      const requestHeaders = await headers();
      const rateLimitKey = buildAdminLoginRateLimitKey({
        loginId: normalizedLoginId,
        clientIp: getClientIpFromHeaders(requestHeaders),
      });
      const rateLimit = checkAdminLoginRateLimit(rateLimitKey);
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: `Too many admin login attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        };
      }

      if (!ADMIN_PASSWORD) {
        return {
          success: false,
          error: 'Admin password is not configured',
        };
      }

      if (password !== ADMIN_PASSWORD) {
        recordAdminLoginFailure(rateLimitKey);
        return {
          success: false,
          error: 'Invalid password',
        };
      }

      const cookieStore = await cookies();
      const sessionToken = await createAdminSessionToken(getConfiguredAdminUsername());
      cookieStore.set(ADMIN_SESSION_COOKIE, sessionToken, ADMIN_SESSION_COOKIE_OPTIONS);
      recordAdminLoginSuccess(rateLimitKey);

      revalidatePath('/', 'layout');
      return {
        success: true,
        redirectTo: getPostLoginRedirect({
          isAdmin: true,
          requestedPath,
        }),
      };
    }

    const isEmail = normalizedLoginId.includes('@');
    let phone: string | null = null;
    if (!isEmail) {
      try {
        phone = normalizeTaiwanPhoneIdentifier(normalizedLoginId);
      } catch {
        return { success: false, error: '請輸入電子信箱、台灣手機號碼或管理員帳號' };
      }
    }

    const supabase = await createClient();
    const { data: signInData, error } = isEmail
      ? await supabase.auth.signInWithPassword({
          email: normalizedLoginId,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        })
      : await supabase.auth.signInWithPassword({
          phone: phone!,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        });

    if (error) {
      return {
        success: false,
        error: error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : '登入失敗，請稍後再試',
      };
    }

    const isPlatformAdmin = isExplicitPlatformAdminPrincipal({
      userId: signInData.user?.id ?? null,
      userEmail: signInData.user?.email ?? (isEmail ? normalizedLoginId : null),
    });

    revalidatePath('/', 'layout');
    return {
      success: true,
      redirectTo: getPostLoginRedirect({
        isAdmin: isPlatformAdmin,
        requestedPath,
      }),
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
