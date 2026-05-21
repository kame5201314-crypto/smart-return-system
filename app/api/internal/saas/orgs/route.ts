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
import { buildPlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformAdminDataRepository;
}

function parseLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('limit');
  const parsed = raw ? Number.parseInt(raw, 10) : 50;
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function getRepository(deps: HandlerDependencies): PlatformAdminDataRepository {
  return deps.repository ?? createPlatformAdminDataRepository(
    createUntypedAdminClient() as unknown as PlatformAdminQueryClient
  );
}

function getCurrentMonthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function handleListPlatformOrganizations(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess()))();

    const repository = getRepository(deps);
    const organizations = await repository.listOrganizations({
      limit: parseLimit(request),
    });
    const usageByOrgId = await repository.listOrganizationUsage({
      orgIds: organizations.map((org) => org.id),
      periodStart: getCurrentMonthStartIso(),
    });

    return NextResponse.json({
      success: true,
      data: buildPlatformOrganizationListView(organizations, usageByOrgId),
    });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('List platform organizations failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load organizations' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleListPlatformOrganizations(request);
}
