import { NextRequest, NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  createPlatformAdminDataRepository,
  type PlatformAdminDataRepository,
  type PlatformAdminQueryClient,
} from '@/lib/saas/platform-admin-data';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { buildPlatformOrganizationDetailView } from '@/lib/saas/ui-backend-contracts';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformAdminDataRepository;
}

function getRepository(deps: HandlerDependencies): PlatformAdminDataRepository {
  return deps.repository ?? createPlatformAdminDataRepository(
    createUntypedAdminClient() as unknown as PlatformAdminQueryClient
  );
}

function getCurrentMonthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function handleGetPlatformOrganization(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: HandlerDependencies = {}
) {
  try {
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess()))();

    const { id } = await context.params;
    const repository = getRepository(deps);
    const organization = await repository.getOrganization({ orgId: id });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    const [usageByOrgId, recentAuditLogs] = await Promise.all([
      repository.listOrganizationUsage({
        orgIds: [organization.id],
        periodStart: getCurrentMonthStartIso(),
      }),
      repository.listAuditLogs({
        orgId: organization.id,
        limit: 20,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: buildPlatformOrganizationDetailView(organization, {
        usageByOrgId,
        recentAuditLogs,
      }),
    });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Get platform organization failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load organization' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleGetPlatformOrganization(request, context);
}
