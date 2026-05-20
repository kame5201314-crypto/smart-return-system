import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth/admin-session';
import { isPublicRoute } from '@/lib/auth/public-routes';

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
  const pathname = request.nextUrl.pathname;

  if (isPublicRoute(pathname)) {
    if (pathname === '/login' && isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = '/analytics';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (!isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
