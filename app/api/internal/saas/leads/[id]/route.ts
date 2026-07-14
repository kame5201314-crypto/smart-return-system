import { NextRequest, NextResponse } from 'next/server';

import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import { requirePlatformAdminAccess, PlatformAdminAccessError } from '@/lib/saas/platform-admin';
import {
  createDefaultPlatformLeadRepository,
  PlatformLeadManagementError,
  updatePlatformLead,
  type PlatformLeadRepository,
} from '@/lib/saas/platform-lead-management';

interface Dependencies {
  requireAccess?: typeof requirePlatformAdminAccess;
  repository?: PlatformLeadRepository;
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // handled below
  }
  throw new PlatformLeadManagementError('invalid_request', 400, 'Request body must be JSON.');
}

export async function handleUpdatePlatformLead(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: Dependencies = {}
) {
  try {
    const access = await (deps.requireAccess ?? requirePlatformAdminAccess)({
      requiredPermission: 'manage_leads',
    });
    const body = await readBody(request);
    const { id } = await context.params;
    const lead = await updatePlatformLead(
      { leadId: id, action: body.action },
      access,
      deps.repository ?? createDefaultPlatformLeadRepository()
    );
    return NextResponse.json({ success: true, data: { lead } });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError || error instanceof PlatformLeadManagementError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('Update platform lead failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  return crossSiteResponse ?? handleUpdatePlatformLead(request, context);
}
