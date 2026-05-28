import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import {
  createUploadSessionToken,
  UPLOAD_ALLOWED_FOLDERS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_TOTAL_FILES,
} from '@/lib/upload/security';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

function normalizeDraftId(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const value = input.trim();
  if (!value) {
    return null;
  }

  // UUID v4-ish format
  if (!/^[a-f0-9-]{32,36}$/i.test(value)) {
    return null;
  }

  return value;
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) {
    return crossSiteResponse;
  }

  try {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const rateKey = `${clientIP}|${userAgent}`;
    const rateCheck = checkRateLimit(rateKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: 'Too many session requests. Please try again later.',
        },
        { status: 429 }
      );
    }

    let body: { draftId?: string } = {};
    try {
      body = await request.json() as { draftId?: string };
    } catch {
      // Allow empty body for easier client integration
      body = {};
    }

    const requestedDraftId = normalizeDraftId(body.draftId);
    const draftId = requestedDraftId || crypto.randomUUID();
    const tokenResult = createUploadSessionToken({ draftId });

    if (!tokenResult.token || !tokenResult.payload) {
      return NextResponse.json(
        {
          success: false,
          code: 'SERVER_CONFIG_ERROR',
          error: tokenResult.error || 'Failed to create upload session.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      draftId,
      sessionToken: tokenResult.token,
      expiresAt: tokenResult.payload.exp * 1000,
      maxFiles: UPLOAD_MAX_TOTAL_FILES,
      maxFileSizeBytes: UPLOAD_MAX_FILE_SIZE_BYTES,
      allowedFolders: [...UPLOAD_ALLOWED_FOLDERS],
    });
  } catch (error) {
    console.error('Upload session API error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', error: 'Server error' },
      { status: 500 }
    );
  }
}
