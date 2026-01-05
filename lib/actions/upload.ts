'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

// 上傳單張圖片到 Supabase Storage
export async function uploadImage(data: ImageUploadData): Promise<UploadResult> {
  try {
    const supabase = await createClient();

    // 將 base64 轉換為 Buffer
    const base64Content = data.base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');

    // 生成唯一檔名
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = data.fileName.split('.').pop() || 'jpg';
    const storagePath = `returns/${data.returnRequestId}/${data.imageType}_${timestamp}_${randomId}.${extension}`;

    // 上傳到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('return-images')
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

    // 獲取公開 URL
    const { data: publicUrl } = supabase.storage
      .from('return-images')
      .getPublicUrl(storagePath);

    return {
      success: true,
      url: publicUrl.publicUrl,
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
    const supabase = createAdminClient();

    const { data: record, error } = await supabase
      .from('return_images')
      .insert({
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

// 刪除圖片（從 Storage 和資料庫）
export async function deleteImage(
  imageId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // 從 Storage 刪除
    const { error: storageError } = await supabase.storage
      .from('return-images')
      .remove([storagePath]);

    if (storageError) {
      console.error('Delete from storage error:', storageError);
    }

    // 從資料庫刪除記錄
    const { error: dbError } = await supabase
      .from('return_images')
      .delete()
      .eq('id', imageId);

    if (dbError) {
      console.error('Delete from database error:', dbError);
      return {
        success: false,
        error: '刪除圖片記錄失敗',
      };
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
): Promise<{ success: boolean; images?: any[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: images, error } = await supabase
      .from('return_images')
      .select('*')
      .eq('return_request_id', returnRequestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get images error:', error);
      return {
        success: false,
        error: '取得圖片失敗',
      };
    }

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
