import { NextRequest, NextResponse } from 'next/server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import {
  createPlatformBillingOperationsRepository,
  normalizePlatformBillingOperationRequest,
  PlatformBillingOperationError,
  type PlatformBillingOperationsRepository,
} from '@/lib/saas/platform-admin-billing-operations';
import {
  PlatformAdminAccessError,
  requirePlatformAdminAccess,
  type PlatformAdminContext,
} from '@/lib/saas/platform-admin';

interface HandlerDependencies {
  requireAccess?: () => Promise<PlatformAdminContext>;
  repository?: PlatformBillingOperationsRepository;
}

function getRepository(deps: HandlerDependencies): PlatformBillingOperationsRepository {
  return deps.repository ?? createPlatformBillingOperationsRepository(
    createUntypedAdminClient()
  );
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PlatformBillingOperationError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handlePlatformBillingOperation(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const access = await (deps.requireAccess ?? (() => requirePlatformAdminAccess({
      requiredPermission: 'manage_billing_operations',
    })))();
    const payload = await readJsonBody(request);
    const input = normalizePlatformBillingOperationRequest(payload, access.userId);
    const result = await getRepository(deps).performBillingOperation(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof PlatformAdminAccessError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (error instanceof PlatformBillingOperationError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Platform billing operation failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform platform billing operation' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handlePlatformBillingOperation(request);
}
