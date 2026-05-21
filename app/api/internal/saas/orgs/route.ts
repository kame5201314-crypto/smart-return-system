import { NextRequest, NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  createPlatformAdminDataRepository,
  type PlatformAdminDataRepository,
  type PlatformAdminQueryClient,
} from '@/lib/saas/platform-admin-data';
import {
  createPlatformOrgProvisioningRepository,
  normalizeManualBetaOrganizationInput,
  PlatformOrgProvisioningError,
  type PlatformOrgProvisioningRepository,
} from '@/lib/saas/platform-admin-provisioning';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { buildPlatformOrganizationListView } from '@/lib/saas/ui-backend-contracts';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformAdminDataRepository;
  provisioningRepository?: PlatformOrgProvisioningRepository;
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

function getProvisioningRepository(
  deps: HandlerDependencies
): PlatformOrgProvisioningRepository {
  return deps.provisioningRepository ?? createPlatformOrgProvisioningRepository(
    createUntypedAdminClient()
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

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PlatformOrgProvisioningError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleCreateManualBetaOrganization(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess()))();
    const payload = await readJsonBody(request);
    const input = normalizeManualBetaOrganizationInput(payload, access.userId);
    const result = await getProvisioningRepository(deps).createManualBetaOrganization(input);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (error instanceof PlatformOrgProvisioningError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Create manual Beta organization failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create manual Beta organization' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleListPlatformOrganizations(request);
}

export async function POST(request: NextRequest) {
  return handleCreateManualBetaOrganization(request);
}
