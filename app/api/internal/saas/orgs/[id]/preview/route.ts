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
import {
  createPlatformTenantPreviewAuditRepository,
  createPlatformTenantPreviewToken,
  PLATFORM_TENANT_PREVIEW_COOKIE,
  PLATFORM_TENANT_PREVIEW_COOKIE_OPTIONS,
  type PlatformTenantPreviewAuditQueryClient,
  type PlatformTenantPreviewAuditRepository,
} from '@/lib/saas/platform-tenant-preview';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformAdminDataRepository;
  auditRepository?: PlatformTenantPreviewAuditRepository;
}

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

function getRepository(deps: HandlerDependencies): PlatformAdminDataRepository {
  return deps.repository ?? createPlatformAdminDataRepository(
    createUntypedAdminClient() as unknown as PlatformAdminQueryClient
  );
}

function getAuditRepository(deps: HandlerDependencies): PlatformTenantPreviewAuditRepository {
  return deps.auditRepository ?? createPlatformTenantPreviewAuditRepository(
    createUntypedAdminClient() as unknown as PlatformTenantPreviewAuditQueryClient
  );
}

function normalizeOrgId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function errorResponse(error: unknown) {
  if (error instanceof PlatformAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('Platform tenant preview failed:', error);
  return NextResponse.json(
    { success: false, error: 'Failed to start platform tenant preview' },
    { status: 500 }
  );
}

export async function handleStartPlatformTenantPreview(
  orgId: string | null | undefined,
  deps: HandlerDependencies = {}
) {
  try {
    const normalizedOrgId = normalizeOrgId(orgId);
    if (!normalizedOrgId) {
      return NextResponse.json(
        { success: false, error: 'A valid organization id is required.', code: 'invalid_request' },
        { status: 400 }
      );
    }

    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_organizations',
    })))();
    const organization = await getRepository(deps).getOrganization({ orgId: normalizedOrgId });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.', code: 'not_found' },
        { status: 404 }
      );
    }

    const { token, payload } = await createPlatformTenantPreviewToken({
      access,
      organization,
    });
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    const auditResult = await getAuditRepository(deps).recordPreviewAudit({
      action: 'platform.tenant_preview_started',
      access,
      target: {
        orgId: payload.orgId,
        orgName: payload.orgName,
        orgSlug: payload.orgSlug,
      },
      previewExpiresAt: expiresAt,
      reason: 'started',
    });
    const response = NextResponse.json({
      success: true,
      data: {
        orgId: payload.orgId,
        orgName: payload.orgName,
        orgSlug: payload.orgSlug,
        adminUserId: payload.adminUserId,
        platformRole: payload.platformRole,
        previewPath: '/analytics',
        expiresAt,
        auditLogId: auditResult.auditLogId,
      },
    });

    response.cookies.set(
      PLATFORM_TENANT_PREVIEW_COOKIE,
      token,
      PLATFORM_TENANT_PREVIEW_COOKIE_OPTIONS
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return handleStartPlatformTenantPreview(params.id);
}
