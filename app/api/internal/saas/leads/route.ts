import { NextRequest, NextResponse } from 'next/server';

import { requirePlatformAdminAccess, PlatformAdminAccessError } from '@/lib/saas/platform-admin';
import {
  assertPlatformLeadFeature,
  createDefaultPlatformLeadRepository,
  PlatformLeadManagementError,
  type PlatformLeadRepository,
} from '@/lib/saas/platform-lead-management';

interface Dependencies {
  requireAccess?: typeof requirePlatformAdminAccess;
  repository?: PlatformLeadRepository;
}

export async function handleListPlatformLeads(
  _request: NextRequest,
  deps: Dependencies = {}
) {
  try {
    const access = await (deps.requireAccess ?? requirePlatformAdminAccess)({
      requiredPermission: 'view_leads',
    });
    assertPlatformLeadFeature(access);
    const leads = await (deps.repository ?? createDefaultPlatformLeadRepository()).listLeads();
    return NextResponse.json({ success: true, data: { leads } });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError || error instanceof PlatformLeadManagementError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('List platform leads failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load leads' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleListPlatformLeads(request);
}
