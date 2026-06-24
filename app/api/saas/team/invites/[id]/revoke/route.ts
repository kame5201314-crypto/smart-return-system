import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import { teamManagementErrorResponse } from '@/app/api/saas/team/team-management-response';
import {
  revokeTeamInvite,
  type TeamManagementDependencies,
} from '@/lib/saas/team-management';

export const dynamic = 'force-dynamic';

export async function handleRevokeSaaSTeamInviteRequest(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: TeamManagementDependencies = {}
) {
  try {
    const { id } = await context.params;
    const result = await revokeTeamInvite({ inviteId: id }, deps);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return teamManagementErrorResponse(error, 'Revoke SaaS team invite failed:');
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

  return handleRevokeSaaSTeamInviteRequest(request, context);
}
