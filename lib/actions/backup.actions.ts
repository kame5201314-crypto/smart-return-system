'use server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface BackupRecord {
  id: string;
  backup_name: string;
  backup_type: 'manual' | 'auto';
  file_path: string;
  file_size: number;
  tables_included: string[];
  created_at: string;
}

export interface BackupData {
  metadata: {
    created_at: string;
    backup_type: 'manual' | 'auto';
    tables: string[];
    record_counts: Record<string, number>;
  };
  data: {
    return_requests?: unknown[];
    return_items?: unknown[];
    return_images?: unknown[];
    shopee_returns?: unknown[];
    pickup_records?: unknown[];
  };
}

/**
 * 獲取備份歷史記錄
 */
export async function getBackupHistory(): Promise<ApiResponse<BackupRecord[]>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('backup_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // 如果表不存在，返回空數組
      if (error.code === '42P01') {
        return { success: true, data: [] };
      }
      console.error('Get backup history error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as BackupRecord[]) || [] };
  } catch (error) {
    console.error('Get backup history error:', error);
    return { success: false, error: '獲取備份歷史失敗' };
  }
}

/**
 * 執行備份 - 導出數據
 */
export async function createBackup(
  selectedTables: string[],
  backupType: 'manual' | 'auto' = 'manual',
  pickupRecords?: unknown[] // 從前端傳入的 localStorage 數據
): Promise<ApiResponse<{ data: BackupData; downloadUrl?: string }>> {
  try {
    const supabase = createUntypedAdminClient();
    const backupData: BackupData = {
      metadata: {
        created_at: new Date().toISOString(),
        backup_type: backupType,
        tables: selectedTables,
        record_counts: {},
      },
      data: {},
    };

    // 備份退貨管理相關表
    if (selectedTables.includes('return_management')) {
      // return_requests
      const { data: requests } = await supabase
        .from('return_requests')
        .select('*')
        .order('created_at', { ascending: false });
      backupData.data.return_requests = requests || [];
      backupData.metadata.record_counts.return_requests = requests?.length || 0;

      // return_items
      const { data: items } = await supabase
        .from('return_items')
        .select('*');
      backupData.data.return_items = items || [];
      backupData.metadata.record_counts.return_items = items?.length || 0;

      // return_images
      const { data: images } = await supabase
        .from('return_images')
        .select('*');
      backupData.data.return_images = images || [];
      backupData.metadata.record_counts.return_images = images?.length || 0;
    }

    // 備份蝦皮退貨
    if (selectedTables.includes('shopee_returns')) {
      const { data: shopeeReturns } = await supabase
        .from('shopee_returns')
        .select('*')
        .order('created_at', { ascending: false });
      backupData.data.shopee_returns = shopeeReturns || [];
      backupData.metadata.record_counts.shopee_returns = shopeeReturns?.length || 0;
    }

    // 備份派車收件（從前端傳入）
    if (selectedTables.includes('pickup') && pickupRecords) {
      backupData.data.pickup_records = pickupRecords;
      backupData.metadata.record_counts.pickup_records = pickupRecords.length;
    }

    // 如果是自動備份，存到 Storage
    if (backupType === 'auto') {
      const fileName = `backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
      const filePath = `backups/${fileName}`;
      const jsonString = JSON.stringify(backupData, null, 2);
      const fileSize = new Blob([jsonString]).size;

      // 上傳到 Storage
      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(filePath, jsonString, {
          contentType: 'application/json',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload backup error:', uploadError);
        // 如果 bucket 不存在，嘗試創建
        if (uploadError.message.includes('not found')) {
          return { success: false, error: '請先在 Supabase 創建 backups 儲存桶' };
        }
        return { success: false, error: uploadError.message };
      }

      // 記錄備份歷史
      await supabase.from('backup_records').insert({
        backup_name: fileName,
        backup_type: backupType,
        file_path: filePath,
        file_size: fileSize,
        tables_included: selectedTables,
      });

      // 清理舊備份（保留最近30天）
      await cleanupOldBackups();
    }

    return { success: true, data: { data: backupData } };
  } catch (error) {
    console.error('Create backup error:', error);
    return { success: false, error: '備份失敗' };
  }
}

/**
 * 從 Storage 下載備份
 */
export async function downloadBackup(filePath: string): Promise<ApiResponse<{ url: string }>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase.storage
      .from('backups')
      .createSignedUrl(filePath, 3600); // 1小時有效

    if (error) {
      console.error('Download backup error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { url: data.signedUrl } };
  } catch (error) {
    console.error('Download backup error:', error);
    return { success: false, error: '下載失敗' };
  }
}

/**
 * 刪除備份
 */
export async function deleteBackup(id: string, filePath: string): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    // 刪除 Storage 文件
    await supabase.storage.from('backups').remove([filePath]);

    // 刪除記錄
    const { error } = await supabase
      .from('backup_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete backup record error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete backup error:', error);
    return { success: false, error: '刪除失敗' };
  }
}

/**
 * 清理超過30天的舊備份
 */
async function cleanupOldBackups(): Promise<void> {
  try {
    const supabase = createUntypedAdminClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 獲取要刪除的備份記錄
    const { data: oldBackups } = await supabase
      .from('backup_records')
      .select('id, file_path')
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (oldBackups && oldBackups.length > 0) {
      // 刪除 Storage 文件
      const filePaths = oldBackups.map((b: { file_path: string }) => b.file_path);
      await supabase.storage.from('backups').remove(filePaths);

      // 刪除記錄
      const ids = oldBackups.map((b: { id: string }) => b.id);
      await supabase.from('backup_records').delete().in('id', ids);

      console.log(`Cleaned up ${oldBackups.length} old backups`);
    }
  } catch (error) {
    console.error('Cleanup old backups error:', error);
  }
}

// Helper function
function format(date: Date, formatStr: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return formatStr
    .replace('yyyy', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('dd', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}
