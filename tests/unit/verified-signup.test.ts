import { describe, expect, it } from 'vitest';

import {
  getVerifiedSignupErrorMessage,
  maskVerifiedSignupIdentifier,
  normalizeEmailIdentifier,
  normalizeTaiwanPhoneIdentifier,
  resolveAuthCaptchaAvailability,
  resolveVerifiedSignupAvailability,
  selectEnabledVerifiedSignupProvider,
  validateVerifiedSignupPassword,
  VerifiedSignupValidationError,
} from '@/lib/auth/verified-signup';

describe('verified signup contract', () => {
  it('normalizes email and Taiwan mobile identifiers', () => {
    expect(normalizeEmailIdentifier(' Owner@Example.COM ')).toBe('owner@example.com');
    expect(normalizeTaiwanPhoneIdentifier('0912-345-678')).toBe('+886912345678');
    expect(normalizeTaiwanPhoneIdentifier('886 912 345 678')).toBe('+886912345678');
    expect(normalizeTaiwanPhoneIdentifier('+886912345678')).toBe('+886912345678');
  });

  it('rejects invalid destinations and weak or mismatched passwords', () => {
    expect(() => normalizeEmailIdentifier('not-an-email')).toThrow(VerifiedSignupValidationError);
    expect(() => normalizeTaiwanPhoneIdentifier('0212345678')).toThrow(VerifiedSignupValidationError);
    expect(() => normalizeTaiwanPhoneIdentifier('+14155552671')).toThrow(VerifiedSignupValidationError);
    expect(() => validateVerifiedSignupPassword('password', 'password')).toThrowError(
      expect.objectContaining({ code: 'weak_password' })
    );
    expect(() => validateVerifiedSignupPassword('Password8', 'Password9')).toThrowError(
      expect.objectContaining({ code: 'password_mismatch' })
    );
    expect(() => validateVerifiedSignupPassword('Password8', 'Password8')).not.toThrow();
  });

  it('masks destinations without hiding which inbox or phone was used', () => {
    expect(maskVerifiedSignupIdentifier('email', 'owner@example.com')).toBe('ow***@example.com');
    expect(maskVerifiedSignupIdentifier('phone', '+886912345678')).toBe('+886912****78');
  });

  it('keeps each channel fail closed until flag, CAPTCHA, key, and provider are ready', () => {
    const common = {
      ENABLE_EMAIL_OTP_SIGNUP: 'true',
      ENABLE_PHONE_OTP_SIGNUP: 'true',
      SAAS_AUTH_CAPTCHA_READY: 'true',
      SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-site-key',
    };
    expect(resolveVerifiedSignupAvailability(common)).toMatchObject({
      emailEnabled: false,
      phoneEnabled: false,
    });
    expect(resolveVerifiedSignupAvailability({
      ...common,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'replace_with_turnstile_site_key',
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    })).toMatchObject({ emailEnabled: false });
    expect(resolveVerifiedSignupAvailability({
      ...common,
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    })).toMatchObject({ emailEnabled: true, phoneEnabled: false });
    expect(resolveVerifiedSignupAvailability({
      ...common,
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    })).toMatchObject({ emailEnabled: false, phoneEnabled: true });
    expect(resolveVerifiedSignupAvailability({
      ...common,
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    })).toMatchObject({ emailEnabled: true, phoneEnabled: true });
  });

  it('requires a real site key whenever the shared Supabase Auth CAPTCHA is marked ready', () => {
    expect(resolveAuthCaptchaAvailability({ SAAS_AUTH_CAPTCHA_READY: 'false' }))
      .toEqual({ required: false, ready: false, turnstileSiteKey: '' });
    expect(resolveAuthCaptchaAvailability({
      SAAS_AUTH_CAPTCHA_READY: 'true',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'replace_with_key',
    })).toMatchObject({ required: true, ready: false });
    expect(resolveAuthCaptchaAvailability({
      SAAS_AUTH_CAPTCHA_READY: 'true',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'real-site-key',
    })).toEqual({
      required: true,
      ready: true,
      turnstileSiteKey: 'real-site-key',
    });
  });

  it('maps provider errors to safe Traditional Chinese messages', () => {
    expect(getVerifiedSignupErrorMessage(new Error('captcha verification failed')))
      .toBe('安全驗證已失效，請重新驗證。');
    expect(getVerifiedSignupErrorMessage(new Error('rate limit exceeded')))
      .toBe('操作過於頻繁，請稍後再試。');
    expect(getVerifiedSignupErrorMessage(new Error('Failed to generate recovery link')))
      .toBe('驗證服務暫時無法使用，請稍後再試。');
    expect(getVerifiedSignupErrorMessage(new Error('token expired')))
      .toBe('驗證碼已失效，請重新傳送。');
    expect(getVerifiedSignupErrorMessage(new Error('OTP confirmation provider is not configured')))
      .toBe('此驗證方式目前尚未開放，請改用其他方式。');
    expect(getVerifiedSignupErrorMessage(new Error('secret provider detail')))
      .not.toContain('secret');
  });

  it('selects an enabled linked identity instead of forcing a disabled Google channel', () => {
    expect(selectEnabledVerifiedSignupProvider({
      signupChannel: 'email',
      hasGoogleIdentity: true,
      hasEmailIdentity: true,
      hasPhoneIdentity: false,
      emailVerified: true,
      phoneVerified: false,
      googleEnabled: false,
      emailEnabled: true,
      phoneEnabled: false,
    })).toBe('email_otp');

    expect(selectEnabledVerifiedSignupProvider({
      hasGoogleIdentity: true,
      hasEmailIdentity: false,
      hasPhoneIdentity: false,
      emailVerified: true,
      phoneVerified: false,
      googleEnabled: false,
      emailEnabled: true,
      phoneEnabled: false,
    })).toBeNull();
  });
});
