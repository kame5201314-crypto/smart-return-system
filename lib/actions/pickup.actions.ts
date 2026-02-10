'use server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface PickupRecord {
  id: string;
  process_date: string;
  order_number: string;
  tracking_number: string | null;
  platform: string;
  logistics_provider: string;
  delivery_status: string;
  received_status: string;
  notes: string | null;
  receiver_info: string | null;
  is_printed: boolean;
  created_at: string;
  updated_at: string;
}

export interface PickupRecordInput {
  process_date: string;
  order_number: string;
  tracking_number?: string;
  platform: string;
  logistics_provider: string;
  delivery_status: string;
  received_status: string;
  notes?: string;
  receiver_info?: string;
}

/**
 * Import pickup records (batch insert)
 * Note: pickup_records currently has no unique constraint. This function only deduplicates within the uploaded file.
 */
export async function importPickupRecords(
  items: PickupRecordInput[]
): Promise<ApiResponse<{ imported: number; duplicates: number }>> {
  try {
    const supabase = createUntypedAdminClient();

    if (!items || items.length === 0) {
      return { success: true, data: { imported: 0, duplicates: 0 } };
    }

    // Deduplicate within file by (process_date + order_number + tracking_number)
    const seenKeys = new Set<string>();
    const deduplicated: PickupRecordInput[] = [];
    let duplicates = 0;

    for (const raw of items) {
      const process_date = raw.process_date?.trim();
      const order_number = raw.order_number?.trim();
      const tracking_number = raw.tracking_number?.trim() || '';

      if (!process_date || !order_number) continue;

      const key = `${process_date}__${order_number}__${tracking_number}`;
      if (seenKeys.has(key)) {
        duplicates++;
        continue;
      }

      seenKeys.add(key);
      deduplicated.push({
        process_date,
        order_number,
        tracking_number: tracking_number || undefined,
        platform: raw.platform?.trim() || '商城',
        logistics_provider: raw.logistics_provider?.trim() || '黑貓',
        delivery_status: raw.delivery_status?.trim() || '派車收件',
        received_status: raw.received_status?.trim() || '未收到',
        notes: raw.notes?.trim() || undefined,
        receiver_info: raw.receiver_info?.trim() || undefined,
      });
    }

    if (deduplicated.length === 0) {
      return { success: true, data: { imported: 0, duplicates } };
    }

    const insertData = deduplicated.map((item) => ({
      process_date: item.process_date,
      order_number: item.order_number,
      tracking_number: item.tracking_number || null,
      platform: item.platform,
      logistics_provider: item.logistics_provider,
      delivery_status: item.delivery_status,
      received_status: item.received_status,
      notes: item.notes || null,
      receiver_info: item.receiver_info || null,
      is_printed: false,
    }));

    const { error } = await supabase
      .from('pickup_records')
      .insert(insertData as never);

    if (error) {
      console.error('Import pickup records error:', error);
      return { success: false, error: `匯入失敗: ${error.message}` };
    }

    return { success: true, data: { imported: deduplicated.length, duplicates } };
  } catch (error) {
    console.error('Import pickup records error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `匯入失敗: ${msg}` };
  }
}

/**
 * Get all pickup records
 */
export async function getPickupRecords(): Promise<ApiResponse<PickupRecord[]>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('pickup_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get pickup records error:', error);
      return { success: false, error: `載入失敗: ${error.message}` };
    }

    return { success: true, data: (data as PickupRecord[]) || [] };
  } catch (error) {
    console.error('Get pickup records error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `載入失敗: ${msg}` };
  }
}

/**
 * Create a new pickup record
 */
export async function createPickupRecord(
  input: PickupRecordInput
): Promise<ApiResponse<PickupRecord>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('pickup_records')
      .insert({
        process_date: input.process_date,
        order_number: input.order_number,
        tracking_number: input.tracking_number || null,
        platform: input.platform,
        logistics_provider: input.logistics_provider,
        delivery_status: input.delivery_status,
        received_status: input.received_status,
        notes: input.notes || null,
        receiver_info: input.receiver_info || null,
        is_printed: false,
      } as never)
      .select()
      .single();

    if (error) {
      console.error('Create pickup record error:', error);
      return { success: false, error: `新增失敗: ${error.message}` };
    }

    return { success: true, data: data as PickupRecord };
  } catch (error) {
    console.error('Create pickup record error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `新增失敗: ${msg}` };
  }
}

/**
 * Update a pickup record
 */
export async function updatePickupRecord(
  id: string,
  updates: Partial<PickupRecordInput> & { is_printed?: boolean }
): Promise<ApiResponse<PickupRecord>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('pickup_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update pickup record error:', error);
      return { success: false, error: `更新失敗: ${error.message}` };
    }

    return { success: true, data: data as PickupRecord };
  } catch (error) {
    console.error('Update pickup record error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `更新失敗: ${msg}` };
  }
}

/**
 * Delete a single pickup record
 */
export async function deletePickupRecord(id: string): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    const { error } = await supabase
      .from('pickup_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete pickup record error:', error);
      return { success: false, error: `刪除失敗: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete pickup record error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `刪除失敗: ${msg}` };
  }
}

/**
 * Batch delete pickup records
 */
export async function batchDeletePickupRecords(ids: string[]): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    const { error } = await supabase
      .from('pickup_records')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Batch delete pickup records error:', error);
      return { success: false, error: `批次刪除失敗: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Batch delete pickup records error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `批次刪除失敗: ${msg}` };
  }
}

/**
 * Batch update is_printed status
 */
export async function batchUpdatePickupPrinted(ids: string[]): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    const { error } = await supabase
      .from('pickup_records')
      .update({
        is_printed: true,
        updated_at: new Date().toISOString(),
      } as never)
      .in('id', ids);

    if (error) {
      console.error('Batch update printed error:', error);
      return { success: false, error: `更新列印狀態失敗: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Batch update printed error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `更新列印狀態失敗: ${msg}` };
  }
}
