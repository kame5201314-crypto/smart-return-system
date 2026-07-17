/* @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { handlePasswordRecoveryReadiness } from '@/app/api/saas/password-recovery/readiness/route';

const COMMON_READY_ENV = {
  ENABLE_EMAIL_PASSWORD_RECOVERY: 'true',
  ENABLE_PHONE_PASSWORD_RECOVERY: 'true',
  SAAS_AUTH_CAPTCHA_READY: 'true',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-site-key',
};

describe('password recovery readiness API', () => {
  it('fails both channels closed when rollout prerequisites are unavailable', async () => {
    const response = handlePasswordRecoveryReadiness({});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        emailEnabled: false,
        phoneEnabled: false,
      },
    });
  });

  it('returns only ready channels without exposing provider or site-key details', async () => {
    const emailResponse = handlePasswordRecoveryReadiness({
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

    const phoneResponse = handlePasswordRecoveryReadiness({
      ...COMMON_READY_ENV,
      SAAS_PHONE_OTP_PROVIDER_READY: 'true',
    });
    await expect(phoneResponse.json()).resolves.toMatchObject({
      data: { emailEnabled: false, phoneEnabled: true },
    });
  });

  it('marks every response no-store and resolves fresh state on each call', async () => {
    const enabledResponse = handlePasswordRecoveryReadiness({
      ...COMMON_READY_ENV,
      SAAS_EMAIL_OTP_PROVIDER_READY: 'true',
    });
    const disabledResponse = handlePasswordRecoveryReadiness({});

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
