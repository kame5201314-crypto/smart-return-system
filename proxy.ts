import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/admin-session';
import { normalizeInternalNextPath } from '@/lib/auth/internal-login-redirect';
import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { resolveAuthenticatedLoginRedirect } from '@/lib/auth/proxy-login-redirect';
import { isPublicRoute } from '@/lib/auth/public-routes';

function isPlatformAdminEntryPath(pathname: string): boolean {
  return pathname === '/admin' || pathname === '/internal' || pathname.startsWith('/internal/');
}

function redirectToPlatformAdminLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  url.searchParams.set('next', normalizeInternalNextPath(request.nextUrl.pathname));
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
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
  const isAdminAuthenticated = !!(await verifyAdminSessionToken(adminToken));

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // ignore
  }

  const isAuthenticated = isAdminAuthenticated || !!user;
  const isPlatformAdminAuthenticated =
    isAdminAuthenticated ||
    (user
      ? isExplicitPlatformAdminPrincipal({
          userId: user.id,
          userEmail: user.email,
        })
      : false);
  const pathname = request.nextUrl.pathname;

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
