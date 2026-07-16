import { describe, expect, it } from 'vitest';

import {
  getPasswordRecoveryErrorMessage,
  isPasswordRecoveryIdentityMatch,
  resolvePasswordRecoveryAvailability,
  shouldExposePasswordRecoverySendError,
} from '@/lib/auth/password-recovery';

const CAPTCHA_ENV = {
  SAAS_AUTH_CAPTCHA_READY: 'true',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'real-site-key',
};

describe('password recovery policy', () => {
  it('keeps both channels closed by default', () => {
    expect(resolvePasswordRecoveryAvailability({})).toEqual({
      emailEnabled: false,
      phoneEnabled: false,
      turnstileSiteKey: '',
    });
  });

  it('requires each channel flag, CAPTCHA, and matching provider readiness', () => {
    expect(resolvePasswordRecoveryAvailability({
      ...CAPTCHA_ENV,
      ENABLE_EMAIL_PASSWORD_RECOVERY: 'true',
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    })).toEqual({
      emailEnabled: true,
      phoneEnabled: false,
      turnstileSiteKey: 'real-site-key',
    });

    expect(resolvePasswordRecoveryAvailability({
      ...CAPTCHA_ENV,
      ENABLE_PHONE_PASSWORD_RECOVERY: 'true',
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    }).phoneEnabled).toBe(true);

    expect(resolvePasswordRecoveryAvailability({
      SAAS_AUTH_CAPTCHA_READY: 'true',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'replace_with_site_key',
      ENABLE_EMAIL_PASSWORD_RECOVERY: 'true',
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    }).emailEnabled).toBe(false);
  });

  it('accepts only the matching confirmed recovery identity', () => {
    expect(isPasswordRecoveryIdentityMatch({
      email: 'Owner@Example.com',
      email_confirmed_at: '2026-07-16T00:00:00.000Z',
    }, 'email', 'owner@example.com')).toBe(true);
    expect(isPasswordRecoveryIdentityMatch({
      email: 'other@example.com',
      email_confirmed_at: '2026-07-16T00:00:00.000Z',
    }, 'email', 'owner@example.com')).toBe(false);
    expect(isPasswordRecoveryIdentityMatch({
      phone: '0912-345-678',
      phone_confirmed_at: '2026-07-16T00:00:00.000Z',
    }, 'phone', '+886912345678')).toBe(true);
    expect(isPasswordRecoveryIdentityMatch({
      phone: '+886912345678',
      phone_confirmed_at: null,
    }, 'phone', '+886912345678')).toBe(false);
  });

  it('only exposes explicit CAPTCHA and rate-limit send failures', () => {
    expect(shouldExposePasswordRecoverySendError({ code: 'captcha_failed' })).toBe(true);
    expect(shouldExposePasswordRecoverySendError({ code: 'over_email_send_rate_limit' })).toBe(true);
    expect(shouldExposePasswordRecoverySendError(new Error('Too many requests'))).toBe(true);
    expect(shouldExposePasswordRecoverySendError(new Error('Failed to generate recovery link'))).toBe(false);
    expect(shouldExposePasswordRecoverySendError(new Error('User not found'))).toBe(false);
  });

  it('returns a dedicated expired-flow message for invalid recovery proof', () => {
    expect(getPasswordRecoveryErrorMessage(new Error('Password recovery session invalid')))
      .toBe('帳號復原流程已失效，請重新取得驗證碼。');
  });
});
