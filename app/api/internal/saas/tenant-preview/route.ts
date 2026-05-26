import { NextResponse } from 'next/server';

import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import {
  loadPlatformTenantPreviewMode,
  PLATFORM_TENANT_PREVIEW_COOKIE,
} from '@/lib/saas/platform-tenant-preview';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  getToken?: (() => Promise<string | undefined | null>) | string | undefined | null;
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
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_organizations',
    })))();
    const response = NextResponse.json({
      success: true,
      data: {
        state: 'hidden',
        reason: 'cleared',
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
