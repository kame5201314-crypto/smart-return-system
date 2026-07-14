import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteRequest } from '@/lib/security/same-origin';
import { getOrgContext } from '@/lib/saas/org-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReturnImageStorageReference } from '@/lib/storage/return-images';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  getExtensionFromFileName,
  sanitizeUploadFolder,
  verifyUploadSessionToken,
  UPLOAD_MAX_FILE_SIZE_BYTES,
} from '@/lib/upload/security';

const globalRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const draftRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const draftUploadCountMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const GLOBAL_RATE_LIMIT_MAX_REQUESTS = 40;
const DRAFT_RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_FILE_NAME_LENGTH = 255;

function checkRateLimit(
  map: Map<string, { count: number; resetTime: number }>,
  key: string,
  maxRequests: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = map.get(key);

  if (!record || now > record.resetTime) {
    map.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

function reserveDraftUploadSlot(
  draftId: string,
  maxFiles: number,
  sessionExpiresAtMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = draftUploadCountMap.get(draftId);

  if (!record || now > record.resetTime) {
    draftUploadCountMap.set(draftId, {
      count: 1,
      resetTime: sessionExpiresAtMs,
    });
    return { allowed: true, remaining: maxFiles - 1 };
  }

  if (record.count >= maxFiles) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxFiles - record.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of globalRateLimitMap.entries()) {
    if (now > value.resetTime) {
      globalRateLimitMap.delete(key);
    }
  }
  for (const [key, value] of draftRateLimitMap.entries()) {
    if (now > value.resetTime) {
      draftRateLimitMap.delete(key);
    }
  }
  for (const [key, value] of draftUploadCountMap.entries()) {
    if (now > value.resetTime) {
      draftUploadCountMap.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Generate signed URL for direct upload to Supabase Storage.
 */
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

    const globalRateCheck = checkRateLimit(
      globalRateLimitMap,
      `${clientIP}|${userAgent}`,
      GLOBAL_RATE_LIMIT_MAX_REQUESTS
    );
    if (!globalRateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: 'Too many upload requests. Please try again later.',
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      fileName,
      fileType,
      fileSize,
      folder,
      draftId,
      sessionToken,
    } = body as {
      fileName?: string;
      fileType?: string;
      fileSize?: number;
      folder?: string;
      draftId?: string;
      sessionToken?: string;
    };

    if (!draftId || typeof draftId !== 'string') {
      return NextResponse.json(
        { success: false, code: 'MISSING_DRAFT_ID', error: 'Missing draftId.' },
        { status: 400 }
      );
    }

    const sessionVerification = verifyUploadSessionToken(sessionToken);
    if (!sessionVerification.valid || !sessionVerification.payload) {
      return NextResponse.json(
        {
          success: false,
          code: sessionVerification.code || 'INVALID_SESSION',
          error: sessionVerification.error || 'Upload session verification failed.',
        },
        { status: 401 }
      );
    }

    if (sessionVerification.payload.draftId !== draftId) {
      return NextResponse.json(
        {
          success: false,
          code: 'DRAFT_SESSION_MISMATCH',
          error: 'draftId does not match upload session.',
        },
        { status: 401 }
      );
    }

    const draftRateCheck = checkRateLimit(
      draftRateLimitMap,
      draftId,
      DRAFT_RATE_LIMIT_MAX_REQUESTS
    );
    if (!draftRateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'DRAFT_RATE_LIMITED',
          error: 'Too many upload attempts for this draft. Please try again later.',
        },
        { status: 429 }
      );
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { success: false, code: 'MISSING_FILE_NAME', error: 'Missing fileName.' },
        { status: 400 }
      );
    }

    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json(
        { success: false, code: 'MISSING_FILE_TYPE', error: 'Missing fileType.' },
        { status: 400 }
      );
    }

    if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'FILE_SIZE_INVALID',
          error: 'Invalid file size.',
          details: 'Please re-select the image and try again.',
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(fileType as typeof ALLOWED_IMAGE_MIME_TYPES[number])) {
      return NextResponse.json(
        {
          success: false,
          code: 'FILE_TYPE_INVALID',
          error: `Unsupported file type: ${fileType}`,
          details: 'Only JPG, PNG, GIF, WebP, and HEIC are allowed.',
        },
        { status: 400 }
      );
    }

    const maxFileSize = Math.min(
      sessionVerification.payload.maxFileSizeBytes,
      UPLOAD_MAX_FILE_SIZE_BYTES
    );
    if (fileSize > maxFileSize) {
      return NextResponse.json(
        {
          success: false,
          code: 'FILE_TOO_LARGE',
          error: `File is too large. Max ${Math.floor(maxFileSize / (1024 * 1024))}MB.`,
          details: `Current file size is about ${Math.ceil(fileSize / 1024 / 1024)}MB.`,
        },
        { status: 400 }
      );
    }

    if (fileName.length > MAX_FILE_NAME_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          code: 'FILE_NAME_TOO_LONG',
          error: 'File name is too long.',
          details: `File name must be <= ${MAX_FILE_NAME_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    const safeFolder = sanitizeUploadFolder(folder);
    if (folder && !safeFolder) {
      return NextResponse.json(
        {
          success: false,
          code: 'FOLDER_INVALID',
          error: 'Invalid folder path.',
          details: 'Please refresh and try again.',
        },
        { status: 400 }
      );
    }

    if (!safeFolder || !sessionVerification.payload.allowedFolders.includes(safeFolder)) {
      return NextResponse.json(
        {
          success: false,
          code: 'FOLDER_NOT_ALLOWED',
          error: `Folder is not allowed: ${safeFolder || 'unknown'}`,
        },
        { status: 400 }
      );
    }

    const slot = reserveDraftUploadSlot(
      draftId,
      sessionVerification.payload.maxFiles,
      sessionVerification.payload.exp * 1000
    );
    if (!slot.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'MAX_FILES_REACHED',
          error: `Maximum files reached for this draft (${sessionVerification.payload.maxFiles}).`,
        },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split('-')[0];
    const fileExt = getExtensionFromFileName(fileName);
    const tokenOrgId = typeof sessionVerification.payload.orgId === 'string'
      ? sessionVerification.payload.orgId.trim()
      : '';
    let orgId = tokenOrgId || null;

    if (!orgId) {
      try {
        const orgContext = await getOrgContext({
          requirements: {
            roles: ['owner', 'admin', 'staff'],
            writable: true,
          },
        });
        orgId = orgContext.orgId;
      } catch {
        orgId = null;
      }
    }

    const stagingRoot = orgId ? `staging/${orgId}/${draftId}` : `staging/${draftId}`;
    const filePath = `${stagingRoot}/${safeFolder}/${timestamp}_${randomId}.${fileExt}`;

    const { data, error } = await adminClient.storage
      .from('return-images')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Create signed URL error:', error);
      return NextResponse.json(
        {
          success: false,
          code: 'SIGNED_URL_CREATE_FAILED',
          error: 'Failed to create signed upload URL.',
        },
        { status: 500 }
      );
    }

    const imageUrl = buildReturnImageStorageReference(filePath);

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      imageUrl,
      publicUrl: imageUrl,
      remainingFiles: slot.remaining,
    });
  } catch (error) {
    console.error('Signed URL API error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', error: 'Server error' },
      { status: 500 }
    );
  }
}
