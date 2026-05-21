import { NextRequest, NextResponse } from 'next/server';

import {
  SaaSPublicSignupRequestError,
  submitSaaSPublicSignupRequest,
  type SaaSPublicSignupRequestRepository,
  type SaaSPublicSignupRequestRepositoryFactory,
} from '@/lib/saas/signup-request';
import { createDefaultSaaSPublicSignupRequestRepository } from '@/lib/saas/signup-request-repository';

interface HandlerDependencies {
  env?: Record<string, string | undefined>;
  repository?:
    | SaaSPublicSignupRequestRepository
    | SaaSPublicSignupRequestRepositoryFactory;
}

export const dynamic = 'force-dynamic';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SaaSPublicSignupRequestError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleSaaSPublicSignupRequest(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const payload = await readJsonBody(request);
    const result = await submitSaaSPublicSignupRequest(payload, {
      env: deps.env,
      repository:
        deps.repository ?? createDefaultSaaSPublicSignupRequestRepository,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof SaaSPublicSignupRequestError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    console.error('Public signup request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Public signup request failed.',
        code: 'request_failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleSaaSPublicSignupRequest(request);
}
