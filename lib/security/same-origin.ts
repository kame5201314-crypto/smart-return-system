import { NextRequest, NextResponse } from 'next/server';

export const CROSS_SITE_REQUEST_ERROR_CODE = 'cross_site_request';

export interface SameOriginCheckInput {
  requestUrl: string;
  headers: Pick<Headers, 'get'>;
  env?: Record<string, string | undefined>;
}

export interface SameOriginCheckResult {
  allowed: boolean;
  reason: string;
}

function originFromUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildAllowedOrigins(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env
): string[] {
  return Array.from(
    new Set(
      [
        originFromUrl(requestUrl),
        originFromUrl(env.NEXT_PUBLIC_APP_URL),
      ].filter((origin): origin is string => Boolean(origin))
    )
  );
}

function headerOrigin(headers: Pick<Headers, 'get'>, name: string): string | null {
  const rawValue = headers.get(name);
  if (!rawValue) {
    return null;
  }
  return originFromUrl(rawValue);
}

export function checkSameOriginRequest(
  input: SameOriginCheckInput
): SameOriginCheckResult {
  const secFetchSite = input.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    return {
      allowed: false,
      reason: 'Cross-site requests are not allowed.',
    };
  }

  const allowedOrigins = buildAllowedOrigins(input.requestUrl, input.env);
  const rawOrigin = input.headers.get('origin');
  if (rawOrigin) {
    const origin = headerOrigin(input.headers, 'origin');
    return {
      allowed: Boolean(origin && allowedOrigins.includes(origin)),
      reason: origin
        ? 'Origin must match this application.'
        : 'Origin header is invalid.',
    };
  }

  const rawReferer = input.headers.get('referer');
  if (rawReferer) {
    const refererOrigin = headerOrigin(input.headers, 'referer');
    return {
      allowed: Boolean(refererOrigin && allowedOrigins.includes(refererOrigin)),
      reason: refererOrigin
        ? 'Referer must match this application.'
        : 'Referer header is invalid.',
    };
  }

  return {
    allowed: true,
    reason: 'No browser origin headers were present.',
  };
}

export function rejectCrossSiteRequest(request: NextRequest): NextResponse | null {
  const result = checkSameOriginRequest({
    requestUrl: request.url,
    headers: request.headers,
  });

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: result.reason,
      code: CROSS_SITE_REQUEST_ERROR_CODE,
    },
    { status: 403 }
  );
}
