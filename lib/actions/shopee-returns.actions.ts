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
  shipping_method: string | null;
  is_processed: boolean;
  is_printed: boolean;
  is_scanned: boolean;
  scanned_at: string | null;
  processed_at: string | null;
  note: string | null;
  platform: 'shopee' | 'mall' | null;
  color_tag: 'yellow' | 'red' | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export type ColorTag = 'yellow' | 'red' | null;

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
  shippingMethod?: string;
}

function normalizeCodeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extractScanCandidates(scannedCode: string): string[] {
  const raw = scannedCode.trim();
  if (!raw) return [];

  const candidates = new Set<string>();

  const pushCandidate = (value: string) => {
    const normalized = normalizeCodeToken(value);
    if (normalized.length >= 6) {
      candidates.add(normalized);
    }
  };

  pushCandidate(raw);
  raw
    .split(/[\s,，;；|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach(pushCandidate);

  for (const match of raw.matchAll(/TW\d{8,}/gi)) {
    pushCandidate(match[0]);
  }

  for (const match of raw.matchAll(/\d{6}[A-Z0-9]{4,}/gi)) {
    pushCandidate(match[0]);
  }

  return [...candidates];
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
 * Get a single shopee return by id
 */
export async function getShopeeReturnById(id: string): Promise<ApiResponse<ShopeeReturn>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('shopee_returns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return { success: false, error: `載入失敗: ${error?.message || 'Not found'}` };
    }

    return { success: true, data: data as ShopeeReturn };
  } catch (error) {
    console.error('Get shopee return by id error:', error);
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
    // Use order_number + option_sku as composite key (same customer may buy different products)
    const seenKeys = new Set<string>();
    const deduplicatedItems: ShopeeReturnInput[] = [];
    let fileDuplicates = 0;

    for (const item of items) {
      const compositeKey = `${item.orderNumber}__${item.optionSku || ''}`;
      if (!seenKeys.has(compositeKey)) {
        seenKeys.add(compositeKey);
        deduplicatedItems.push(item);
      } else {
        fileDuplicates++;
      }
    }

    // Get existing order_number + option_sku combos to check for duplicates in database
    const { data: existing, error: fetchError } = await supabase
      .from('shopee_returns')
      .select('order_number, option_sku');

    if (fetchError) {
      console.error('Failed to fetch existing records:', fetchError);
      // Continue anyway, duplicates will be handled by the fallback
    }

    const existingKeys = new Set(
      (existing as { order_number: string; option_sku: string | null }[] | null)?.map(
        (r) => `${r.order_number}__${r.option_sku || ''}`
      ) || []
    );

    // Filter out items that already exist in database (same order_number + option_sku)
    const newItems = deduplicatedItems.filter(
      (item) => !existingKeys.has(`${item.orderNumber}__${item.optionSku || ''}`)
    );
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
      shipping_method: item.shippingMethod || null,
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
      const failedItems: string[] = [];

      for (const item of insertData) {
        const { error: singleError } = await supabase
          .from('shopee_returns')
          .insert(item as never);

        if (!singleError) {
          insertedCount++;
        } else if (!singleError.message.includes('duplicate key')) {
          // Track non-duplicate failures
          failedItems.push(item.order_number);
          console.error(`Failed to insert order ${item.order_number}:`, singleError.message);
        }
        // Silently skip duplicates
      }

      // Report failures if any (non-duplicate errors)
      if (failedItems.length > 0) {
        console.error('Failed to import orders:', failedItems);
        return {
          success: true,
          data: { imported: insertedCount, duplicates: totalDuplicates + (newItems.length - insertedCount - failedItems.length) },
          message: `部分訂單匯入失敗: ${failedItems.slice(0, 3).join(', ')}${failedItems.length > 3 ? ` 等 ${failedItems.length} 筆` : ''}`,
        };
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
  updates: {
    is_processed?: boolean;
    is_printed?: boolean;
    is_scanned?: boolean;
    note?: string;
    tracking_number?: string;
    processed_at?: string | null;
    scanned_at?: string | null;
  }
): Promise<ApiResponse<void>> {
  try {
    const supabase = createUntypedAdminClient();
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ...updates,
      updated_at: now,
    };

    if (updates.is_scanned === true && updates.scanned_at === undefined) {
      payload.scanned_at = now;
    }
    if (updates.is_scanned === false && updates.scanned_at === undefined) {
      payload.scanned_at = null;
    }

    const { error } = await supabase
      .from('shopee_returns')
      .update(payload as never)
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
  updates: { is_processed?: boolean; is_printed?: boolean; is_scanned?: boolean; color_tag?: ColorTag }
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
): Promise<ApiResponse<{ matched: ShopeeReturn; alreadyScanned: boolean; matchedCount: number; updatedCount: number } | null>> {
  try {
    const supabase = createUntypedAdminClient();
    const cleanCode = scannedCode.trim();

    if (!cleanCode) {
      return { success: false, error: '請掃描有效的條碼' };
    }

    // Check if this looks like a Taiwan shipping/tracking number (寄件編號)
    const isTrackingNumber = /^TW\d+$/i.test(cleanCode);
    const candidates = extractScanCandidates(cleanCode);

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

    const sourceRows = allReturns as ShopeeReturn[];
    const matchedRows = sourceRows.filter((row) => {
      const orderNum = normalizeCodeToken(row.order_number);
      const trackingNum = normalizeCodeToken(row.tracking_number || '');
      const rowTokens = [orderNum, trackingNum].filter(Boolean);

      return candidates.some((candidate) =>
        rowTokens.some(
          (token) => token === candidate || token.includes(candidate) || candidate.includes(token)
        )
      );
    });

    if (matchedRows.length === 0) {
      // Provide helpful error message based on what was scanned
      if (isTrackingNumber) {
        return {
          success: false,
          error: `這是寄件編號 (${cleanCode})，請掃描「蝦皮訂單編號」旁的條碼`
        };
      }
      return {
        success: false,
        error: `找不到符合的訂單：${cleanCode.substring(0, 30)}${cleanCode.length > 30 ? '...' : ''}`
      };
    }

    const matched = matchedRows.find((row) => !row.is_scanned) || matchedRows[0];
    const toUpdateRows = matchedRows.filter((row) => !row.is_scanned);
    const now = new Date().toISOString();

    // Check if already scanned
    if (toUpdateRows.length === 0) {
      return {
        success: true,
        data: {
          matched,
          alreadyScanned: true,
          matchedCount: matchedRows.length,
          updatedCount: 0,
        }
      };
    }

    // Update as scanned
    const { error: updateError } = await supabase
      .from('shopee_returns')
      .update({
        is_scanned: true,
        scanned_at: now,
        updated_at: now,
      } as never)
      .in('id', toUpdateRows.map((row) => row.id));

    if (updateError) {
      console.error('Update scan status error:', updateError);
      return { success: false, error: '更新掃描狀態失敗' };
    }

    return {
      success: true,
      data: {
        matched: { ...matched, is_scanned: true, scanned_at: now },
        alreadyScanned: false,
        matchedCount: matchedRows.length,
        updatedCount: toUpdateRows.length,
      }
    };
  } catch (error) {
    console.error('Scan shopee return error:', error);
    return { success: false, error: '掃描比對失敗' };
  }
}

/**
 * Manually create a single shopee return record
 */
export async function createShopeeReturn(input: {
  orderNumber: string;
  platform: 'shopee' | 'mall';
  trackingNumber?: string;
  orderDate?: string;
  disputeDeadline?: string;
  refundAmount?: number;
  productName?: string;
  optionName?: string;
  optionSku?: string;
  returnQuantity?: number;
  returnReason?: string;
  buyerNote?: string;
  shippingMethod?: string;
  note?: string;
}): Promise<ApiResponse<{ id: string }>> {
  try {
    const supabase = createUntypedAdminClient();

    if (!input.orderNumber.trim()) {
      return { success: false, error: '請輸入訂單編號' };
    }

    // Check duplicate: order_number + option_sku
    const skuValue = input.optionSku?.trim() || null;
    let dupQuery = supabase
      .from('shopee_returns')
      .select('id')
      .eq('order_number', input.orderNumber.trim());
    if (skuValue) {
      dupQuery = dupQuery.eq('option_sku', skuValue);
    } else {
      dupQuery = dupQuery.or('option_sku.is.null,option_sku.eq.');
    }
    const { data: existing } = await dupQuery;

    if (existing && existing.length > 0) {
      return { success: false, error: '此訂單編號+貨號已存在' };
    }

    const { data, error } = await supabase
      .from('shopee_returns')
      .insert({
        order_number: input.orderNumber.trim(),
        platform: input.platform,
        tracking_number: input.trackingNumber?.trim() || null,
        order_date: input.orderDate || null,
        dispute_deadline: input.disputeDeadline || null,
        refund_amount: input.refundAmount || null,
        product_name: input.productName?.trim() || null,
        option_name: input.optionName?.trim() || null,
        option_sku: input.optionSku?.trim() || null,
        return_quantity: input.returnQuantity || 1,
        return_reason: input.returnReason?.trim() || null,
        buyer_note: input.buyerNote?.trim() || null,
        shipping_method: input.shippingMethod?.trim() || null,
        note: input.note?.trim() || null,
        is_processed: false,
        is_printed: false,
        is_scanned: false,
      } as never)
      .select('id')
      .single();

    if (error) {
      console.error('Create shopee return error:', error);
      return { success: false, error: `新增失敗: ${error.message}` };
    }

    return { success: true, data: { id: (data as { id: string }).id } };
  } catch (error) {
    console.error('Create shopee return error:', error);
    return { success: false, error: '新增失敗' };
  }
}

export interface ShopeeReturnUpdateInput {
  platform?: 'shopee' | 'mall';
  orderNumber?: string;
  trackingNumber?: string;
  shippingMethod?: string;
  orderDate?: string;
  disputeDeadline?: string;
  refundAmount?: number | null;
  returnQuantity?: number;
  productName?: string;
  optionName?: string;
  optionSku?: string;
  returnReason?: string;
  buyerNote?: string;
  note?: string;
}

function toNullableString(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Update editable shopee return fields
 */
export async function updateShopeeReturn(
  id: string,
  input: ShopeeReturnUpdateInput
): Promise<ApiResponse<ShopeeReturn>> {
  try {
    if (!id) {
      return { success: false, error: '缺少退貨單 ID' };
    }

    const supabase = createUntypedAdminClient();

    const { data: currentRow, error: currentError } = await supabase
      .from('shopee_returns')
      .select('order_number, option_sku')
      .eq('id', id)
      .single();

    if (currentError || !currentRow) {
      return { success: false, error: `找不到退貨單: ${currentError?.message || 'Not found'}` };
    }

    const nextOrderNumber = input.orderNumber !== undefined
      ? input.orderNumber.trim()
      : (currentRow as { order_number: string }).order_number;
    const nextOptionSku = input.optionSku !== undefined
      ? toNullableString(input.optionSku)
      : ((currentRow as { option_sku: string | null }).option_sku || null);

    if (!nextOrderNumber) {
      return { success: false, error: '訂單編號不可為空' };
    }

    // Validate duplicate unique key (order_number + option_sku)
    let dupQuery = supabase
      .from('shopee_returns')
      .select('id')
      .neq('id', id)
      .eq('order_number', nextOrderNumber);

    if (nextOptionSku) {
      dupQuery = dupQuery.eq('option_sku', nextOptionSku);
    } else {
      dupQuery = dupQuery.or('option_sku.is.null,option_sku.eq.');
    }

    const { data: duplicateRows, error: duplicateError } = await dupQuery.limit(1);
    if (duplicateError) {
      return { success: false, error: `檢查重複資料失敗: ${duplicateError.message}` };
    }
    if (duplicateRows && duplicateRows.length > 0) {
      return { success: false, error: '此訂單編號 + 貨號已存在' };
    }

    if (input.returnQuantity !== undefined) {
      const qty = Number(input.returnQuantity);
      if (!Number.isInteger(qty) || qty < 1) {
        return { success: false, error: '數量必須為正整數' };
      }
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      order_number: nextOrderNumber,
    };

    if (input.platform !== undefined) payload.platform = input.platform;
    if (input.trackingNumber !== undefined) payload.tracking_number = toNullableString(input.trackingNumber);
    if (input.shippingMethod !== undefined) payload.shipping_method = toNullableString(input.shippingMethod);
    if (input.orderDate !== undefined) payload.order_date = toNullableString(input.orderDate);
    if (input.disputeDeadline !== undefined) payload.dispute_deadline = toNullableString(input.disputeDeadline);
    if (input.refundAmount !== undefined) payload.refund_amount = input.refundAmount;
    if (input.returnQuantity !== undefined) payload.return_quantity = input.returnQuantity;
    if (input.productName !== undefined) payload.product_name = toNullableString(input.productName);
    if (input.optionName !== undefined) payload.option_name = toNullableString(input.optionName);
    if (input.optionSku !== undefined) payload.option_sku = nextOptionSku;
    if (input.returnReason !== undefined) payload.return_reason = toNullableString(input.returnReason);
    if (input.buyerNote !== undefined) payload.buyer_note = toNullableString(input.buyerNote);
    if (input.note !== undefined) payload.note = toNullableString(input.note);

    const { data: updatedRow, error: updateError } = await supabase
      .from('shopee_returns')
      .update(payload as never)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updatedRow) {
      return { success: false, error: `更新失敗: ${updateError?.message || 'Unknown error'}` };
    }

    return { success: true, data: updatedRow as ShopeeReturn };
  } catch (error) {
    console.error('Update shopee return detail error:', error);
    const message = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `更新失敗: ${message}` };
  }
}
