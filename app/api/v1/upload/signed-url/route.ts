import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ========== 速率限制 ==========
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 分鐘
const RATE_LIMIT_MAX_REQUESTS = 20; // 每分鐘最多 20 次（配合圖片上傳）

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

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

// 定期清理過期記錄
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

// 允許的檔案類型
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_NAME_LENGTH = 255;

/**
 * Generate signed URL for direct upload to Supabase Storage
 * This bypasses the server action size limit
 */
export async function POST(request: NextRequest) {
  try {
    // 速率限制檢查
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: '請求過於頻繁，請稍後再試' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { fileName, fileType, folder } = body;

    // 參數驗證
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { success: false, error: '缺少檔案名稱' },
        { status: 400 }
      );
    }

    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json(
        { success: false, error: '缺少檔案類型' },
        { status: 400 }
      );
    }

    // 檔案類型驗證
    if (!ALLOWED_FILE_TYPES.includes(fileType)) {
      return NextResponse.json(
        { success: false, error: '不支援的檔案類型，僅允許 JPEG、PNG、GIF、WebP' },
        { status: 400 }
      );
    }

    // 檔案名稱長度驗證
    if (fileName.length > MAX_FILE_NAME_LENGTH) {
      return NextResponse.json(
        { success: false, error: '檔案名稱過長' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileExt = fileName.split('.').pop() || 'jpg';
    const filePath = folder
      ? `${folder}/${timestamp}_${randomId}.${fileExt}`
      : `uploads/${timestamp}_${randomId}.${fileExt}`;

    // Create signed URL for upload (valid for 5 minutes)
    const { data, error } = await adminClient.storage
      .from('return-images')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Create signed URL error:', error);
      return NextResponse.json(
        { success: false, error: '建立上傳連結失敗' },
        { status: 500 }
      );
    }

    // Get public URL for the file
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
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
