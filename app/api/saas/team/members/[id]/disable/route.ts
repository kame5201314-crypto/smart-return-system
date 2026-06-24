import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import { teamManagementErrorResponse } from '@/app/api/saas/team/team-management-response';
import {
  disableTeamMember,
  type TeamManagementDependencies,
} from '@/lib/saas/team-management';

export const dynamic = 'force-dynamic';

export async function handleDisableSaaSTeamMemberRequest(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: TeamManagementDependencies = {}
) {
  try {
    const { id } = await context.params;
    const result = await disableTeamMember({ memberId: id }, deps);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return teamManagementErrorResponse(error, 'Disable SaaS team member failed:');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) {
    return crossSiteResponse;
  }

  return handleDisableSaaSTeamMemberRequest(request, context);
}
