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
import { buildPlatformBillingEventsView } from '@/lib/saas/ui-backend-contracts';

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

export async function handleListPlatformBillingEvents(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'view_billing_events',
    })))();

    const repository = getRepository(deps);
    const events = await repository.listBillingEvents({
      limit: parseLimit(request),
    });
    const orgNamesById = await repository.listOrganizationNames({
      orgIds: Array.from(new Set(events.map((event) => event.orgId))),
    });

    return NextResponse.json({
      success: true,
      data: buildPlatformBillingEventsView(events, orgNamesById),
    });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('List platform billing events failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load billing events' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleListPlatformBillingEvents(request);
}
