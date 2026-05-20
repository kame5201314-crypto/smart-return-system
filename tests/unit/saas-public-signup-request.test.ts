/* @vitest-environment node */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleSaaSPublicSignupRequest } from '@/app/api/saas/signup/route';
import type { SaaSPublicSignupRequestRepository } from '@/lib/saas/signup-request';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/saas/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createRepository(): SaaSPublicSignupRequestRepository {
  return {
    createRequest: vi.fn(async () => ({ id: 'signup-request-1' })),
  };
}

describe('SaaS public signup API', () => {
  it('blocks signup before validating or persisting when the public signup flag is closed', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({}),
      {
        env: {},
        repository,
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'feature_disabled',
    });
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('validates required fields after public signup is enabled', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'not-an-email',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
        repository,
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'invalid_request',
    });
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('returns not configured when the flag is enabled but persistence is not wired', async () => {
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'owner@example.com',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
      }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      success: false,
      code: 'not_configured',
    });
  });

  it('accepts a valid Basic signup request through an injected repository', async () => {
    const repository = createRepository();
    const response = await handleSaaSPublicSignupRequest(
      buildRequest({
        companyName: 'Demo Store',
        contactName: 'Owner',
        email: 'OWNER@EXAMPLE.COM',
        phone: '0912-345-678',
        plan: 'pro',
        monthlyReturnVolume: '1200',
        message: 'Need a trial workspace.',
      }),
      {
        env: {
          ENABLE_PUBLIC_SIGNUP: 'true',
        },
        repository,
      }
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        accepted: true,
        mode: 'public_signup',
        requestId: 'signup-request-1',
      },
    });
    expect(repository.createRequest).toHaveBeenCalledWith({
      companyName: 'Demo Store',
      contactName: 'Owner',
      email: 'owner@example.com',
      phone: '0912-345-678',
      plan: 'basic',
      monthlyReturnVolume: 1200,
      message: 'Need a trial workspace.',
    });
  });
});
