import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import { SaaSOnboardingError } from '@/lib/saas/onboarding';
import {
  completeSaaSOnboardingFromRequest,
  type SaaSOnboardingRouteDependencies,
} from '@/lib/saas/onboarding-route';
import { SaaSOrgContextError } from '@/lib/saas/org-context';

export const dynamic = 'force-dynamic';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SaaSOnboardingError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleCompleteSaaSOnboardingRequest(
  request: NextRequest,
  deps: SaaSOnboardingRouteDependencies = {}
) {
  try {
    const payload = await readJsonBody(request);
    const result = await completeSaaSOnboardingFromRequest(payload, deps);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof SaaSOrgContextError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    if (error instanceof SaaSOnboardingError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    console.error('Complete SaaS onboarding failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete onboarding.',
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

  return handleCompleteSaaSOnboardingRequest(request);
}
