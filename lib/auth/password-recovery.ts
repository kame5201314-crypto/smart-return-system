import {
  getVerifiedSignupErrorMessage,
  normalizeEmailIdentifier,
  normalizeTaiwanPhoneIdentifier,
  resolveAuthCaptchaAvailability,
  type VerifiedSignupChannel,
} from '@/lib/auth/verified-signup';

export type PasswordRecoveryChannel = VerifiedSignupChannel;

export interface PasswordRecoveryAvailability {
  emailEnabled: boolean;
  phoneEnabled: boolean;
  turnstileSiteKey: string;
}

export interface PasswordRecoveryUser {
  email?: string | null;
  email_confirmed_at?: string | null;
  phone?: string | null;
  phone_confirmed_at?: string | null;
}

function parseReadyFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
}

export function resolvePasswordRecoveryAvailability(
  env: Record<string, string | undefined> = process.env
): PasswordRecoveryAvailability {
  const captcha = resolveAuthCaptchaAvailability(env);

  return {
    emailEnabled:
      parseReadyFlag(env.ENABLE_EMAIL_PASSWORD_RECOVERY) &&
      captcha.ready &&
      parseReadyFlag(env.SAAS_EMAIL_OTP_PROVIDER_READY),
    phoneEnabled:
      parseReadyFlag(env.ENABLE_PHONE_PASSWORD_RECOVERY) &&
      captcha.ready &&
      parseReadyFlag(env.SAAS_PHONE_OTP_PROVIDER_READY),
    turnstileSiteKey: captcha.turnstileSiteKey,
  };
}

export function isPasswordRecoveryIdentityMatch(
  user: PasswordRecoveryUser,
  channel: PasswordRecoveryChannel,
  normalizedIdentifier: string
): boolean {
  try {
    if (channel === 'email') {
      return Boolean(
        user.email_confirmed_at &&
        user.email &&
        normalizeEmailIdentifier(user.email) === normalizedIdentifier
      );
    }

    return Boolean(
      user.phone_confirmed_at &&
      user.phone &&
      normalizeTaiwanPhoneIdentifier(user.phone) === normalizedIdentifier
    );
  } catch {
    return false;
  }
}

export function shouldExposePasswordRecoverySendError(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '').toLowerCase()
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return [
    'captcha_failed',
    'over_request_rate_limit',
    'over_email_send_rate_limit',
    'over_sms_send_rate_limit',
  ].includes(code) || message.includes('captcha') || message.includes('rate limit') || message.includes('too many requests');
}

export function getPasswordRecoveryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('password recovery') || message.includes('recovered identity')) {
    return '帳號復原流程已失效，請重新取得驗證碼。';
  }
  return getVerifiedSignupErrorMessage(error);
}

export const PASSWORD_RECOVERY_GENERIC_SENT_MESSAGE =
  '如果帳號存在且可使用此驗證方式，我們已寄出驗證碼。';
