import { NextRequest, NextResponse } from 'next/server';

import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import {
  resolveVerifiedSignupAvailability,
  selectEnabledVerifiedSignupProvider,
} from '@/lib/auth/verified-signup';
import { resolveSaaSFeatureFlags } from '@/lib/config/feature-flags';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  provisionSelfServiceTrial,
  SelfServiceTrialError,
  type SelfServiceTrialIdentity,
  type SelfServiceTrialRateLimiter,
  type SelfServiceTrialRepository,
} from '@/lib/saas/self-service-trial';
import type { SelfServiceTrialProfileRepository } from '@/lib/saas/self-service-trial-profile';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SelfServiceTrialRouteDependencies {
  env?: Record<string, string | undefined>;
  identity?: SelfServiceTrialIdentity | null;
  repository?: SelfServiceTrialRepository;
  profileRepository?: SelfServiceTrialProfileRepository;
  rateLimiter?: SelfServiceTrialRateLimiter;
  now?: Date;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SelfServiceTrialError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function loadVerifiedIdentity(
  env?: Record<string, string | undefined>,
  clientOverride?: Awaited<ReturnType<typeof createClient>>
): Promise<SelfServiceTrialIdentity | null> {
  const client = clientOverride ?? await createClient();
  const { data, error } = await client.auth.getUser();
  const user = data.user;
  if (error || !user?.id) return null;

  if (isExplicitPlatformAdminPrincipal({ userId: user.id, userEmail: user.email })) {
    return null;
  }

  const emailVerified = Boolean(user.email && user.email_confirmed_at);
  const phoneVerified = Boolean(user.phone && user.phone_confirmed_at);
  const hasGoogleIdentity = Boolean(
    user.identities?.some((identity) => identity.provider === 'google')
  );
  const hasEmailIdentity = Boolean(
    user.identities?.some((identity) => identity.provider === 'email')
  );
  const hasPhoneIdentity = Boolean(
    user.identities?.some((identity) => identity.provider === 'phone')
  );
  const signupChannel = user.user_metadata?.signup_channel;
  const featureFlags = resolveSaaSFeatureFlags({ env, orgPlan: 'basic' });
  const verifiedSignup = resolveVerifiedSignupAvailability(env);
  const googleEnabled = featureFlags.google_auth && featureFlags.google_trial_signup;
  const provider = selectEnabledVerifiedSignupProvider({
    signupChannel,
    hasGoogleIdentity,
    hasEmailIdentity,
    hasPhoneIdentity,
    emailVerified,
    phoneVerified,
    googleEnabled,
    emailEnabled: verifiedSignup.emailEnabled,
    phoneEnabled: verifiedSignup.phoneEnabled,
  });
  if (!provider) return null;

  return {
    userId: user.id,
    provider,
    email: user.email ?? null,
    phone: user.phone ?? null,
    emailVerified,
    phoneVerified,
  };
}

export async function handleSelfServiceTrialRequest(
  request: NextRequest,
  deps: SelfServiceTrialRouteDependencies = {}
) {
  try {
    const identity = Object.prototype.hasOwnProperty.call(deps, 'identity')
      ? deps.identity ?? null
      : await loadVerifiedIdentity(deps.env);
    const result = await provisionSelfServiceTrial(await readJsonBody(request), {
      identity,
      env: deps.env,
      repository: deps.repository,
      profileRepository: deps.profileRepository,
      rateLimiter: deps.rateLimiter,
      now: deps.now,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        redirectTo: '/analytics',
      },
      { status: result.reused ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof SelfServiceTrialError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Self-service trial request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Self-service trial request failed.',
        code: 'provision_failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;
  return handleSelfServiceTrialRequest(request);
}
