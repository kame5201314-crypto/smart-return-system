'use server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface ShopeeReturn {
  id: string;
  order_number: string;
  tracking_number: string | null;
  order_date: string | null;
  total_price: number;
  product_name: string | null;
  option_name: string | null;
  activity_price: number;
  option_sku: string | null;
  return_quantity: number;
  dispute_deadline: string | null;
  refund_amount: number | null;
  return_reason: string | null;
  buyer_note: string | null;
  is_processed: boolean;
  is_printed: boolean;
  is_scanned: boolean;
  scanned_at: string | null;
  note: string | null;
  platform: 'shopee' | 'mall' | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShopeeReturnInput {
  orderNumber: string;
  trackingNumber?: string;
  orderDate: string;
  totalPrice: number;
  productName: string;
  optionName: string;
  activityPrice: number;
  optionSku: string;
  returnQuantity: number;
  disputeDeadline?: string;
  refundAmount?: number;
  returnReason?: string;
  buyerNote?: string;
}

/**
 * Get all shopee returns
 */
export async function getShopeeReturns(): Promise<ApiResponse<ShopeeReturn[]>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('shopee_returns')
      .select('*')
      .order('imported_at', { ascending: false });

    if (error) {
      console.error('Get shopee returns error:', error);
      return { success: false, error: `載入失敗: ${error.message}` };
    }

    return { success: true, data: (data as ShopeeReturn[]) || [] };
  } catch (error) {
    console.error('Get shopee returns error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `載入失敗: ${msg}` };
  }
}

/**
 * Import shopee returns (batch upsert)
 */
export async function importShopeeReturns(
  items: ShopeeReturnInput[],
  platform: 'shopee' | 'mall' = 'shopee'
): Promise<ApiResponse<{ imported: number; duplicates: number }>> {
  try {
    const supabase = createUntypedAdminClient();

    // Deduplicate items within the input file (keep first occurrence)
    const seenOrderNumbers = new Set<string>();
    const deduplicatedItems: ShopeeReturnInput[] = [];
    let fileDuplicates = 0;

    for (const item of items) {
      if (!seenOrderNumbers.has(item.orderNumber)) {
        seenOrderNumbers.add(item.orderNumber);
        deduplicatedItems.push(item);
      } else {
        fileDuplicates++;
      }
    }

    // Get existing order numbers to check for duplicates in database
    const { data: existing, error: fetchError } = await supabase
      .from('shopee_returns')
      .select('order_number');

    if (fetchError) {
      console.error('Failed to fetch existing records:', fetchError);
      // Continue anyway, duplicates will be handled by the fallback
    }

    const existingOrderNumbers = new Set(
      (existing as { order_number: string }[] | null)?.map((r) => r.order_number) || []
    );

    // Filter out items that already exist in database
    const newItems = deduplicatedItems.filter((item) => !existingOrderNumbers.has(item.orderNumber));
    const dbDuplicates = deduplicatedItems.length - newItems.length;
    const totalDuplicates = fileDuplicates + dbDuplicates;

    if (newItems.length === 0) {
      return {
        success: true,
        data: { imported: 0, duplicates: totalDuplicates },
      };
    }

    // Prepare insert data
    const insertData = newItems.map((item) => ({
      order_number: item.orderNumber,
      tracking_number: item.trackingNumber || null,
      order_date: item.orderDate || null,
      total_price: item.totalPrice,
      product_name: item.productName,
      option_name: item.optionName,
      activity_price: item.activityPrice,
      option_sku: item.optionSku,
      return_quantity: item.returnQuantity || 1,
      dispute_deadline: item.disputeDeadline || null,
      refund_amount: item.refundAmount || null,
      return_reason: item.returnReason || null,
      buyer_note: item.buyerNote || null,
      is_processed: false,
      is_printed: false,
      note: '',
      platform: platform,
    }));

    // Try batch insert first
    const { error } = await supabase
      .from('shopee_returns')
      .insert(insertData as never);

    // If batch insert fails due to duplicates, insert one by one
    if (error && error.message.includes('duplicate key')) {
      let insertedCount = 0;
      for (const item of insertData) {
        const { error: singleError } = await supabase
          .from('shopee_returns')
          .insert(item as never);

        if (!singleError) {
          insertedCount++;
        }
        // Silently skip duplicates
      }

      return {
        success: true,
        data: { imported: insertedCount, duplicates: totalDuplicates + (newItems.length - insertedCount) },
      };
    }

    if (error) {
      console.error('Import shopee returns error:', error);
      return { success: false, error: `匯入失敗: ${error.message}` };
    }

    return {
      success: true,
      data: { imported: newItems.length, duplicates: totalDuplicates },
    };
  } catch (error) {
    console.error('Import shopee returns error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `匯入失敗: ${msg}` };
  }
}

/**
 * Update shopee return status (processed/printed/tracking_number)
 */
export async function updateShopeeReturnStatus(
  id: string,
  updates: { is_processed?: boolean; is_printed?: boolean; note?: string; tracking_number?: string }
): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    const { error } = await supabase
      .from('shopee_returns')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id);

    if (error) {
      console.error('Update shopee return error:', error);
      return { success: false, error: `更新失敗: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Update shopee return error:', error);
    return { success: false, error: '更新失敗' };
  }
}

/**
 * Batch update shopee returns
 */
export async function batchUpdateShopeeReturns(
  ids: string[],
  updates: { is_processed?: boolean; is_printed?: boolean; is_scanned?: boolean }
): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    const { error } = await supabase
      .from('shopee_returns')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      } as never)
      .in('id', ids);

    if (error) {
      console.error('Batch update shopee returns error:', error);
      return { success: false, error: `批次更新失敗: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Batch update shopee returns error:', error);
    return { success: false, error: '批次更新失敗' };
  }
}

