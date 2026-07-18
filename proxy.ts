import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/admin-session';
import { normalizeInternalNextPath } from '@/lib/auth/internal-login-redirect';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import {
  resolveAuthenticatedAdminEntryRedirect,
  resolveAuthenticatedLoginRedirect,
} from '@/lib/auth/proxy-login-redirect';
import { CUSTOMER_POST_LOGIN_PATH } from '@/lib/auth/post-login-redirect';
import { isPublicRoute } from '@/lib/auth/public-routes';

function isPlatformAdminEntryPath(pathname: string): boolean {
  return pathname === '/admin' || pathname === '/internal' || pathname.startsWith('/internal/');
}

function hasGoogleOAuthCodeVerifier(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => (
    name.startsWith('sb-') && name.endsWith('-auth-token-code-verifier')
  ));
}

const SUPABASE_OAUTH_CODE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveRootGoogleOAuthCode(request: NextRequest): string | null {
  if (request.nextUrl.pathname !== '/') {
    return null;
  }

  const code = request.nextUrl.searchParams.get('code')?.trim();
  if (!code) {
    return null;
  }

  // Supabase can vary or chunk the PKCE cookie name across SSR package
  // versions. Its authorization code is a UUID, so accept that shape as a
  // safe fallback while keeping ordinary marketing/referral codes on `/`.
  return hasGoogleOAuthCodeVerifier(request) || SUPABASE_OAUTH_CODE_PATTERN.test(code)
    ? code
    : null;
}

function redirectToPlatformAdminLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  url.searchParams.set('next', normalizeInternalNextPath(request.nextUrl.pathname));
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Supabase falls back to the configured Site URL when an OAuth redirect URL
  // is missing from its allowlist. Recover that PKCE callback before the public
  // marketing route can consume it, then send merchants through the normal
  // membership-aware Google callback flow.
  const oauthCode = resolveRootGoogleOAuthCode(request);
  if (oauthCode) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    url.search = '';
    url.searchParams.set('code', oauthCode);
    url.searchParams.set('next', CUSTOMER_POST_LOGIN_PATH);
    url.searchParams.set('plan', 'basic');
    return NextResponse.redirect(url);
  }

  // Public pages other than the login entry never use the authenticated
  // principal. Avoid a remote Auth lookup on every marketing/signup request.
  if (isPublicRoute(pathname) && pathname !== '/login') {
    return NextResponse.next();
  }

  // Skip middleware if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const [adminSession, claimsResult] = await Promise.all([
    verifyAdminSessionToken(adminToken),
    supabase.auth.getClaims().catch(() => null),
  ]);
  const claims = claimsResult?.data?.claims ?? null;
  const isAdminAuthenticated = !!adminSession;

  const isAuthenticated = isAdminAuthenticated || !!claims;
  const isPlatformAdminAuthenticated =
    isAdminAuthenticated ||
    (claims
      ? isExplicitPlatformAdminPrincipal({
          userId: claims.sub,
          userEmail: claims.email,
        })
      : false);

  if (isPublicRoute(pathname)) {
    if (pathname === '/login' && isAuthenticated) {
      const url = request.nextUrl.clone();
      const requestedNext = url.searchParams.get('next');

      url.pathname = resolveAuthenticatedLoginRedirect({
        isPlatformAdminAuthenticated,
        requestedPath: requestedNext,
      });
      url.search = '';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const authenticatedAdminEntryRedirect = resolveAuthenticatedAdminEntryRedirect({
    pathname,
    isAuthenticated,
    isPlatformAdminAuthenticated,
  });
  if (authenticatedAdminEntryRedirect) {
    return NextResponse.redirect(new URL(authenticatedAdminEntryRedirect, request.url));
  }

  if (!isAuthenticated) {
    if (isPlatformAdminEntryPath(pathname)) {
      return redirectToPlatformAdminLogin(request);
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
