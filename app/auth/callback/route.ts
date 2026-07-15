import { NextRequest, NextResponse } from 'next/server';

import {
  createGoogleOAuthMembershipRepository,
  normalizeGoogleOAuthNext,
  normalizeGoogleTrialPlan,
  resolveGoogleOAuthAppOrigin,
  resolveGoogleOAuthDestination,
  type GoogleOAuthMembershipRepository,
} from '@/lib/auth/google-oauth';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { createClient } from '@/lib/supabase/server';

interface GoogleOAuthCallbackClient {
  auth: {
    exchangeCodeForSession(code: string): Promise<{
      error: { message?: string } | null;
    }>;
    getUser(): Promise<{
      data: {
        user: { id: string; email?: string | null } | null;
      };
      error: { message?: string } | null;
    }>;
  };
  from(table: string): unknown;
}

interface GoogleOAuthCallbackDependencies {
  env?: Record<string, string | undefined>;
  client?: GoogleOAuthCallbackClient;
  repository?: GoogleOAuthMembershipRepository;
}

function redirectWithError(
  request: NextRequest,
  env: Record<string, string | undefined>,
  error: string
): NextResponse {
  const url = new URL('/login', resolveGoogleOAuthAppOrigin(request.nextUrl.origin, env));
  url.searchParams.set('error', error);

  const requestedPath = normalizeGoogleOAuthNext(request.nextUrl.searchParams.get('next'));
  if (requestedPath) {
    url.searchParams.set('next', requestedPath);
  }

  const requestedPlan = request.nextUrl.searchParams.get('plan');
  if (requestedPlan) {
    url.searchParams.set('plan', normalizeGoogleTrialPlan(requestedPlan));
  }

  return NextResponse.redirect(url);
}

export async function handleGoogleOAuthCallback(
  request: NextRequest,
  deps: GoogleOAuthCallbackDependencies = {}
) {
  const env = deps.env ?? process.env;
  const flags = resolveSaaSFeatureFlags({ env, orgPlan: 'basic' });
  if (!flags.google_auth) {
    return redirectWithError(request, env, 'google_auth_disabled');
  }

  const code = request.nextUrl.searchParams.get('code')?.trim();
  if (!code) {
    return redirectWithError(request, env, 'google_auth_expired');
  }

  try {
    const client = deps.client ?? ((await createClient()) as unknown as GoogleOAuthCallbackClient);
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error('Google OAuth code exchange failed:', exchangeError.message);
      return redirectWithError(request, env, 'google_auth_expired');
    }

    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user) {
      console.error('Google OAuth user lookup failed:', userError?.message || 'Missing user');
      return redirectWithError(request, env, 'google_auth_failed');
    }

    const repository = deps.repository ?? createGoogleOAuthMembershipRepository(
      client as unknown as Parameters<typeof createGoogleOAuthMembershipRepository>[0]
    );
    const memberships = await repository.listMemberships(data.user.id);
    const destination = resolveGoogleOAuthDestination({
      user: data.user,
      memberships,
      requestedPath: request.nextUrl.searchParams.get('next'),
      trialPlan: request.nextUrl.searchParams.get('plan'),
      env,
    });

    return NextResponse.redirect(
      new URL(destination, resolveGoogleOAuthAppOrigin(request.nextUrl.origin, env))
    );
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    return redirectWithError(request, env, 'google_auth_failed');
  }
}

export async function GET(request: NextRequest) {
  return handleGoogleOAuthCallback(request);
}
