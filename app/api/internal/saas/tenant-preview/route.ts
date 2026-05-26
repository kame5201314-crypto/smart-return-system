import { NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import {
  createPlatformTenantPreviewAuditRepository,
  loadPlatformTenantPreviewMode,
  PLATFORM_TENANT_PREVIEW_COOKIE,
  type PlatformTenantPreviewAuditQueryClient,
  type PlatformTenantPreviewAuditRepository,
} from '@/lib/saas/platform-tenant-preview';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  getToken?: (() => Promise<string | undefined | null>) | string | undefined | null;
  auditRepository?: PlatformTenantPreviewAuditRepository;
}

function getAuditRepository(deps: HandlerDependencies): PlatformTenantPreviewAuditRepository {
  return deps.auditRepository ?? createPlatformTenantPreviewAuditRepository(
    createUntypedAdminClient() as unknown as PlatformTenantPreviewAuditQueryClient
  );
}

function mapAccessError(error: unknown) {
  if (error instanceof PlatformAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('Platform tenant preview route failed:', error);
  return NextResponse.json(
    { success: false, error: 'Failed to load platform tenant preview state' },
    { status: 500 }
  );
}

export async function handleGetPlatformTenantPreview(deps: HandlerDependencies = {}) {
  try {
    const requireAccess = deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_organizations',
    }));
    const state = await loadPlatformTenantPreviewMode({
      requireAccess: async () => requireAccess(),
      getToken: deps.getToken,
    });

    return NextResponse.json({
      success: true,
      data: state,
    });
  } catch (error) {
    return mapAccessError(error);
  }
}

export async function handleClearPlatformTenantPreview(deps: HandlerDependencies = {}) {
  try {
    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_organizations',
    })))();
    const state = await loadPlatformTenantPreviewMode({
      requireAccess: async () => access,
      getToken: deps.getToken,
    });
    let auditLogId: string | null = null;

    try {
      const auditResult = await getAuditRepository(deps).recordPreviewAudit({
        action: 'platform.tenant_preview_cleared',
        access,
        target: state.state === 'ready'
          ? {
              orgId: state.preview.orgId,
              orgName: state.preview.orgName,
              orgSlug: state.preview.orgSlug,
            }
          : null,
        previewExpiresAt: state.state === 'ready' ? state.preview.expiresAt : null,
        reason: state.state === 'ready' ? 'cleared' : state.reason,
      });
      auditLogId = auditResult.auditLogId;
    } catch (auditError) {
      console.error('Platform tenant preview clear audit failed:', auditError);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        state: 'hidden',
        reason: 'cleared',
        auditLogId,
      },
    });

    response.cookies.delete(PLATFORM_TENANT_PREVIEW_COOKIE);
    return response;
  } catch (error) {
    return mapAccessError(error);
  }
}

export async function GET() {
  return handleGetPlatformTenantPreview();
}

export async function DELETE() {
  return handleClearPlatformTenantPreview();
}