/**
 * Delete shopee returns
 */
export async function deleteShopeeReturns(ids: string[]): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();

    const { error } = await supabase
      .from('shopee_returns')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Delete shopee returns error:', error);
      return { success: false, error: `刪除失敗: ${error.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete shopee returns error:', error);
    return { success: false, error: '刪除失敗' };
  }
}

/**
 * Scan and match shopee return by order number or tracking number (barcode)
 * Supports partial matching for different barcode formats
 */
export async function scanShopeeReturn(
  scannedCode: string
): Promise<ApiResponse<{ matched: ShopeeReturn; alreadyScanned: boolean } | null>> {
  try {
    const supabase = createUntypedAdminClient();
    const cleanCode = scannedCode.trim();

    if (!cleanCode) {
      return { success: false, error: '請掃描有效的條碼' };
    }

    // Check if this looks like a Taiwan shipping/tracking number (寄件編號)
    const isTrackingNumber = /^TW\d+$/i.test(cleanCode);

    // Search for matching order
    const { data: allReturns, error: fetchError } = await supabase
      .from('shopee_returns')
      .select('*');

    if (fetchError) {
      console.error('Fetch returns error:', fetchError);
      return { success: false, error: '讀取資料失敗' };
    }

    if (!allReturns || allReturns.length === 0) {
      return { success: false, error: '找不到任何退貨資料' };
    }

    // Try to find a match - check both order_number and tracking_number
    const matched = (allReturns as ShopeeReturn[]).find((r) => {
      const orderNum = r.order_number.toUpperCase();
      const trackingNum = r.tracking_number?.toUpperCase() || '';
      const scanned = cleanCode.toUpperCase();

      // Match against order_number
      if (orderNum === scanned || orderNum.includes(scanned) || scanned.includes(orderNum)) {
        return true;
      }

      // Match against tracking_number (if exists)
      if (trackingNum && (trackingNum === scanned || trackingNum.includes(scanned) || scanned.includes(trackingNum))) {
        return true;
      }

      return false;
    });

    if (!matched) {
      // Provide helpful error message based on what was scanned
      if (isTrackingNumber) {
        return {
          success: false,
          error: `這是寄件編號 (${cleanCode})，請掃描「蝦皮訂單編號」旁的條碼`
        };
      }
      return {
        success: false,
        error: `找不到符合的訂單：${cleanCode.substring(0, 20)}${cleanCode.length > 20 ? '...' : ''}`
      };
    }

    // Check if already scanned
    if (matched.is_scanned) {
      return {
        success: true,
        data: { matched, alreadyScanned: true }
      };
    }

    // Update as scanned
    const { error: updateError } = await supabase
      .from('shopee_returns')
      .update({
        is_scanned: true,
        scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', matched.id);

    if (updateError) {
      console.error('Update scan status error:', updateError);
      return { success: false, error: '更新掃描狀態失敗' };
    }

    return {
      success: true,
      data: {
        matched: { ...matched, is_scanned: true, scanned_at: new Date().toISOString() },
        alreadyScanned: false
      }
    };
  } catch (error) {
    console.error('Scan shopee return error:', error);
    return { success: false, error: '掃描比對失敗' };
  }
}
