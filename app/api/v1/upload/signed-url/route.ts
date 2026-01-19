import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Generate signed URL for direct upload to Supabase Storage
 * This bypasses the server action size limit
 */
export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, folder } = await request.json();

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: '缺少必要參數' },
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
        { error: '建立上傳連結失敗' },
        { status: 500 }
      );
    }

    // Get public URL for the file
    const { data: publicUrlData } = adminClient.storage
      .from('return-images')
      .getPublicUrl(filePath);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      publicUrl: publicUrlData.publicUrl,
    });
  } catch (error) {
    console.error('Signed URL API error:', error);
    return NextResponse.json(
      { error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
