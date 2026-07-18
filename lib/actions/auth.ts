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
import {
  createGoogleOAuthMembershipRepository,
  resolveGoogleOAuthDestination,
} from '@/lib/auth/google-oauth';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import {
  normalizeTaiwanPhoneIdentifier,
  resolveAuthCaptchaAvailability,
} from '@/lib/auth/verified-signup';
import {
  canBypassPasswordLoginTurnstileForLocalDevelopment,
  verifyPasswordLoginTurnstile,
} from '@/lib/auth/turnstile-verification';

function getConfiguredAdminPassword(): string {
  // Defensive trim: Vercel env values can accidentally include trailing newlines.
  return (process.env.ADMIN_PASSWORD || '').trim();
}

export interface AuthResult {
  success: boolean;
  error?: string;
  redirectTo?: PostLoginRedirectPath;
  verificationPath?: string;
}

function isPendingIdentityConfirmation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { code?: unknown; message?: unknown };
  const code = typeof authError.code === 'string' ? authError.code.toLowerCase() : '';
  const message = typeof authError.message === 'string' ? authError.message.toLowerCase() : '';

  return (
    code === 'email_not_confirmed' ||
    code === 'phone_not_confirmed' ||
    message.includes('email not confirmed') ||
    message.includes('phone not confirmed')
  );
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
      const adminPassword = getConfiguredAdminPassword();
      const requestHeaders = await headers();
      const clientIp = getClientIpFromHeaders(requestHeaders);
      const rateLimitKey = buildAdminLoginRateLimitKey({
        loginId: normalizedLoginId,
        clientIp,
      });
      const rateLimit = checkAdminLoginRateLimit(rateLimitKey);
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: `管理員登入嘗試次數過多，請在 ${rateLimit.retryAfterSeconds} 秒後再試。`,
        };
      }

      if (!adminPassword) {
        return {
          success: false,
          error: '管理員登入尚未完成設定，請聯絡系統管理員。',
        };
      }

      if (
        resolveAuthCaptchaAvailability().required
        && !canBypassPasswordLoginTurnstileForLocalDevelopment()
      ) {
        const captcha = await verifyPasswordLoginTurnstile({
          token: captchaToken,
          remoteIp: clientIp,
        });
        if (!captcha.ok) {
          const providerUnavailable =
            captcha.reason === 'configuration_error' ||
            captcha.reason === 'provider_error';
          if (!providerUnavailable) {
            recordAdminLoginFailure(rateLimitKey);
          }
          return {
            success: false,
            error: captcha.reason === 'configuration_error'
              ? '登入安全驗證尚未正確設定，請聯絡系統管理員。'
              : captcha.reason === 'provider_error'
                ? '登入安全驗證服務暫時無法使用，請稍後再試。'
                : '安全驗證失敗，請重新完成驗證後再試。',
          };
        }
      }

      if (password !== adminPassword) {
        recordAdminLoginFailure(rateLimitKey);
        return {
          success: false,
          error: '管理員帳號或密碼錯誤',
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
      if (isPendingIdentityConfirmation(error)) {
        const verificationChannel = isEmail ? 'email' : 'phone';
        const verificationIdentifier = isEmail ? normalizedLoginId : phone!;
        return {
          success: false,
          error: isEmail
            ? '信箱尚未完成驗證，請輸入驗證碼後再登入。'
            : '手機尚未完成驗證，請輸入驗證碼後再登入。',
          verificationPath:
            `/signup?verify=${verificationChannel}&identifier=${encodeURIComponent(verificationIdentifier)}`,
        };
      }
      return {
        success: false,
        error: error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : '登入失敗，請稍後再試',
      };
    }

    const isPlatformAdmin = isExplicitPlatformAdminPrincipal({
      userId: signInData.user?.id ?? null,
      userEmail: signInData.user?.email ?? (isEmail ? normalizedLoginId : null),
    });

    if (!signInData.user?.id) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: '登入後無法確認帳號身分，請稍後再試',
      };
    }

    let redirectTo: PostLoginRedirectPath;
    if (isPlatformAdmin) {
      redirectTo = getPostLoginRedirect({
        isAdmin: true,
        requestedPath,
      });
    } else {
      try {
        const membershipRepository = createGoogleOAuthMembershipRepository(
          supabase as unknown as Parameters<typeof createGoogleOAuthMembershipRepository>[0]
        );
        const memberships = await membershipRepository.listMemberships(signInData.user.id);
        redirectTo = resolveGoogleOAuthDestination({
          user: {
            id: signInData.user.id,
            email: signInData.user.email ?? (isEmail ? normalizedLoginId : null),
          },
          memberships,
          requestedPath,
        });
      } catch (membershipError) {
        console.error('Password login membership lookup failed:', membershipError);
        await supabase.auth.signOut();
        return {
          success: false,
          error: '登入後無法確認工作區權限，請稍後再試',
        };
      }
    }

    revalidatePath('/', 'layout');
    return {
      success: true,
      redirectTo,
    };
  } catch (err) {
    console.error('Login error:', err);
    return {
      success: false,
      error: '登入失敗，請稍後再試',
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

export async function leavePlatformAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);

  // The legacy platform-admin session is intentionally independent from the
  // merchant Supabase session. Removing only this cookie lets an operator
  // return to an already signed-in merchant workspace without signing in again.
  revalidatePath('/', 'layout');
  redirect('/analytics');
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

  return getCurrentMerchantUser();
}

export async function getCurrentMerchantUser() {
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
