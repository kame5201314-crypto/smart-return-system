import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import { teamManagementErrorResponse } from '@/app/api/saas/team/team-management-response';
import {
  changeTeamMemberRole,
  TeamManagementError,
  type TeamManagementDependencies,
} from '@/lib/saas/team-management';

export const dynamic = 'force-dynamic';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TeamManagementError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handlePatchSaaSTeamMemberRequest(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: TeamManagementDependencies = {}
) {
  try {
    const [{ id }, payload] = await Promise.all([context.params, readJsonBody(request)]);
    const body = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

    if (!body) {
      throw new TeamManagementError(
        'invalid_request',
        400,
        'Request body must be an object.'
      );
    }

    const result = await changeTeamMemberRole(
      {
        memberId: id,
        role: body.role,
      },
      deps
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return teamManagementErrorResponse(error, 'Patch SaaS team member failed:');
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) {
    return crossSiteResponse;
  }

  return handlePatchSaaSTeamMemberRequest(request, context);
}
