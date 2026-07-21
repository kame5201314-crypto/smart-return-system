import { NextRequest, NextResponse } from 'next/server';

import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  createCustomPlanOfferRepository,
  CustomPlanOfferError,
  normalizeCancelCustomPlanOfferInput,
  normalizeCreateCustomPlanOfferInput,
  type CustomPlanOfferQueryClient,
  type CustomPlanOfferRepository,
} from '@/lib/saas/custom-plan-offers';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';
import { createUntypedAdminClient } from '@/lib/supabase/admin';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: CustomPlanOfferRepository;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRepository(deps: HandlerDependencies): CustomPlanOfferRepository {
  return deps.repository ?? createCustomPlanOfferRepository(
    createUntypedAdminClient() as unknown as CustomPlanOfferQueryClient
  );
}

function requireAccess(deps: HandlerDependencies): Promise<PlatformAdminContext> {
  return (deps.requireAccess ?? (() => requirePlatformAdminAccess({
    requiredPermission: 'manage_billing_operations',
  })))();
}

function noStoreJson(body: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

function requireOrgId(value: string | null): string {
  const normalized = value?.trim() ?? '';
  if (!UUID_PATTERN.test(normalized)) {
    throw new CustomPlanOfferError('invalid_request', 400, 'orgId must be a valid UUID.');
  }
  return normalized;
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CustomPlanOfferError('invalid_request', 400, 'Request body must be valid JSON.');
  }
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof PlatformAdminAccessError) {
    return noStoreJson(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof CustomPlanOfferError) {
    return noStoreJson(
      { success: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  console.error('Custom plan offer operation failed:', error);
  return noStoreJson(
    { success: false, error: 'Failed to manage custom plan offers' },
    { status: 500 }
  );
}

export async function handleListCustomPlanOffers(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    await requireAccess(deps);
    const orgId = requireOrgId(request.nextUrl.searchParams.get('orgId'));
    const offers = await getRepository(deps).listOffers({ orgId, limit: 20 });

    return noStoreJson({ success: true, data: { offers } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleCreateCustomPlanOffer(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const access = await requireAccess(deps);
    const payload = await readJsonBody(request);
    const input = normalizeCreateCustomPlanOfferInput(payload, {
      userId: access.userId,
      platformRole: access.platformRole,
    });
    const offer = await getRepository(deps).createOffer(input);

    return noStoreJson({ success: true, data: { offer } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleCancelCustomPlanOffer(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const access = await requireAccess(deps);
    const payload = await readJsonBody(request);
    const input = normalizeCancelCustomPlanOfferInput(payload, {
      userId: access.userId,
      platformRole: access.platformRole,
    });
    const offer = await getRepository(deps).cancelOffer(input);

    return noStoreJson({ success: true, data: { offer } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;
  return handleListCustomPlanOffers(request);
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;
  return handleCreateCustomPlanOffer(request);
}

export async function DELETE(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;
  return handleCancelCustomPlanOffer(request);
}
