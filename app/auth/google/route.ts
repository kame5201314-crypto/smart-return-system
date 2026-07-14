import { NextRequest, NextResponse } from 'next/server';

import { normalizeGoogleOAuthNext, normalizeGoogleTrialPlan } from '@/lib/auth/google-oauth';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { createClient } from '@/lib/supabase/server';

interface GoogleOAuthClient {
  auth: {
    signInWithOAuth(input: {
      provider: 'google';
      options: {
        redirectTo: string;
        scopes: string;
      };
    }): Promise<{
      data: { url: string | null };
      error: { message?: string } | null;
    }>;
  };
}

interface GoogleOAuthStartDependencies {
  env?: Record<string, string | undefined>;
  client?: GoogleOAuthClient;
}

function redirectWithError(request: NextRequest, error: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

export async function handleGoogleOAuthStart(
  request: NextRequest,
  deps: GoogleOAuthStartDependencies = {}
) {
  const env = deps.env ?? process.env;
  const flags = resolveSaaSFeatureFlags({ env, orgPlan: 'basic' });
  if (!flags.google_auth) {
    return redirectWithError(request, 'google_auth_disabled');
  }

  const callbackUrl = new URL('/auth/callback', request.nextUrl.origin);
  const requestedPath = normalizeGoogleOAuthNext(request.nextUrl.searchParams.get('next'));
  if (requestedPath) {
    callbackUrl.searchParams.set('next', requestedPath);
  }
  callbackUrl.searchParams.set(
    'plan',
    normalizeGoogleTrialPlan(request.nextUrl.searchParams.get('plan'))
  );

  try {
    const client = deps.client ?? ((await createClient()) as unknown as GoogleOAuthClient);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
        scopes: 'openid email profile',
      },
    });

    if (error || !data.url) {
      console.error('Google OAuth start failed:', error?.message || 'Missing provider URL');
      return redirectWithError(request, 'google_auth_failed');
    }

    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error('Google OAuth start failed:', error);
    return redirectWithError(request, 'google_auth_failed');
  }
}

export async function GET(request: NextRequest) {
  return handleGoogleOAuthStart(request);
}
