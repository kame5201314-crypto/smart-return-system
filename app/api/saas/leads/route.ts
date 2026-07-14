import { NextRequest, NextResponse } from 'next/server';

import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  buildClientRateLimitKey,
  createInMemoryRateLimiter,
} from '@/lib/security/request-rate-limit';
import { SaaSPublicLeadError } from '@/lib/saas/lead-capture';
import { createDefaultSaaSPublicLeadRepository } from '@/lib/saas/lead-capture-repository';
import {
  submitSaaSPublicLead,
  type SaaSPublicLeadRepositoryFactory,
} from '@/lib/saas/lead-capture-service';
import type { SaaSPublicLeadRepository } from '@/lib/saas/lead-capture-repository';

interface HandlerDependencies {
  env?: Record<string, string | undefined>;
  repository?: SaaSPublicLeadRepository | SaaSPublicLeadRepositoryFactory;
}

export const dynamic = 'force-dynamic';

const leadRateLimiter = createInMemoryRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
});

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new SaaSPublicLeadError(
      'invalid_request',
      400,
      'Request body must be valid JSON.'
    );
  }
}

export async function handleSaaSPublicLeadRequest(
  request: NextRequest,
  deps: HandlerDependencies = {}
) {
  try {
    const result = await submitSaaSPublicLead(await readJsonBody(request), {
      env: deps.env,
      repository: deps.repository ?? createDefaultSaaSPublicLeadRepository,
    });

    return NextResponse.json({ success: true, data: result }, { status: 202 });
  } catch (error) {
    if (error instanceof SaaSPublicLeadError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Public lead request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Public lead request failed.',
        code: 'request_failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;

  const rateLimit = leadRateLimiter.check(
    buildClientRateLimitKey({
      scope: 'saas_public_lead',
      headers: request.headers,
    })
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many lead requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
        code: 'rate_limited',
      },
      { status: 429 }
    );
  }

  return handleSaaSPublicLeadRequest(request);
}
