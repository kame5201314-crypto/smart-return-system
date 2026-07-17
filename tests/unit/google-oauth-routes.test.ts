import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { handleGoogleOAuthCallback } from '@/app/auth/callback/route';
import { handleGoogleOAuthStart } from '@/app/auth/google/route';

function request(path: string): NextRequest {
  return new NextRequest(`https://app.example.test${path}`);
}

describe('Google OAuth routes', () => {
  it('keeps OAuth disabled by default', async () => {
    const response = await handleGoogleOAuthStart(request('/auth/google'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://app.example.test/login?error=google_auth_disabled'
    );
  });

  it('starts PKCE OAuth with the AI workspace as the customer destination', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' },
      error: null,
    });
    const response = await handleGoogleOAuthStart(
      request('/auth/google?next=%2Freturns&plan=growth'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: { auth: { signInWithOAuth } },
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('accounts.google.com');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.test/auth/callback?next=%2Fanalytics&plan=growth',
        scopes: 'openid email profile',
      },
    });
  });

  it('uses the configured app origin instead of the incoming host for OAuth redirects', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' },
      error: null,
    });
    await handleGoogleOAuthStart(
      new NextRequest('https://untrusted-host.example/auth/google?next=%2Freturns'),
      {
        env: {
          ENABLE_GOOGLE_AUTH: 'true',
          NEXT_PUBLIC_APP_URL: 'https://smart-return-system-saas.vercel.app/app-path',
        },
        client: { auth: { signInWithOAuth } },
      }
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo:
          'https://smart-return-system-saas.vercel.app/auth/callback?next=%2Fanalytics&plan=basic',
        scopes: 'openid email profile',
      },
    });
  });

  it('drops unsafe next paths before starting OAuth', async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test' },
      error: null,
    });
    await handleGoogleOAuthStart(
      request('/auth/google?next=%2F%2Fevil.test&plan=enterprise'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: { auth: { signInWithOAuth } },
      }
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.test/auth/callback?next=%2Fanalytics&plan=basic',
        scopes: 'openid email profile',
      },
    });
  });

  it('exchanges the code and routes an existing merchant to the workspace', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'merchant@example.com' } },
      error: null,
    });
    const response = await handleGoogleOAuthCallback(
      request('/auth/callback?code=valid-code&next=%2Fanalytics'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: {
          auth: { exchangeCodeForSession, getUser },
          from: vi.fn(),
        },
        repository: {
          listMemberships: vi.fn().mockResolvedValue([
            { orgId: 'org-1', status: 'active' },
          ]),
        },
      }
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith('valid-code');
    expect(response.headers.get('location')).toBe('https://app.example.test/analytics');
  });

  it('keeps repeated Google logins on the existing workspace instead of entering provisioning', async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'existing-user', email: 'merchant@example.com' } },
      error: null,
    });
    const listMemberships = vi.fn().mockResolvedValue([
      { orgId: 'org-existing', status: 'active' },
    ]);
    const client = {
      auth: { exchangeCodeForSession, getUser },
      from: vi.fn(),
    };
    const repository = { listMemberships };

    const first = await handleGoogleOAuthCallback(
      request('/auth/callback?code=first-code&plan=growth'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client,
        repository,
      }
    );
    const second = await handleGoogleOAuthCallback(
      request('/auth/callback?code=second-code&plan=growth'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client,
        repository,
      }
    );

    expect(first.headers.get('location')).toBe('https://app.example.test/analytics');
    expect(second.headers.get('location')).toBe('https://app.example.test/analytics');
    expect(listMemberships).toHaveBeenNthCalledWith(1, 'existing-user');
    expect(listMemberships).toHaveBeenNthCalledWith(2, 'existing-user');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('routes a different Google identity without membership to completion', async () => {
    const response = await handleGoogleOAuthCallback(
      request('/auth/callback?code=valid-code&plan=growth'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: {
          auth: {
            exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'user-2', email: 'new@example.com' } },
              error: null,
            }),
          },
          from: vi.fn(),
        },
        repository: { listMemberships: vi.fn().mockResolvedValue([]) },
      }
    );

    expect(response.headers.get('location')).toBe(
      'https://app.example.test/signup/complete?plan=growth'
    );
  });

  it('uses the configured app origin after a successful callback', async () => {
    const response = await handleGoogleOAuthCallback(
      new NextRequest('https://untrusted-host.example/auth/callback?code=valid-code'),
      {
        env: {
          ENABLE_GOOGLE_AUTH: 'true',
          NEXT_PUBLIC_APP_URL: 'https://smart-return-system-saas.vercel.app',
        },
        client: {
          auth: {
            exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'user-3', email: 'new-3@example.com' } },
              error: null,
            }),
          },
          from: vi.fn(),
        },
        repository: { listMemberships: vi.fn().mockResolvedValue([]) },
      }
    );

    expect(response.headers.get('location')).toBe(
      'https://smart-return-system-saas.vercel.app/signup/complete?plan=basic'
    );
  });

  it('routes disabled members to support without creating another workspace', async () => {
    const response = await handleGoogleOAuthCallback(
      request('/auth/callback?code=valid-code&plan=growth'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: {
          auth: {
            exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'user-disabled', email: 'disabled@example.com' } },
              error: null,
            }),
          },
          from: vi.fn(),
        },
        repository: {
          listMemberships: vi.fn().mockResolvedValue([
            { orgId: 'org-disabled', status: 'disabled' },
          ]),
        },
      }
    );

    expect(response.headers.get('location')).toBe(
      'https://app.example.test/signup/complete?plan=growth&state=membership_disabled'
    );
  });

  it('routes explicit platform admins to internal without provisioning', async () => {
    const response = await handleGoogleOAuthCallback(
      request('/auth/callback?code=valid-code&plan=growth'),
      {
        env: {
          ENABLE_GOOGLE_AUTH: 'true',
          PLATFORM_ADMIN_ROLES: 'operator@example.com=owner',
        },
        client: {
          auth: {
            exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'platform-user', email: 'operator@example.com' } },
              error: null,
            }),
          },
          from: vi.fn(),
        },
        repository: { listMemberships: vi.fn().mockResolvedValue([]) },
      }
    );

    expect(response.headers.get('location')).toBe('https://app.example.test/internal');
  });

  it('does not honor an internal next path for a merchant callback', async () => {
    const response = await handleGoogleOAuthCallback(
      request('/auth/callback?code=valid-code&next=%2Finternal%2Forgs'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: {
          auth: {
            exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'merchant-user', email: 'merchant@example.com' } },
              error: null,
            }),
          },
          from: vi.fn(),
        },
        repository: {
          listMemberships: vi.fn().mockResolvedValue([
            { orgId: 'org-1', status: 'active' },
          ]),
        },
      }
    );

    expect(response.headers.get('location')).toBe('https://app.example.test/analytics');
  });

  it('fails closed for missing or already-consumed callback codes', async () => {
    const missingCode = await handleGoogleOAuthCallback(
      request('/auth/callback?next=%2Freturns&plan=growth'),
      { env: { ENABLE_GOOGLE_AUTH: 'true' } }
    );
    expect(missingCode.headers.get('location')).toBe(
      'https://app.example.test/login?error=google_auth_expired&next=%2Freturns&plan=growth'
    );

    const consumedCode = await handleGoogleOAuthCallback(
      request('/auth/callback?code=used-code'),
      {
        env: { ENABLE_GOOGLE_AUTH: 'true' },
        client: {
          auth: {
            exchangeCodeForSession: vi.fn().mockResolvedValue({
              error: { message: 'invalid flow state' },
            }),
            getUser: vi.fn(),
          },
          from: vi.fn(),
        },
      }
    );
    expect(consumedCode.headers.get('location')).toContain('error=google_auth_expired');
  });
});
