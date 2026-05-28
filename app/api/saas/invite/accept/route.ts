import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import { SaaSInviteAcceptanceError } from '@/lib/saas/invite-acceptance';
import {
  acceptSaaSInviteFromRequest,
  SaaSInviteAcceptRouteError,
  type SaaSInviteAcceptRouteDependencies,
} from '@/lib/saas/invite-accept-route';

export const dynamic = 'force-dynamic';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SaaSInviteAcceptRouteError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleAcceptSaaSInviteRequest(
  request: NextRequest,
  deps: SaaSInviteAcceptRouteDependencies = {}
) {
  try {
    const payload = await readJsonBody(request);
    const result = await acceptSaaSInviteFromRequest(payload, deps);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof SaaSInviteAcceptRouteError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    if (error instanceof SaaSInviteAcceptanceError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    console.error('Accept SaaS invite failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to accept invite.',
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

  return handleAcceptSaaSInviteRequest(request);
}
