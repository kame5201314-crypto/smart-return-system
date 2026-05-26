import { NextRequest, NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  createPlatformAdminRoleManagementRepository,
  normalizePlatformAdminRoleManagementRequest,
  PlatformAdminRoleManagementError,
  type PlatformAdminRoleManagementQueryClient,
  type PlatformAdminRoleManagementRepository,
} from '@/lib/saas/platform-admin-role-management';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformAdminRoleManagementRepository;
}

function getRepository(deps: HandlerDependencies): PlatformAdminRoleManagementRepository {
  return deps.repository ?? createPlatformAdminRoleManagementRepository(
    createUntypedAdminClient() as unknown as PlatformAdminRoleManagementQueryClient
  );
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PlatformAdminRoleManagementError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

function mapErrorResponse(error: unknown) {
  if (error instanceof PlatformAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof PlatformAdminRoleManagementError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('Platform admin role management failed:', error);
  return NextResponse.json(
    { success: false, error: 'Failed to manage platform admin roles' },
    { status: 500 }
  );
}

export async function handleListPlatformAdminRoles(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'manage_platform_roles',
    })))();

    const limit = Number(new URL(request.url).searchParams.get('limit'));
    const assignments = await getRepository(deps).listRoleAssignments({ limit });

    return NextResponse.json({
      success: true,
      data: {
        assignments,
      },
    });
  } catch (error) {
    return mapErrorResponse(error);
  }
}

export async function handleManagePlatformAdminRole(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'manage_platform_roles',
    })))();
    const payload = await readJsonBody(request);
    const input = normalizePlatformAdminRoleManagementRequest(payload, access.userId);
    const result = await getRepository(deps).manageRoleAssignment(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return mapErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  return handleListPlatformAdminRoles(request);
}

export async function POST(request: NextRequest) {
  return handleManagePlatformAdminRole(request);
}
