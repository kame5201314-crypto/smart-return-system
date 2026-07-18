import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  createPlatformAdminRoleManagementRepository,
  normalizePlatformAdminRoleManagementRequest,
  PlatformAdminRoleManagementError,
  type PlatformAdminRoleManagementQueryClient,
  type PlatformAdminRoleManagementRepository,
  type PlatformAdminRoleAssignment,
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

function isRoleSchemaUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('platform_admin_roles') ||
    message.includes('manage_platform_admin_role') ||
    message.includes('schema cache')
  );
}

function buildRuntimeRoleAssignment(access: PlatformAdminContext): PlatformAdminRoleAssignment {
  const principalType = access.userEmail ? 'email' as const : 'user_id' as const;
  return {
    id: `runtime:${access.userId}`,
    principalType,
    principal: access.userEmail ?? access.userId,
    role: access.platformRole,
    status: 'active',
    note: '目前由執行環境提供平台管理權限；資料庫角色管理尚未開通。',
    createdBy: null,
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
  };
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
    if (isRoleSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          success: false,
          error: '資料庫角色管理尚未開通，請先完成對應資料庫設定。',
          code: 'schema_not_ready',
        },
        { status: 503 }
      );
    }
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
    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'manage_platform_roles',
    })))();

    const limit = Number(new URL(request.url).searchParams.get('limit'));
    let assignments: PlatformAdminRoleAssignment[];
    try {
      assignments = await getRepository(deps).listRoleAssignments({ limit });
    } catch (error) {
      if (!isRoleSchemaUnavailable(error)) throw error;

      return NextResponse.json({
        success: true,
        data: {
          assignments: [buildRuntimeRoleAssignment(access)],
          source: 'runtime_access',
          managementReady: false,
          message: '目前使用執行環境的管理員權限；資料庫角色管理尚未開通。',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        assignments,
        source: 'database',
        managementReady: true,
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
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) {
    return crossSiteResponse;
  }

  return handleManagePlatformAdminRole(request);
}
