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
