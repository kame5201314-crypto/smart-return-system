/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import {
  resolveSaaSEmailDeliveryReadiness,
  sendResendEmail,
  SaaSEmailDeliveryError,
} from '@/lib/saas/email-delivery-provider';

describe('SaaS email delivery provider readiness', () => {
  it('keeps provider delivery disabled by default', () => {
    expect(resolveSaaSEmailDeliveryReadiness({})).toEqual({
      enabled: false,
      provider: null,
      status: 'disabled',
      missingEnv: [],
      blockedReason: 'delivery_not_enabled',
    });
  });

  it('requires an explicit Resend provider and credentials after delivery is enabled', () => {
    expect(
      resolveSaaSEmailDeliveryReadiness({
        ENABLE_EMAIL_DELIVERY: 'true',
      })
    ).toMatchObject({
      enabled: false,
      status: 'missing_config',
      missingEnv: ['EMAIL_PROVIDER'],
      blockedReason: 'provider_not_configured',
    });

    expect(
      resolveSaaSEmailDeliveryReadiness({
        ENABLE_EMAIL_DELIVERY: 'true',
        EMAIL_PROVIDER: 'smtp',
      })
    ).toMatchObject({
      enabled: false,
      status: 'unsupported_provider',
      blockedReason: 'provider_unsupported',
    });

    expect(
      resolveSaaSEmailDeliveryReadiness({
        ENABLE_EMAIL_DELIVERY: 'true',
        EMAIL_PROVIDER: 'resend',
      })
    ).toMatchObject({
      enabled: false,
      provider: 'resend',
      status: 'missing_config',
      missingEnv: ['RESEND_API_KEY', 'EMAIL_FROM'],
      blockedReason: 'provider_credentials_missing',
    });
  });

  it('reports ready only when the disabled-by-default gate and Resend config are complete', () => {
    expect(
      resolveSaaSEmailDeliveryReadiness({
        ENABLE_EMAIL_DELIVERY: 'true',
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_key',
        EMAIL_FROM: 'Smart Return <no-reply@example.com>',
      })
    ).toEqual({
      enabled: true,
      provider: 'resend',
      status: 'ready',
      missingEnv: [],
      blockedReason: null,
    });
  });

  it('does not call Resend when delivery is disabled', async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      sendResendEmail(
        {
          to: 'owner@example.com',
          subject: 'Invite',
          text: 'Welcome',
        },
        {
          env: {},
          fetcher,
        }
      )
    ).rejects.toBeInstanceOf(SaaSEmailDeliveryError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('calls the Resend endpoint only through an injected fetcher when explicitly enabled', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ id: 'email_123' }), { status: 200 })
    );

    await expect(
      sendResendEmail(
        {
          to: ['OWNER@EXAMPLE.COM', 'owner@example.com'],
          subject: 'Invite',
          text: 'Welcome',
          idempotencyKey: 'invite-1',
        },
        {
          env: {
            ENABLE_EMAIL_DELIVERY: 'true',
            EMAIL_PROVIDER: 'resend',
            RESEND_API_KEY: 're_test_key',
            EMAIL_FROM: 'Smart Return <no-reply@example.com>',
          },
          fetcher,
        }
      )
    ).resolves.toEqual({
      provider: 'resend',
      providerMessageId: 'email_123',
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'invite-1',
        }),
        body: JSON.stringify({
          from: 'Smart Return <no-reply@example.com>',
          to: ['owner@example.com'],
          subject: 'Invite',
          html: undefined,
          text: 'Welcome',
        }),
      })
    );
  });

  it('surfaces provider errors without retrying in-process', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ message: 'domain is not verified' }), { status: 400 })
    );

    await expect(
      sendResendEmail(
        {
          to: 'owner@example.com',
          subject: 'Invite',
          text: 'Welcome',
        },
        {
          env: {
            ENABLE_EMAIL_DELIVERY: 'true',
            EMAIL_PROVIDER: 'resend',
            RESEND_API_KEY: 're_test_key',
            EMAIL_FROM: 'Smart Return <no-reply@example.com>',
          },
          fetcher,
        }
      )
    ).rejects.toMatchObject({
      code: 'provider_error',
      message: 'domain is not verified',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
