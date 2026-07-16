import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';

export type VerifiedSignupChannel = 'email' | 'phone';
export type VerifiedSignupIdentityProvider = 'google' | 'email_otp' | 'phone_otp';

export interface VerifiedSignupAvailability {
  emailEnabled: boolean;
  phoneEnabled: boolean;
  turnstileSiteKey: string;
}

export interface AuthCaptchaAvailability {
  required: boolean;
  ready: boolean;
  turnstileSiteKey: string;
}

export function selectEnabledVerifiedSignupProvider(input: {
  signupChannel?: unknown;
  hasGoogleIdentity: boolean;
  hasEmailIdentity: boolean;
  hasPhoneIdentity: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  googleEnabled: boolean;
  emailEnabled: boolean;
  phoneEnabled: boolean;
}): VerifiedSignupIdentityProvider | null {
  if (
    input.signupChannel === 'phone' &&
    input.phoneEnabled &&
    input.phoneVerified &&
    input.hasPhoneIdentity
  ) return 'phone_otp';
  if (
    input.signupChannel === 'email' &&
    input.emailEnabled &&
    input.emailVerified &&
    input.hasEmailIdentity
  ) return 'email_otp';
  if (input.googleEnabled && input.hasGoogleIdentity) return 'google';
  if (input.emailEnabled && input.emailVerified && input.hasEmailIdentity) return 'email_otp';
  if (input.phoneEnabled && input.phoneVerified && input.hasPhoneIdentity) return 'phone_otp';
  return null;
}

export class VerifiedSignupValidationError extends Error {
  constructor(public readonly code: 'invalid_email' | 'invalid_phone' | 'weak_password' | 'password_mismatch') {
    super(code);
    this.name = 'VerifiedSignupValidationError';
  }
}

function parseReadyFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
}

function hasUsablePublicSiteKey(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && ![
    'replace_with',
    'replace-with',
    'your_',
    'your-',
    'placeholder',
    'change_me',
  ].some((marker) => normalized.includes(marker));
}

export function normalizeEmailIdentifier(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new VerifiedSignupValidationError('invalid_email');
  }
  return normalized;
}

export function normalizeTaiwanPhoneIdentifier(value: string): string {
  const compact = value.replace(/[\s()-]/g, '');
  const normalized = compact.startsWith('09')
    ? `+886${compact.slice(1)}`
    : compact.startsWith('8869')
      ? `+${compact}`
      : compact;

  if (!/^\+8869\d{8}$/.test(normalized)) {
    throw new VerifiedSignupValidationError('invalid_phone');
  }
  return normalized;
}

export function normalizeVerifiedSignupIdentifier(
  channel: VerifiedSignupChannel,
  value: string
): string {
  return channel === 'email'
    ? normalizeEmailIdentifier(value)
    : normalizeTaiwanPhoneIdentifier(value);
}

export function validateVerifiedSignupPassword(password: string, confirmation: string): void {
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new VerifiedSignupValidationError('weak_password');
  }
  if (password !== confirmation) {
    throw new VerifiedSignupValidationError('password_mismatch');
  }
}

export function maskVerifiedSignupIdentifier(
  channel: VerifiedSignupChannel,
  normalizedIdentifier: string
): string {
  if (channel === 'phone') {
    return `${normalizedIdentifier.slice(0, 7)}****${normalizedIdentifier.slice(-2)}`;
  }

  const [localPart, domain = ''] = normalizedIdentifier.split('@');
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function resolveVerifiedSignupAvailability(
  env: Record<string, string | undefined> = process.env
): VerifiedSignupAvailability {
  const featureFlags = resolveSaaSFeatureFlags({ env, orgPlan: 'basic' });
  const captcha = resolveAuthCaptchaAvailability(env);
  const migrationReady = parseReadyFlag(env.SAAS_VERIFIED_SIGNUP_MIGRATION_READY);

  return {
    emailEnabled:
      featureFlags.email_otp_signup &&
      migrationReady &&
      captcha.ready &&
      parseReadyFlag(env.SAAS_EMAIL_OTP_PROVIDER_READY),
    phoneEnabled:
      featureFlags.phone_otp_signup &&
      migrationReady &&
      captcha.ready &&
      parseReadyFlag(env.SAAS_PHONE_OTP_PROVIDER_READY),
    turnstileSiteKey: captcha.turnstileSiteKey,
  };
}

export function resolveAuthCaptchaAvailability(
  env: Record<string, string | undefined> = process.env
): AuthCaptchaAvailability {
  const turnstileSiteKey = (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim();
  const required = parseReadyFlag(env.SAAS_AUTH_CAPTCHA_READY);
  return {
    required,
    ready: required && hasUsablePublicSiteKey(turnstileSiteKey),
    turnstileSiteKey,
  };
}

export function getVerifiedSignupErrorMessage(error: unknown): string {
  if (error instanceof VerifiedSignupValidationError) {
    if (error.code === 'invalid_email') return '請輸入有效的電子信箱。';
    if (error.code === 'invalid_phone') return '請輸入台灣手機號碼，例如 0912345678。';
    if (error.code === 'password_mismatch') return '兩次輸入的密碼不一致。';
    return '密碼需為 8 至 72 碼，並包含英文字母與數字。';
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('captcha')) return '安全驗證已失效，請重新驗證。';
  if (
    message.includes('rate limit') ||
    message.includes('rate-limit') ||
    message.includes('rate_limit') ||
    message.includes('too many') ||
    message.includes('too frequently')
  ) {
    return '操作過於頻繁，請稍後再試。';
  }
  if (message.includes('expired')) return '驗證碼已失效，請重新傳送。';
  if (message.includes('provider') || message.includes('phone')) {
    return '此驗證方式目前尚未開放，請改用其他方式。';
  }
  if (message.includes('token') || message.includes('otp') || message.includes('invalid')) {
    return '驗證碼錯誤，請重新輸入。';
  }
  return '驗證服務暫時無法使用，請稍後再試。';
}
