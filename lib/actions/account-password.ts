'use server';

import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import {
  getVerifiedSignupErrorMessage,
  validateVerifiedSignupPassword,
} from '@/lib/auth/verified-signup';
import { createClient } from '@/lib/supabase/server';

export interface AccountPasswordActionResult {
  success: boolean;
  error?: string;
}

function hasGoogleIdentity(user: {
  identities?: Array<{ provider?: string }> | null;
  app_metadata?: { provider?: string; providers?: string[] };
}): boolean {
  return Boolean(
    user.identities?.some((identity) => identity.provider === 'google') ||
    user.app_metadata?.provider === 'google' ||
    user.app_metadata?.providers?.includes('google')
  );
}

export async function setGoogleAccountPassword(
  password: string,
  confirmation: string
): Promise<AccountPasswordActionResult> {
  try {
    validateVerifiedSignupPassword(password, confirmation);

    const client = await createClient();
    const { data, error: userError } = await client.auth.getUser();
    const user = data.user;

    if (
      userError ||
      !user ||
      !user.email ||
      !user.email_confirmed_at ||
      !hasGoogleIdentity(user)
    ) {
      return {
        success: false,
        error: '驗證流程已失效，請重新使用 Google 驗證。',
      };
    }

    if (isExplicitPlatformAdminPrincipal({
      userId: user.id,
      userEmail: user.email,
    })) {
      return {
        success: false,
        error: '管理員帳號不可使用此密碼設定流程。',
      };
    }

    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) throw updateError;

    let globalSignOutFailed = false;
    try {
      const { error } = await client.auth.signOut({ scope: 'global' });
      globalSignOutFailed = Boolean(error);
    } catch {
      globalSignOutFailed = true;
    }

    if (!globalSignOutFailed) return { success: true };

    let localSignOutFailed = false;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      localSignOutFailed = Boolean(error);
    } catch {
      localSignOutFailed = true;
    }

    return localSignOutFailed
      ? {
          success: false,
          error: '密碼已設定，但無法自動登出。請立即關閉瀏覽器並聯絡客服。',
        }
      : {
          success: false,
          error: '密碼已設定且此裝置已登出，但無法確認其他裝置已全部登出。請使用新密碼重新登入。',
        };
  } catch (error) {
    return {
      success: false,
      error: getVerifiedSignupErrorMessage(error),
    };
  }
}
