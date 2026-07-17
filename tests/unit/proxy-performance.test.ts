import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServerClientMock, getClaimsMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getClaimsMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

import { proxy } from '@/proxy';

function request(pathname: string, cookie?: string): NextRequest {
  return new NextRequest(`https://app.example.test${pathname}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('proxy page-load performance boundaries', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.example.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_USERNAME;
    delete process.env.PLATFORM_ADMIN_ROLES;

    getClaimsMock.mockResolvedValue({ data: null, error: null });
    createServerClientMock.mockReturnValue({
      auth: { getClaims: getClaimsMock },
    });
  });

  it.each(['/pricing', '/signup', '/features/ai', '/legal/privacy'])(
    'does not create an Auth client for public page %s',
    async (pathname) => {
      const response = await proxy(request(pathname));

      expect(response.status).toBe(200);
      expect(createServerClientMock).not.toHaveBeenCalled();
      expect(getClaimsMock).not.toHaveBeenCalled();
    }
  );

  it('recovers a Google OAuth code returned to the marketing Site URL', async () => {
    const response = await proxy(request(
      '/?code=oauth-code&untrusted=discard-me',
      'sb-project-auth-token-code-verifier=pkce-verifier'
    ));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toBe(
      'https://app.example.test/auth/callback?code=oauth-code&next=%2Fanalytics&plan=basic'
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it('does not treat an unrelated marketing code as an OAuth callback', async () => {
    const response = await proxy(request('/?code=referral-code'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it('keeps an ordinary marketing visit public without an Auth lookup', async () => {
    const response = await proxy(request('/'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it('checks verified claims on login because authenticated users are redirected', async () => {
    const response = await proxy(request('/login'));

    expect(response.status).toBe(200);
    expect(createServerClientMock).toHaveBeenCalledOnce();
    expect(getClaimsMock).toHaveBeenCalledOnce();
  });

  it('accepts verified claims for protected merchant pages', async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          sub: 'merchant-user-id',
          email: 'merchant@example.test',
        },
      },
      error: null,
    });

    const response = await proxy(request('/analytics'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(getClaimsMock).toHaveBeenCalledOnce();
  });

  it('uses verified claim identity for platform admin routing', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.test';
    getClaimsMock.mockResolvedValue({
      data: {
        claims: {
          sub: 'platform-owner-id',
          email: 'owner@example.test',
        },
      },
      error: null,
    });

    const response = await proxy(request('/internal'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('keeps anonymous protected requests behind the login boundary', async () => {
    const response = await proxy(request('/analytics'));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toBe('https://app.example.test/login');
  });
});
