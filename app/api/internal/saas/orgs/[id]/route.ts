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

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformAdminDataRepository;
}

function getRepository(deps: HandlerDependencies): PlatformAdminDataRepository {
  return deps.repository ?? createPlatformAdminDataRepository(
    createUntypedAdminClient() as unknown as PlatformAdminQueryClient
  );
}

export async function handleGetPlatformOrganization(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: HandlerDependencies = {}
) {
  try {
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess()))();

    const { id } = await context.params;
    const organization = await getRepository(deps).getOrganization({ orgId: id });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: organization,
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
