import { NextRequest, NextResponse } from 'next/server';

import {
  normalizeGoogleTrialPlan,
  resolveGoogleOAuthAppOrigin,
  resolveGoogleOAuthRequestedPath,
} from '@/lib/auth/google-oauth';
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

function redirectWithError(
  request: NextRequest,
  env: Record<string, string | undefined>,
  error: string
): NextResponse {
  const url = new URL('/login', resolveGoogleOAuthAppOrigin(request.nextUrl.origin, env));
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
    return redirectWithError(request, env, 'google_auth_disabled');
  }

  const callbackUrl = new URL(
    '/auth/callback',
    resolveGoogleOAuthAppOrigin(request.nextUrl.origin, env)
  );
  callbackUrl.searchParams.set(
    'next',
    resolveGoogleOAuthRequestedPath(request.nextUrl.searchParams.get('next'))
  );
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
      return redirectWithError(request, env, 'google_auth_failed');
    }

    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error('Google OAuth start failed:', error);
    return redirectWithError(request, env, 'google_auth_failed');
  }
}

export async function GET(request: NextRequest) {
  return handleGoogleOAuthStart(request);
}
