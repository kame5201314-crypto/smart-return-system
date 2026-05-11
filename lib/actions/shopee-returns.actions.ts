'use server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { recordScanAuditLog } from '@/lib/observability/scan-audit';
import type { ApiResponse } from '@/types';

export interface ShopeeReturn {
  id: string;
  order_number: string;
  order_number_norm?: string | null;
  tracking_number: string | null;
  tracking_number_norm?: string | null;
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
  return_reason_note: string | null;
  is_processed: boolean;
  is_printed: boolean;
  is_scanned: boolean;
  scanned_at: string | null;
  is_inbound?: boolean | null;
  inbound_at?: string | null;
  processed_at: string | null;
  note: string | null;
  platform: ShopeeReturnPlatform | null;
  color_tag: 'yellow' | 'red' | 'purple' | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export type ShopeeReturnPlatform = 'shopee' | 'mall' | 'other';

export interface ShopeeReturnOrderGroup {
  primary: ShopeeReturn;
  items: ShopeeReturn[];
  portal_reason_detail?: string | null;
}

export type ColorTag = 'yellow' | 'red' | 'purple' | null;

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

export type ScanStatus = 'matched' | 'unmatched' | 'duplicate' | 'error';

export interface ShopeeScanEvent {
  id: string;
  scanned_code: string;
  normalized_code: string;
  scan_status: ScanStatus;
  matched_order_id: string | null;
  matched_order_number: string | null;
  matched_tracking_number: string | null;
  platform: ShopeeReturnPlatform | null;
  matched_count: number;
  updated_count: number;
  message: string | null;
  scanned_at: string;
  created_at: string;
}

export interface ShopeeUnmatchedScan {
  id: string;
  normalized_code: string;
  sample_scanned_code: string;
  first_seen_at: string;
  last_seen_at: string;
  hit_count: number;
  status: 'open' | 'resolved';
  resolved_order_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopeeScanKpi {
  todayTotalScans: number;
  todayMatchedScans: number;
  todayUnmatchedScans: number;
  todayDuplicateScans: number;
  unmatchedRate: number;
  duplicateRate: number;
  scannedCompletionRate: number;
}

export interface ShopeeScanDashboardData {
  kpi: ShopeeScanKpi;
  recentEvents: ShopeeScanEvent[];
  unmatchedOpenCount: number;
}

const DUPLICATE_SCAN_WINDOW_MS = 3000;

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

function isRelationMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';
  const code = 'code' in error ? String((error as { code?: string }).code || '') : '';
  return (
    message.includes('does not exist')
    || message.includes('relation')
    || message.includes('42P01')
    || message.includes('Could not find the table')
    || message.includes('schema cache')
    || code === '42P01'
    || code === 'PGRST205'
  );
}

function pickPrimaryNormalizedCode(cleanCode: string, candidates: string[]): string {
  return candidates[0] || normalizeCodeToken(cleanCode);
}

async function recordScanEvent(event: {
  scannedCode: string;
  normalizedCode: string;
  scanStatus: ScanStatus;
  matchedOrder?: ShopeeReturn | null;
  matchedCount?: number;
  updatedCount?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<ShopeeScanEvent | null> {
  try {
    const supabase = createUntypedAdminClient();
    const { data, error } = await supabase
      .from('shopee_scan_events')
      .insert({
        scanned_code: event.scannedCode,
        normalized_code: event.normalizedCode,
        scan_status: event.scanStatus,
        matched_order_id: event.matchedOrder?.id || null,
        matched_order_number: event.matchedOrder?.order_number || null,
        matched_tracking_number: event.matchedOrder?.tracking_number || null,
        platform: event.matchedOrder?.platform || null,
        matched_count: event.matchedCount || 0,
        updated_count: event.updatedCount || 0,
        message: event.message || null,
        metadata: event.metadata || null,
      } as never)
      .select('*')
      .single();

    if (error) {
      if (!isRelationMissingError(error)) {
        console.error('recordScanEvent error:', error);
      }
      return null;
    }

    return (data as ShopeeScanEvent) || null;
  } catch (error) {
    if (!isRelationMissingError(error)) {
      console.error('recordScanEvent unexpected error:', error);
    }
    return null;
  }
}

async function upsertUnmatchedScan(normalizedCode: string, scannedCode: string): Promise<void> {
  try {
    const supabase = createUntypedAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from('shopee_unmatched_scans')
      .select('id, hit_count')
      .eq('normalized_code', normalizedCode)
      .eq('status', 'open')
      .limit(1);

    if (existingError) {
      if (!isRelationMissingError(existingError)) {
        console.error('upsertUnmatchedScan load error:', existingError);
      }
      return;
    }

    if (existing && existing.length > 0) {
      const row = existing[0] as { id: string; hit_count: number };
      const { error: updateError } = await supabase
        .from('shopee_unmatched_scans')
        .update({
          sample_scanned_code: scannedCode,
          last_seen_at: new Date().toISOString(),
          hit_count: (row.hit_count || 0) + 1,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id);

      if (updateError && !isRelationMissingError(updateError)) {
        console.error('upsertUnmatchedScan update error:', updateError);
      }
      return;
    }

    const { error: insertError } = await supabase
      .from('shopee_unmatched_scans')
      .insert({
        normalized_code: normalizedCode,
        sample_scanned_code: scannedCode,
        status: 'open',
      } as never);

    if (insertError && !isRelationMissingError(insertError)) {
      console.error('upsertUnmatchedScan insert error:', insertError);
    }
  } catch (error) {
    if (!isRelationMissingError(error)) {
      console.error('upsertUnmatchedScan unexpected error:', error);
    }
  }
}

async function resolveOpenUnmatchedByCode(normalizedCode: string, orderId: string): Promise<void> {
  try {
    const supabase = createUntypedAdminClient();
    const { error } = await supabase
      .from('shopee_unmatched_scans')
      .update({
        status: 'resolved',
        resolved_order_id: orderId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('normalized_code', normalizedCode)
      .eq('status', 'open');

    if (error && !isRelationMissingError(error)) {
      console.error('resolveOpenUnmatchedByCode error:', error);
    }
  } catch (error) {
    if (!isRelationMissingError(error)) {
      console.error('resolveOpenUnmatchedByCode unexpected error:', error);
    }
  }
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
 * Get all shopee return rows for the same order as the target row
 */
export async function getShopeeReturnGroupById(id: string): Promise<ApiResponse<ShopeeReturnOrderGroup>> {
  try {
    const supabase = createUntypedAdminClient();

    const { data: primaryRow, error: primaryError } = await supabase
      .from('shopee_returns')
      .select('*')
      .eq('id', id)
      .single();

    if (primaryError || !primaryRow) {
      return { success: false, error: `\u8b80\u53d6\u8766\u76ae\u9000\u8ca8\u8cc7\u6599\u5931\u6557: ${primaryError?.message || 'Not found'}` };
    }

    let itemsQuery = supabase
      .from('shopee_returns')
      .select('*')
      .eq('order_number', (primaryRow as ShopeeReturn).order_number)
      .order('imported_at', { ascending: false });

    if ((primaryRow as ShopeeReturn).platform) {
      itemsQuery = itemsQuery.eq('platform', (primaryRow as ShopeeReturn).platform);
    }

    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) {
      return { success: false, error: `\u8b80\u53d6\u8766\u76ae\u9000\u8ca8\u8cc7\u6599\u5931\u6557: ${itemsError.message}` };
    }

    const groupItems = ((items as ShopeeReturn[]) || []).sort((a, b) => {
      if (a.id === id) return -1;
      if (b.id === id) return 1;
      return (a.imported_at || '').localeCompare(b.imported_at || '');
    });

    let portalReasonDetail: string | null = null;
    const { data: relatedOrder, error: relatedOrderError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', (primaryRow as ShopeeReturn).order_number)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (relatedOrderError) {
      console.error('Get related order for shopee return reason_detail error:', relatedOrderError);
    } else if (relatedOrder?.id) {
      const { data: relatedReturns, error: relatedReturnsError } = await supabase
        .from('return_requests')
        .select('reason_detail, created_at')
        .eq('order_id', relatedOrder.id)
        .not('reason_detail', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (relatedReturnsError) {
        console.error('Get related return request reason_detail error:', relatedReturnsError);
      } else {
        const related = ((relatedReturns as Array<{ reason_detail: string | null }>) || []).find(
          (row) => Boolean(row.reason_detail && row.reason_detail.trim())
        );
        portalReasonDetail = related?.reason_detail?.trim() || null;
      }
    }

    return {
      success: true,
      data: {
        primary: primaryRow as ShopeeReturn,
        items: groupItems,
        portal_reason_detail: portalReasonDetail,
      },
    };
  } catch (error) {
    console.error('Get shopee return group by id error:', error);
    const msg = error instanceof Error ? error.message : '\u672a\u77e5\u932f\u8aa4';
    return { success: false, error: `\u8b80\u53d6\u8766\u76ae\u9000\u8ca8\u8cc7\u6599\u5931\u6557: ${msg}` };
  }
}

/**
 * Import shopee returns (batch upsert)
 */
export async function importShopeeReturns(
  items: ShopeeReturnInput[],
  platform: 'shopee' | 'mall' = 'shopee'
): Promise<ApiResponse<{ imported: number; duplicates: number; updated: number }>> {
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
      .select('id, order_number, option_sku, buyer_note');

    if (fetchError) {
      console.error('Failed to fetch existing records:', fetchError);
      // Continue anyway, duplicates will be handled by the fallback
    }

    const existingRows = (existing as { id: string; order_number: string; option_sku: string | null; buyer_note: string | null }[] | null) || [];
    const existingByKey = new Map(existingRows.map((row) => [`${row.order_number}__${row.option_sku || ''}`, row]));

    // Filter out items that already exist in database (same order_number + option_sku)
    const newItems = deduplicatedItems.filter(
      (item) => !existingByKey.has(`${item.orderNumber}__${item.optionSku || ''}`)
    );
    const duplicateItems = deduplicatedItems.filter(
      (item) => existingByKey.has(`${item.orderNumber}__${item.optionSku || ''}`)
    );
    const dbDuplicates = duplicateItems.length;
    const totalDuplicates = fileDuplicates + dbDuplicates;

    let updated = 0;
    for (const item of duplicateItems) {
      const key = `${item.orderNumber}__${item.optionSku || ''}`;
      const existingRow = existingByKey.get(key);
      if (!existingRow) continue;

      const nextBuyerNote = item.buyerNote?.trim() || '';
      const currentBuyerNote = existingRow.buyer_note?.trim() || '';
      if (!nextBuyerNote || currentBuyerNote) continue;

      const { error: updateExistingError } = await supabase
        .from('shopee_returns')
        .update({ buyer_note: nextBuyerNote } as never)
        .eq('id', existingRow.id);

      if (updateExistingError) {
        console.error('Failed to backfill buyer_note for duplicate shopee return:', updateExistingError);
        continue;
      }

      updated++;
      existingRow.buyer_note = nextBuyerNote;
    }

    if (newItems.length === 0) {
      return {
        success: true,
        data: { imported: 0, duplicates: totalDuplicates, updated },
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
          data: { imported: insertedCount, duplicates: totalDuplicates + (newItems.length - insertedCount - failedItems.length), updated },
          message: `部分訂單匯入失敗: ${failedItems.slice(0, 3).join(', ')}${failedItems.length > 3 ? ` 等 ${failedItems.length} 筆` : ''}`,
        };
      }

      return {
        success: true,
        data: { imported: insertedCount, duplicates: totalDuplicates + (newItems.length - insertedCount), updated },
      };
    }

    if (error) {
      console.error('Import shopee returns error:', error);
      return { success: false, error: `匯入失敗: ${error.message}` };
    }

    return {
      success: true,
      data: { imported: newItems.length, duplicates: totalDuplicates, updated },
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
    is_inbound?: boolean;
    note?: string;
    return_reason_note?: string;
    tracking_number?: string;
    processed_at?: string | null;
    scanned_at?: string | null;
    inbound_at?: string | null;
  },
  auditOptions?: {
    actor?: string;
    reason?: string;
  }
): Promise<ApiResponse<void>> {
  try {
    const hasScanMutation = updates.is_scanned !== undefined || updates.scanned_at !== undefined;
    const hasInboundMutation = updates.is_inbound !== undefined || updates.inbound_at !== undefined;

    // Keep scan and inbound workflows independent to avoid accidental coupling.
    if (hasScanMutation && hasInboundMutation) {
      return { success: false, error: '掃描與入庫需分開操作，請分兩次更新。' };
    }

    const supabase = createUntypedAdminClient();
    let originalStatus: {
      is_processed: boolean;
      is_printed: boolean;
      is_scanned: boolean;
      scanned_at: string | null;
      is_inbound: boolean | null;
      inbound_at: string | null;
      processed_at: string | null;
      note: string | null;
      return_reason_note: string | null;
      tracking_number: string | null;
    } | null = null;

    const shouldLoadSnapshot = hasScanMutation || hasInboundMutation || Object.keys(updates).length > 0;
    if (shouldLoadSnapshot) {
      const { data: snapshot, error: snapshotError } = await supabase
        .from('shopee_returns')
        .select(
          'is_processed, is_printed, is_scanned, scanned_at, is_inbound, inbound_at, processed_at, note, return_reason_note, tracking_number'
        )
        .eq('id', id)
        .single();

      if (snapshotError) {
        console.warn('Load shopee return status snapshot warning:', snapshotError);
      } else if (snapshot) {
        originalStatus = snapshot as {
          is_processed: boolean;
          is_printed: boolean;
          is_scanned: boolean;
          scanned_at: string | null;
          is_inbound: boolean | null;
          inbound_at: string | null;
          processed_at: string | null;
          note: string | null;
          return_reason_note: string | null;
          tracking_number: string | null;
        };
      }
    }
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
    if (updates.is_inbound === true && updates.inbound_at === undefined) {
      payload.inbound_at = now;
    }
    if (updates.is_inbound === false && updates.inbound_at === undefined) {
      payload.inbound_at = null;
    }

    const { error } = await supabase
      .from('shopee_returns')
      .update(payload as never)
      .eq('id', id);

    if (error) {
      console.error('Update shopee return error:', error);
      return { success: false, error: `更新失敗: ${error.message}` };
    }

    // Defensive restore: keep scan/inbound independent even if legacy DB triggers still couple them.
    if (originalStatus && hasScanMutation && !hasInboundMutation) {
      const { error: restoreInboundError } = await supabase
        .from('shopee_returns')
        .update({
          is_inbound: !!originalStatus.is_inbound,
          inbound_at: originalStatus.inbound_at || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', id);

      if (restoreInboundError) {
        console.warn('Restore inbound status warning:', restoreInboundError);
      }
    }

    if (originalStatus && hasInboundMutation && !hasScanMutation) {
      const { error: restoreScanError } = await supabase
        .from('shopee_returns')
        .update({
          is_scanned: !!originalStatus.is_scanned,
          scanned_at: originalStatus.scanned_at || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', id);

      if (restoreScanError) {
        console.warn('Restore scan status warning:', restoreScanError);
      }
    }

    const { data: latestStatus, error: latestStatusError } = await supabase
        .from('shopee_returns')
        .select(
          'is_processed, is_printed, is_scanned, scanned_at, is_inbound, inbound_at, processed_at, note, return_reason_note, tracking_number'
        )
      .eq('id', id)
      .single();

    if (latestStatusError) {
      console.warn('Load latest shopee return status warning:', latestStatusError);
    }

    await recordScanAuditLog({
      actionType: 'update_shopee_status',
      entityTable: 'shopee_returns',
      entityId: id,
      actor: auditOptions?.actor || 'system',
      reason: auditOptions?.reason || 'status_update',
      beforeState: originalStatus || null,
      afterState: (latestStatus as Record<string, unknown>) || null,
      metadata: {
        updatedFields: Object.keys(updates).sort(),
        hasScanMutation,
        hasInboundMutation,
      },
    });

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
  updates: { is_processed?: boolean; is_printed?: boolean; color_tag?: ColorTag }
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
      if (
        updates.color_tag === 'purple' &&
        typeof error.message === 'string' &&
        error.message.includes('shopee_returns_color_tag_check')
      ) {
        return {
          success: false,
          error: '批次更新失敗：資料庫尚未套用紫色安排收件標記，請先執行 color_tag migration。',
        };
      }
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
): Promise<ApiResponse<{ matched: ShopeeReturn; alreadyScanned: boolean; matchedCount: number; updatedCount: number; scanStatus: ScanStatus; eventId?: string | null } | null>> {
  try {
    const supabase = createUntypedAdminClient();
    const cleanCode = scannedCode.trim();

    if (!cleanCode) {
      return { success: false, error: '請掃描有效的條碼' };
    }

    const candidates = extractScanCandidates(cleanCode);
    const primaryNormalizedCode = pickPrimaryNormalizedCode(cleanCode, candidates);
    const isTrackingNumber = /^TW\d+$/i.test(cleanCode);
    const nowMs = Date.now();

    // Duplicate protection (short window, no re-write)
    try {
      const { data: recentEvents, error: duplicateCheckError } = await supabase
        .from('shopee_scan_events')
        .select('id, scanned_at')
        .eq('normalized_code', primaryNormalizedCode)
        .order('scanned_at', { ascending: false })
        .limit(1);

      if (!duplicateCheckError && recentEvents && recentEvents.length > 0) {
        const recent = recentEvents[0] as { id: string; scanned_at: string };
        const recentMs = new Date(recent.scanned_at).getTime();
        if (!Number.isNaN(recentMs) && nowMs - recentMs <= DUPLICATE_SCAN_WINDOW_MS) {
          const msg = '重複掃描：3 秒內相同條碼已處理，已略過寫入';
          await recordScanEvent({
            scannedCode: cleanCode,
            normalizedCode: primaryNormalizedCode,
            scanStatus: 'duplicate',
            message: msg,
            metadata: { blockedByRecentEventId: recent.id },
          });
          return { success: false, error: msg };
        }
      } else if (duplicateCheckError && !isRelationMissingError(duplicateCheckError)) {
        console.error('Duplicate scan check error:', duplicateCheckError);
      }
    } catch (error) {
      if (!isRelationMissingError(error)) {
        console.error('Duplicate scan check unexpected error:', error);
      }
    }

    let sourceRows: ShopeeReturn[] = [];
    const uniqueCandidates = [...new Set(candidates)];

    if (uniqueCandidates.length > 0) {
      try {
        const [orderLookup, trackingLookup] = await Promise.all([
          supabase
            .from('shopee_returns')
            .select('*')
            .in('order_number_norm', uniqueCandidates),
          supabase
            .from('shopee_returns')
            .select('*')
            .in('tracking_number_norm', uniqueCandidates),
        ]);

        if (!orderLookup.error && !trackingLookup.error) {
          const fastRows = [
            ...((orderLookup.data as ShopeeReturn[]) || []),
            ...((trackingLookup.data as ShopeeReturn[]) || []),
          ];
          sourceRows = fastRows.filter((row, idx, arr) => arr.findIndex((r) => r.id === row.id) === idx);
        } else {
          const knownSchemaMiss = isRelationMissingError(orderLookup.error) || isRelationMissingError(trackingLookup.error);
          if (!knownSchemaMiss) {
            if (orderLookup.error) console.error('order_number_norm lookup error:', orderLookup.error);
            if (trackingLookup.error) console.error('tracking_number_norm lookup error:', trackingLookup.error);
          }
        }
      } catch (error) {
        if (!isRelationMissingError(error)) {
          console.error('normalized lookup unexpected error:', error);
        }
      }
    }

    if (sourceRows.length === 0) {
      const { data: allReturns, error: fetchError } = await supabase
        .from('shopee_returns')
        .select('*');

      if (fetchError) {
        console.error('Fetch returns error:', fetchError);
        await recordScanEvent({
          scannedCode: cleanCode,
          normalizedCode: primaryNormalizedCode,
          scanStatus: 'error',
          message: '讀取資料失敗',
        });
        return { success: false, error: '讀取資料失敗' };
      }

      if (!allReturns || allReturns.length === 0) {
        await recordScanEvent({
          scannedCode: cleanCode,
          normalizedCode: primaryNormalizedCode,
          scanStatus: 'unmatched',
          message: '找不到任何退貨資料',
        });
        await upsertUnmatchedScan(primaryNormalizedCode, cleanCode);
        return { success: false, error: '找不到任何退貨資料' };
      }
      sourceRows = allReturns as ShopeeReturn[];
    }

    const matchedRows = sourceRows.filter((row) => {
      const orderNum = row.order_number_norm || normalizeCodeToken(row.order_number);
      const trackingNum = row.tracking_number_norm || normalizeCodeToken(row.tracking_number || '');
      const rowTokens = [orderNum, trackingNum].filter(Boolean);

      return candidates.some((candidate) =>
        rowTokens.some(
          (token) => token === candidate || token.includes(candidate) || candidate.includes(token)
        )
      );
    });

    if (matchedRows.length === 0) {
      const unmatchedMessage = isTrackingNumber
        ? `這是寄件編號 (${cleanCode})，請掃描「蝦皮訂單編號」旁的條碼`
        : `找不到符合的訂單：${cleanCode.substring(0, 30)}${cleanCode.length > 30 ? '...' : ''}`;

      await upsertUnmatchedScan(primaryNormalizedCode, cleanCode);
      await recordScanEvent({
        scannedCode: cleanCode,
        normalizedCode: primaryNormalizedCode,
        scanStatus: 'unmatched',
        message: unmatchedMessage,
      });

      if (isTrackingNumber) {
        return { success: false, error: unmatchedMessage };
      }
      return { success: false, error: unmatchedMessage };
    }

    const matched = matchedRows.find((row) => !row.is_scanned) || matchedRows[0];
    const toUpdateRows = matchedRows.filter((row) => !row.is_scanned);
    const now = new Date().toISOString();

    // Check if already scanned
    if (toUpdateRows.length === 0) {
      const event = await recordScanEvent({
        scannedCode: cleanCode,
        normalizedCode: primaryNormalizedCode,
        scanStatus: 'matched',
        matchedOrder: matched,
        matchedCount: matchedRows.length,
        updatedCount: 0,
        message: '已掃描過',
      });

      return {
        success: true,
        data: {
          matched,
          alreadyScanned: true,
          matchedCount: matchedRows.length,
          updatedCount: 0,
          scanStatus: 'matched',
          eventId: event?.id || null,
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
      await recordScanEvent({
        scannedCode: cleanCode,
        normalizedCode: primaryNormalizedCode,
        scanStatus: 'error',
        matchedOrder: matched,
        matchedCount: matchedRows.length,
        updatedCount: 0,
        message: '更新掃描狀態失敗',
      });
      return { success: false, error: '更新掃描狀態失敗' };
    }

    await resolveOpenUnmatchedByCode(primaryNormalizedCode, matched.id);
    const event = await recordScanEvent({
      scannedCode: cleanCode,
      normalizedCode: primaryNormalizedCode,
      scanStatus: 'matched',
      matchedOrder: matched,
      matchedCount: matchedRows.length,
      updatedCount: toUpdateRows.length,
      message: '掃描成功',
    });

    return {
      success: true,
      data: {
        matched: { ...matched, is_scanned: true, scanned_at: now },
        alreadyScanned: false,
        matchedCount: matchedRows.length,
        updatedCount: toUpdateRows.length,
        scanStatus: 'matched',
        eventId: event?.id || null,
      }
    };
  } catch (error) {
    console.error('Scan shopee return error:', error);
    const cleanCode = scannedCode.trim();
    const candidates = extractScanCandidates(cleanCode);
    const primaryNormalizedCode = pickPrimaryNormalizedCode(cleanCode, candidates);
    await recordScanEvent({
      scannedCode: cleanCode,
      normalizedCode: primaryNormalizedCode,
      scanStatus: 'error',
      message: '掃描比對失敗',
    });
    return { success: false, error: '掃描比對失敗' };
  }
}

/**
 * Manually create a single shopee return record
 */
export async function createShopeeReturn(input: {
  orderNumber: string;
  platform: ShopeeReturnPlatform;
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
  platform?: ShopeeReturnPlatform;
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
  returnReasonNote?: string;
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
    if (input.returnReasonNote !== undefined) payload.return_reason_note = toNullableString(input.returnReasonNote);
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

export interface ShopeeReturnScanCandidate {
  id: string;
  order_number: string;
  tracking_number: string | null;
  platform: ShopeeReturnPlatform | null;
  is_scanned: boolean;
}

export async function getShopeeScanDashboard(
  recentLimit = 30
): Promise<ApiResponse<ShopeeScanDashboardData>> {
  try {
    const supabase = createUntypedAdminClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [recentEventsResult, todayEventsResult, unmatchedCountResult, returnsResult] = await Promise.all([
      supabase
        .from('shopee_scan_events')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(recentLimit),
      supabase
        .from('shopee_scan_events')
        .select('scan_status, scanned_at')
        .gte('scanned_at', todayIso),
      supabase
        .from('shopee_unmatched_scans')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('shopee_returns')
        .select('id, is_scanned'),
    ]);

    const recentEvents = !recentEventsResult.error
      ? ((recentEventsResult.data as ShopeeScanEvent[]) || [])
      : [];
    const todayEvents = !todayEventsResult.error
      ? ((todayEventsResult.data as { scan_status: ScanStatus }[]) || [])
      : [];
    const unmatchedOpenCount = !unmatchedCountResult.error
      ? (unmatchedCountResult.count || 0)
      : 0;
    const returnRows = !returnsResult.error
      ? ((returnsResult.data as { id: string; is_scanned: boolean }[]) || [])
      : [];

    if (recentEventsResult.error && !isRelationMissingError(recentEventsResult.error)) {
      return { success: false, error: `載入掃描儀表失敗: ${recentEventsResult.error.message}` };
    }
    if (todayEventsResult.error && !isRelationMissingError(todayEventsResult.error)) {
      return { success: false, error: `載入掃描儀表失敗: ${todayEventsResult.error.message}` };
    }
    if (unmatchedCountResult.error && !isRelationMissingError(unmatchedCountResult.error)) {
      return { success: false, error: `載入掃描儀表失敗: ${unmatchedCountResult.error.message}` };
    }
    if (returnsResult.error) {
      return { success: false, error: `載入掃描儀表失敗: ${returnsResult.error.message}` };
    }

    const todayTotalScans = todayEvents.length;
    const todayMatchedScans = todayEvents.filter((item) => item.scan_status === 'matched').length;
    const todayUnmatchedScans = todayEvents.filter((item) => item.scan_status === 'unmatched').length;
    const todayDuplicateScans = todayEvents.filter((item) => item.scan_status === 'duplicate').length;
    const scannedCount = returnRows.filter((row) => row.is_scanned).length;
    const scannedCompletionRate = returnRows.length > 0
      ? (scannedCount / returnRows.length) * 100
      : 0;

    return {
      success: true,
      data: {
        recentEvents,
        unmatchedOpenCount,
        kpi: {
          todayTotalScans,
          todayMatchedScans,
          todayUnmatchedScans,
          todayDuplicateScans,
          unmatchedRate: todayTotalScans > 0 ? (todayUnmatchedScans / todayTotalScans) * 100 : 0,
          duplicateRate: todayTotalScans > 0 ? (todayDuplicateScans / todayTotalScans) * 100 : 0,
          scannedCompletionRate,
        },
      },
    };
  } catch (error) {
    console.error('getShopeeScanDashboard error:', error);
    return { success: false, error: '載入掃描儀表失敗' };
  }
}

export async function getShopeeUnmatchedScans(
  limit = 100
): Promise<ApiResponse<ShopeeUnmatchedScan[]>> {
  try {
    const supabase = createUntypedAdminClient();
    const { data, error } = await supabase
      .from('shopee_unmatched_scans')
      .select('*')
      .eq('status', 'open')
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isRelationMissingError(error)) {
        return { success: true, data: [] };
      }
      return { success: false, error: `載入未匹配清單失敗: ${error.message}` };
    }

    return { success: true, data: (data as ShopeeUnmatchedScan[]) || [] };
  } catch (error) {
    console.error('getShopeeUnmatchedScans error:', error);
    return { success: false, error: '載入未匹配清單失敗' };
  }
}

export async function searchShopeeReturnScanCandidates(
  keyword: string,
  limit = 20
): Promise<ApiResponse<ShopeeReturnScanCandidate[]>> {
  try {
    const q = keyword.trim();
    if (!q) return { success: true, data: [] };

    const supabase = createUntypedAdminClient();
    const normalized = normalizeCodeToken(q);

    let rows: ShopeeReturnScanCandidate[] = [];

    const fastLookup = await supabase
      .from('shopee_returns')
      .select('id, order_number, tracking_number, platform, is_scanned')
      .or(`order_number_norm.eq.${normalized},tracking_number_norm.eq.${normalized}`)
      .limit(limit);

    if (!fastLookup.error && fastLookup.data) {
      rows = fastLookup.data as ShopeeReturnScanCandidate[];
    } else if (fastLookup.error && !isRelationMissingError(fastLookup.error)) {
      return { success: false, error: `搜尋候選訂單失敗: ${fastLookup.error.message}` };
    }

    if (rows.length === 0) {
      const fallback = await supabase
        .from('shopee_returns')
        .select('id, order_number, tracking_number, platform, is_scanned')
        .or(`order_number.ilike.%${q}%,tracking_number.ilike.%${q}%`)
        .limit(limit);

      if (fallback.error) {
        return { success: false, error: `搜尋候選訂單失敗: ${fallback.error.message}` };
      }
      rows = (fallback.data as ShopeeReturnScanCandidate[]) || [];
    }

    return { success: true, data: rows };
  } catch (error) {
    console.error('searchShopeeReturnScanCandidates error:', error);
    return { success: false, error: '搜尋候選訂單失敗' };
  }
}

export async function bindShopeeUnmatchedScan(input: {
  unmatchedScanId: string;
  shopeeReturnId: string;
  resolvedBy?: string;
  note?: string;
}): Promise<ApiResponse<{ eventId: string | null; matchedOrderId: string }>> {
  try {
    const supabase = createUntypedAdminClient();
    const now = new Date().toISOString();

    const { data: unmatched, error: unmatchedError } = await supabase
      .from('shopee_unmatched_scans')
      .select('*')
      .eq('id', input.unmatchedScanId)
      .single();

    if (unmatchedError || !unmatched) {
      return { success: false, error: `找不到未匹配記錄: ${unmatchedError?.message || 'Not found'}` };
    }

    if ((unmatched as ShopeeUnmatchedScan).status !== 'open') {
      return { success: false, error: '此未匹配記錄已處理' };
    }

    const { data: targetOrder, error: orderError } = await supabase
      .from('shopee_returns')
      .select('*')
      .eq('id', input.shopeeReturnId)
      .single();

    if (orderError || !targetOrder) {
      return { success: false, error: `找不到目標訂單: ${orderError?.message || 'Not found'}` };
    }

    const order = targetOrder as ShopeeReturn;
    const { error: updateOrderError } = await supabase
      .from('shopee_returns')
      .update({
        is_scanned: true,
        scanned_at: order.scanned_at || now,
        updated_at: now,
      } as never)
      .eq('id', order.id);

    if (updateOrderError) {
      return { success: false, error: `綁定失敗: ${updateOrderError.message}` };
    }

    const { error: resolveError } = await supabase
      .from('shopee_unmatched_scans')
      .update({
        status: 'resolved',
        resolved_order_id: order.id,
        resolved_at: now,
        resolved_by: input.resolvedBy || null,
        note: input.note || null,
        updated_at: now,
      } as never)
      .eq('id', input.unmatchedScanId)
      .eq('status', 'open');

    if (resolveError) {
      return { success: false, error: `綁定失敗: ${resolveError.message}` };
    }

    const event = await recordScanEvent({
      scannedCode: (unmatched as ShopeeUnmatchedScan).sample_scanned_code,
      normalizedCode: (unmatched as ShopeeUnmatchedScan).normalized_code,
      scanStatus: 'matched',
      matchedOrder: order,
      matchedCount: 1,
      updatedCount: order.is_scanned ? 0 : 1,
      message: 'manual_bind',
      metadata: {
        source: 'manual_bind',
        unmatchedScanId: input.unmatchedScanId,
      },
    });

    await recordScanAuditLog({
      actionType: 'manual_bind_unmatched',
      entityTable: 'shopee_unmatched_scans',
      entityId: input.unmatchedScanId,
      actor: input.resolvedBy || 'admin',
      reason: input.note || 'manual_bind',
      beforeState: {
        unmatchedStatus: (unmatched as ShopeeUnmatchedScan).status,
        unresolvedOrderId: (unmatched as ShopeeUnmatchedScan).resolved_order_id,
        orderScannedBefore: order.is_scanned,
      },
      afterState: {
        unmatchedStatus: 'resolved',
        resolvedOrderId: order.id,
        orderScannedAfter: true,
      },
      metadata: {
        shopeeReturnId: order.id,
        eventId: event?.id || null,
      },
    });

    return {
      success: true,
      data: {
        eventId: event?.id || null,
        matchedOrderId: order.id,
      },
    };
  } catch (error) {
    console.error('bindShopeeUnmatchedScan error:', error);
    return { success: false, error: '綁定失敗' };
  }
}
