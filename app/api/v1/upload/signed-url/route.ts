import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthenticatedRequest } from '@/lib/auth/request-auth';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_NAME_LENGTH = 255;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
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

function sanitizeFolder(folder: unknown): string | null {
  if (typeof folder !== 'string' || !folder.trim()) {
    return null;
  }

  const normalized = folder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return null;
  }

  if (normalized.includes('..')) {
    return null;
  }

  return normalized;
}

/**
 * Generate signed URL for direct upload to Supabase Storage.
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthenticated = await isAuthenticatedRequest(request);
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { fileName, fileType, folder } = body as {
      fileName?: string;
      fileType?: string;
      folder?: string;
    };

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing fileName' },
        { status: 400 }
      );
    }

    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing fileType' },
        { status: 400 }
      );
    }

    if (!ALLOWED_FILE_TYPES.includes(fileType)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    if (fileName.length > MAX_FILE_NAME_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'File name is too long' },
        { status: 400 }
      );
    }

    const safeFolder = sanitizeFolder(folder);
    if (folder && !safeFolder) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder path' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split('-')[0];
    const fileExt = fileName.split('.').pop() || 'jpg';
    const filePath = safeFolder
      ? `${safeFolder}/${timestamp}_${randomId}.${fileExt}`
      : `uploads/${timestamp}_${randomId}.${fileExt}`;

    const { data, error } = await adminClient.storage
      .from('return-images')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Create signed URL error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create signed URL' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = adminClient.storage
      .from('return-images')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      publicUrl: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error('Signed URL API error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
