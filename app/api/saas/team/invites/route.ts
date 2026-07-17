import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import {
  createSaaSTeamInviteFromRequest,
  type SaaSTeamInviteRouteDependencies,
} from '@/lib/saas/team-invite-route';
import { SaaSInviteCreationError } from '@/lib/saas/invite-creation';
import { SaaSOrgContextError } from '@/lib/saas/org-context';

export const dynamic = 'force-dynamic';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SaaSInviteCreationError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleCreateSaaSTeamInviteRequest(
  request: NextRequest,
  deps: SaaSTeamInviteRouteDependencies = {}
) {
  try {
    const payload = await readJsonBody(request);
    const result = await createSaaSTeamInviteFromRequest(payload, deps);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
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

    if (error instanceof SaaSInviteCreationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code === 'seat_limit_reached'
            ? '目前已達可用成員席次上限。'
            : error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    console.error('Create SaaS team invite failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create team invite.',
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

  return handleCreateSaaSTeamInviteRequest(request);
}
