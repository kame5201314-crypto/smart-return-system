import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  buildClientRateLimitKey,
  createInMemoryRateLimiter,
} from '@/lib/security/request-rate-limit';

import {
  SaaSPublicSignupRequestError,
  submitSaaSPublicSignupRequest,
  type SaaSPublicSignupRequestRepository,
  type SaaSPublicSignupRequestRepositoryFactory,
} from '@/lib/saas/signup-request';
import { createDefaultSaaSPublicSignupRequestRepository } from '@/lib/saas/signup-request-repository';

interface HandlerDependencies {
  env?: Record<string, string | undefined>;
  repository?:
    | SaaSPublicSignupRequestRepository
    | SaaSPublicSignupRequestRepositoryFactory;
}

export const dynamic = 'force-dynamic';

const signupRateLimiter = createInMemoryRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleSaaSPublicSignupRequest(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const payload = await readJsonBody(request);
    const result = await submitSaaSPublicSignupRequest(payload, {
      env: deps.env,
      repository:
        deps.repository ?? createDefaultSaaSPublicSignupRequestRepository,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof SaaSPublicSignupRequestError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    console.error('Public signup request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Public signup request failed.',
        code: 'request_failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) {
    return crossSiteResponse;
  }

  const rateLimit = signupRateLimiter.check(
    buildClientRateLimitKey({
      scope: 'saas_public_signup',
      headers: request.headers,
    })
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many signup requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        code: 'rate_limited',
      },
      { status: 429 }
    );
  }

  return handleSaaSPublicSignupRequest(request);
}
