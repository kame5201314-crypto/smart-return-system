/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { handleVerifiedSignupReadiness } from '@/app/api/saas/signup/readiness/route';

const COMMON_READY_ENV = {
  ENABLE_EMAIL_OTP_SIGNUP: 'true',
  ENABLE_PHONE_OTP_SIGNUP: 'true',
  SAAS_AUTH_CAPTCHA_READY: 'true',
  SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'true',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-site-key',
};

describe('verified signup readiness API', () => {
  it('fails both channels closed when rollout prerequisites are unavailable', async () => {
    const response = handleVerifiedSignupReadiness({});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        emailEnabled: false,
        phoneEnabled: false,
      },
    });
  });

  it('returns only the currently ready signup channels without exposing the site key', async () => {
    const emailResponse = handleVerifiedSignupReadiness({
      ...COMMON_READY_ENV,
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    });
    const emailBody = await emailResponse.json();

    expect(emailBody).toEqual({
      success: true,
      data: {
        emailEnabled: true,
        phoneEnabled: false,
      },
    });
    expect(JSON.stringify(emailBody)).not.toContain('public-site-key');
    expect(emailBody.data).not.toHaveProperty('turnstileSiteKey');

    const phoneResponse = handleVerifiedSignupReadiness({
      ...COMMON_READY_ENV,
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    });
    await expect(phoneResponse.json()).resolves.toEqual({
      success: true,
      data: {
        emailEnabled: false,
        phoneEnabled: true,
      },
    });

    const bothResponse = handleVerifiedSignupReadiness({
      ...COMMON_READY_ENV,
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    });

    await expect(bothResponse.json()).resolves.toEqual({
      success: true,
      data: {
        emailEnabled: true,
        phoneEnabled: true,
      },
    });
  });

  it('keeps provider-ready channels closed without migration or CAPTCHA readiness', async () => {
    const missingMigration = handleVerifiedSignupReadiness({
      ...COMMON_READY_ENV,
      SAAS_VERIFIED_SIGNUP_MIGRATION_READY: 'false',
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    });
    const missingCaptcha = handleVerifiedSignupReadiness({
      ...COMMON_READY_ENV,
      SAAS_AUTH_CAPTCHA_READY: 'false',
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    });

    await expect(missingMigration.json()).resolves.toMatchObject({
      data: { emailEnabled: false, phoneEnabled: false },
    });
    await expect(missingCaptcha.json()).resolves.toMatchObject({
      data: { emailEnabled: false, phoneEnabled: false },
    });
  });

  it('marks every response no-store and resolves fresh environment state on each call', async () => {
    const enabledResponse = handleVerifiedSignupReadiness({
      ...COMMON_READY_ENV,
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    });
    const disabledResponse = handleVerifiedSignupReadiness({});

    expect(enabledResponse.headers.get('cache-control')).toContain('no-store');
    expect(disabledResponse.headers.get('cache-control')).toContain('no-store');
    await expect(enabledResponse.json()).resolves.toMatchObject({
      data: { emailEnabled: true },
    });
    await expect(disabledResponse.json()).resolves.toMatchObject({
      data: { emailEnabled: false, phoneEnabled: false },
    });
  });
});
