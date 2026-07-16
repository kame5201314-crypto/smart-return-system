'use server';

import { cookies } from 'next/headers';

import {
  getPasswordRecoveryErrorMessage,
  isPasswordRecoveryIdentityMatch,
  resolvePasswordRecoveryAvailability,
  type PasswordRecoveryChannel,
} from '@/lib/auth/password-recovery';
import {
  createPasswordRecoverySessionToken,
  PASSWORD_RECOVERY_SESSION_COOKIE,
  PASSWORD_RECOVERY_SESSION_COOKIE_OPTIONS,
  verifyPasswordRecoverySessionToken,
} from '@/lib/auth/password-recovery-session';
import { normalizeVerifiedSignupIdentifier, validateVerifiedSignupPassword } from '@/lib/auth/verified-signup';
import { createClient } from '@/lib/supabase/server';

export interface PasswordRecoveryActionResult {
  success: boolean;
  error?: string;
}

export async function verifyPasswordRecoveryOtp(
  channel: PasswordRecoveryChannel,
  identifier: string,
  otp: string
): Promise<PasswordRecoveryActionResult> {
  const availability = resolvePasswordRecoveryAvailability();
  if (
    (channel !== 'email' && channel !== 'phone') ||
    (channel === 'email' && !availability.emailEnabled) ||
    (channel === 'phone' && !availability.phoneEnabled)
  ) {
    return { success: false, error: '此驗證方式目前尚未開放，請改用其他方式。' };
  }

  const cookieStore = await cookies();
  cookieStore.delete(PASSWORD_RECOVERY_SESSION_COOKIE);
  const client = await createClient();
  let createdRecoverySession = false;

  try {
    const normalizedIdentifier = normalizeVerifiedSignupIdentifier(channel, identifier);
    if (!/^\d{6}$/.test(otp)) throw new Error('Invalid OTP');

    const response = channel === 'email'
      ? await client.auth.verifyOtp({ email: normalizedIdentifier, token: otp, type: 'recovery' })
      : await client.auth.verifyOtp({ phone: normalizedIdentifier, token: otp, type: 'sms' });
    if (response.error) throw response.error;
    if (!response.data.session || !response.data.user) {
      throw new Error('Password recovery session missing');
    }
    createdRecoverySession = true;

    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user || data.user.id !== response.data.user.id) {
      throw userError || new Error('Password recovery user mismatch');
    }
    if (!isPasswordRecoveryIdentityMatch(data.user, channel, normalizedIdentifier)) {
      throw new Error('Password recovery identity mismatch');
    }

    cookieStore.set(
      PASSWORD_RECOVERY_SESSION_COOKIE,
      await createPasswordRecoverySessionToken(data.user.id),
      PASSWORD_RECOVERY_SESSION_COOKIE_OPTIONS
    );
    return { success: true };
  } catch (error) {
    if (createdRecoverySession) {
      await client.auth.signOut({ scope: 'local' });
    }
    cookieStore.delete(PASSWORD_RECOVERY_SESSION_COOKIE);
    return { success: false, error: getPasswordRecoveryErrorMessage(error) };
  }
}

export async function updateRecoveredPassword(
  password: string,
  confirmation: string
): Promise<PasswordRecoveryActionResult> {
  try {
    validateVerifiedSignupPassword(password, confirmation);
    const cookieStore = await cookies();
    const client = await createClient();
    const { data, error: userError } = await client.auth.getUser();
    const proof = await verifyPasswordRecoverySessionToken(
      cookieStore.get(PASSWORD_RECOVERY_SESSION_COOKIE)?.value
    );

    if (userError || !data.user || !proof || proof.sub !== data.user.id) {
      cookieStore.delete(PASSWORD_RECOVERY_SESSION_COOKIE);
      throw new Error('Password recovery session invalid');
    }

    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) throw updateError;

    cookieStore.delete(PASSWORD_RECOVERY_SESSION_COOKIE);
    const { error: globalSignOutError } = await client.auth.signOut({ scope: 'global' });
    if (globalSignOutError) {
      const { error: localSignOutError } = await client.auth.signOut({ scope: 'local' });
      if (localSignOutError) {
        return {
          success: false,
          error: '密碼已更新，但無法自動登出所有裝置。請關閉瀏覽器並聯絡客服。',
        };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: getPasswordRecoveryErrorMessage(error) };
  }
}
