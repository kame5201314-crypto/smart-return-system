'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext, type SaaSOrgContext } from '@/lib/saas/org-context';
import type { ReturnImage } from '@/types/database.types';
import {
  RETURN_IMAGES_BUCKET,
  buildReturnImageStoragePath,
  createReturnImageSignedUrl,
  attachReturnImageSignedUrls,
  removeReturnImageObjects,
} from '@/lib/storage/return-images';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface ImageUploadData {
  returnRequestId: string;
  imageType: 'shipping_label' | 'product_damage' | 'outer_box' | 'inspection' | 'other';
  fileName: string;
  contentType: string;
  base64Data: string;
}

async function getUploadReadOrgContext(): Promise<SaaSOrgContext> {
  return getOrgContext();
}

async function getUploadWritableOrgContext(): Promise<SaaSOrgContext> {
  return getOrgContext({
    requirements: {
      roles: ['owner', 'admin', 'staff'],
      writable: true,
    },
  });
}

// 上傳單張圖片到 Supabase Storage
export async function uploadImage(data: ImageUploadData): Promise<UploadResult> {
  try {
    const orgContext = await getUploadWritableOrgContext();
    const supabase = await createClient();

    // 將 base64 轉換為 Buffer
    const base64Content = data.base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');

    // 生成唯一檔名（org 前綴；舊資料仍可由 storage_path 相容讀取）
    const storagePath = buildReturnImageStoragePath({
      orgId: orgContext.orgId,
      returnRequestId: data.returnRequestId,
      imageType: data.imageType,
      extension: data.fileName.split('.').pop(),
    });

    // 上傳到 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(RETURN_IMAGES_BUCKET)
      .upload(storagePath, buffer, {
        contentType: data.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return {
        success: false,
        error: uploadError.message || '上傳失敗',
      };
    }

    // 以 storage_path 為主，回傳短效 signed URL 供即時預覽，不再依賴永久 public URL
    const signedUrl = await createReturnImageSignedUrl(storagePath);

    return {
      success: true,
      url: signedUrl ?? undefined,
      path: storagePath,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '上傳失敗',
    };
  }
}

// 批次上傳多張圖片
export async function uploadMultipleImages(
  images: ImageUploadData[]
): Promise<{ success: boolean; results: UploadResult[]; error?: string }> {
  try {
    const results = await Promise.all(images.map(uploadImage));

    const failedCount = results.filter((r) => !r.success).length;

    if (failedCount > 0) {
      return {
        success: false,
        results,
        error: `${failedCount} 張圖片上傳失敗`,
      };
    }

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('Batch upload error:', error);
    return {
      success: false,
      results: [],
      error: '批次上傳失敗',
    };
  }
}

// 儲存圖片記錄到資料庫
export async function saveImageRecord(data: {
  returnRequestId: string;
  imageUrl: string;
  storagePath: string;
  imageType: string;
  fileName: string;
  fileSize: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const orgContext = await getUploadWritableOrgContext();
    const supabase = createAdminClient();

    const { data: record, error } = await supabase
      .from('return_images')
      .insert({
        org_id: orgContext.orgId,
        return_request_id: data.returnRequestId,
        image_url: data.imageUrl,
        storage_path: data.storagePath,
        image_type: data.imageType,
        file_name: data.fileName,
        file_size: data.fileSize,
      } as never)
      .select('id')
      .single() as { data: { id: string } | null; error: Error | null };

    if (error || !record) {
      console.error('Save image record error:', error);
      return {
        success: false,
        error: '儲存圖片記錄失敗',
      };
    }

    return {
      success: true,
      id: record.id,
    };
  } catch (error) {
    console.error('Save image record error:', error);
    return {
      success: false,
      error: '儲存圖片記錄失敗',
    };
  }
}

// 刪除圖片（org-scoped；storage path 一律從 DB 推導，不接受 caller 傳入路徑）
export async function deleteImage(
  imageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgContext = await getUploadWritableOrgContext();
    const supabase = createAdminClient();

    // 先用 imageId + org_id 取出實際 storage_path / image_url，不採信外部路徑
    const { data: row, error: fetchError } = await supabase
      .from('return_images')
      .select('storage_path, image_url')
      .eq('id', imageId)
      .eq('org_id', orgContext.orgId)
      .single() as {
        data: { storage_path: string | null; image_url: string | null } | null;
        error: Error | null;
      };

    if (fetchError || !row) {
      return {
        success: false,
        error: '刪除圖片記錄失敗',
      };
    }

    // 先刪 DB 記錄（org-scoped），成功後再 best-effort 移除 Storage 檔案
    const { error: dbError } = await supabase
      .from('return_images')
      .delete()
      .eq('org_id', orgContext.orgId)
      .eq('id', imageId);

    if (dbError) {
      console.error('Delete from database error:', dbError);
      return {
        success: false,
        error: '刪除圖片記錄失敗',
      };
    }

    const storageCleanup = await removeReturnImageObjects([row]);
    if (storageCleanup.error) {
      console.error('Delete from storage error (best-effort):', storageCleanup.error);
    }

    return { success: true };
  } catch (error) {
    console.error('Delete image error:', error);
    return {
      success: false,
      error: '刪除圖片失敗',
    };
  }
}

// 取得退貨申請的所有圖片
export async function getReturnImages(
  returnRequestId: string
): Promise<{ success: boolean; images?: ReturnImage[]; error?: string }> {
  try {
    const orgContext = await getUploadReadOrgContext();
    const supabase = createAdminClient();

    const { data: images, error } = await supabase
      .from('return_images')
      .select('*')
      .eq('org_id', orgContext.orgId)
      .eq('return_request_id', returnRequestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get images error:', error);
      return {
        success: false,
        error: '取得圖片失敗',
      };
    }

    // 以短效 signed URL 取代永久 public URL（rows 已 org-scoped）
    await attachReturnImageSignedUrls(images as ReturnImage[] | null);

    return {
      success: true,
      images: images || [],
    };
  } catch (error) {
    console.error('Get images error:', error);
    return {
      success: false,
      error: '取得圖片失敗',
    };
  }
}
