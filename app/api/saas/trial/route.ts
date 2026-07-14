import { NextRequest, NextResponse } from 'next/server';

import { isExplicitPlatformAdminPrincipal } from '@/lib/auth/platform-admin-identity';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  provisionSelfServiceTrial,
  SelfServiceTrialError,
  type SelfServiceTrialIdentity,
  type SelfServiceTrialRepository,
} from '@/lib/saas/self-service-trial';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface SelfServiceTrialRouteDependencies {
  env?: Record<string, string | undefined>;
  identity?: SelfServiceTrialIdentity | null;
  repository?: SelfServiceTrialRepository;
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

async function loadGoogleIdentity(): Promise<SelfServiceTrialIdentity | null> {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  const user = data.user;
  if (error || !user?.id || !user.email) return null;

  if (isExplicitPlatformAdminPrincipal({ userId: user.id, userEmail: user.email })) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    hasGoogleIdentity: Boolean(
      user.identities?.some((identity) => identity.provider === 'google')
    ),
  };
}

export async function handleSelfServiceTrialRequest(
  request: NextRequest,
  deps: SelfServiceTrialRouteDependencies = {}
) {
  try {
    const identity = Object.prototype.hasOwnProperty.call(deps, 'identity')
      ? deps.identity ?? null
      : await loadGoogleIdentity();
    const result = await provisionSelfServiceTrial(await readJsonBody(request), {
      identity,
      env: deps.env,
      repository: deps.repository,
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
