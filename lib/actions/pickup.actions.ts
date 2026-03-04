'use server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { recordScanAuditLog } from '@/lib/observability/scan-audit';
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
  is_scanned: boolean;
  scanned_at: string | null;
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

export type PickupScanStatus = 'matched' | 'unmatched' | 'duplicate' | 'error';

function isPickupScanSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';
  return (
    (message.includes('column') && message.includes('is_scanned'))
    || (message.includes('column') && message.includes('scanned_at'))
  );
}

function normalizePickupScanToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extractPickupScanCandidates(rawCode: string): string[] {
  const raw = rawCode.trim();
  if (!raw) return [];

  const candidates = new Set<string>();
  const pushCandidate = (value: string) => {
    const normalized = normalizePickupScanToken(value);
    if (normalized.length >= 6) {
      candidates.add(normalized);
    }
  };

  pushCandidate(raw);

  raw
    .split(/[\s,，;；|/\\]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach(pushCandidate);

  for (const match of raw.matchAll(/\d{3,4}-\d{3,4}-\d{3,4}/g)) {
    pushCandidate(match[0]);
  }

  for (const match of raw.matchAll(/\d{8,16}/g)) {
    pushCandidate(match[0]);
  }

  for (const match of raw.matchAll(/[A-Z0-9]{8,}/gi)) {
    pushCandidate(match[0]);
  }

  return [...candidates];
}

function calculatePickupMatchScore(record: PickupRecord, candidates: string[]): number {
  const orderToken = normalizePickupScanToken(record.order_number || '');
  const trackingToken = normalizePickupScanToken(record.tracking_number || '');

  let maxScore = 0;

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (trackingToken && candidate === trackingToken) {
      maxScore = Math.max(maxScore, 120);
      continue;
    }

    if (orderToken && candidate === orderToken) {
      maxScore = Math.max(maxScore, 110);
      continue;
    }

    if (trackingToken && candidate.length >= 8 && trackingToken.includes(candidate)) {
      maxScore = Math.max(maxScore, 80);
    }

    if (orderToken && candidate.length >= 8 && orderToken.includes(candidate)) {
      maxScore = Math.max(maxScore, 70);
    }

    if (trackingToken && trackingToken.length >= 8 && candidate.includes(trackingToken)) {
      maxScore = Math.max(maxScore, 65);
    }

    if (orderToken && orderToken.length >= 8 && candidate.includes(orderToken)) {
      maxScore = Math.max(maxScore, 55);
    }
  }

  return maxScore;
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

    const seenKeys = new Set<string>();
    const deduplicated: PickupRecordInput[] = [];
    let duplicates = 0;

    for (const raw of items) {
      const processDate = raw.process_date?.trim();
      const orderNumber = raw.order_number?.trim();
      const trackingNumber = raw.tracking_number?.trim() || '';

      if (!processDate || !orderNumber) continue;

      const key = `${processDate}__${orderNumber}__${trackingNumber}`;
      if (seenKeys.has(key)) {
        duplicates++;
        continue;
      }

      seenKeys.add(key);
      deduplicated.push({
        process_date: processDate,
        order_number: orderNumber,
        tracking_number: trackingNumber || undefined,
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
      is_scanned: false,
      scanned_at: null,
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
      return { success: false, error: `載入資料失敗: ${error.message}` };
    }

    return { success: true, data: (data as PickupRecord[]) || [] };
  } catch (error) {
    console.error('Get pickup records error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `載入資料失敗: ${msg}` };
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
        is_scanned: false,
        scanned_at: null,
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
  updates: Partial<PickupRecordInput> & {
    is_printed?: boolean;
    is_scanned?: boolean;
    scanned_at?: string | null;
  },
  auditOptions?: {
    actor?: string;
    reason?: string;
  }
): Promise<ApiResponse<PickupRecord>> {
  try {
    const supabase = createUntypedAdminClient();
    const { data: beforeRow, error: beforeError } = await supabase
      .from('pickup_records')
      .select(
        'delivery_status, received_status, is_scanned, scanned_at, is_printed, process_date, order_number, tracking_number'
      )
      .eq('id', id)
      .single();

    if (beforeError) {
      console.warn('Load pickup record snapshot warning:', beforeError);
    }

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
      return { success: false, error: `更新資料失敗: ${error.message}` };
    }

    const updatedFields = Object.keys(updates).sort();
    const shouldAuditStatusChange = updatedFields.some((field) =>
      ['delivery_status', 'received_status', 'is_scanned', 'scanned_at', 'is_printed'].includes(field)
    );

    if (shouldAuditStatusChange) {
      await recordScanAuditLog({
        actionType: 'update_pickup_status',
        entityTable: 'pickup_records',
        entityId: id,
        actor: auditOptions?.actor || 'system',
        reason: auditOptions?.reason || 'status_update',
        beforeState: (beforeRow as Record<string, unknown>) || null,
        afterState: (data as Record<string, unknown>) || null,
        metadata: {
          updatedFields,
        },
      });
    }

    return { success: true, data: data as PickupRecord };
  } catch (error) {
    console.error('Update pickup record error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `更新資料失敗: ${msg}` };
  }
}

/**
 * Get recently scanned pickup records
 */
export async function getRecentScannedPickupRecords(
  limit = 20
): Promise<ApiResponse<PickupRecord[]>> {
  try {
    const supabase = createUntypedAdminClient();
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(1, limit), 100) : 20;

    const { data, error } = await supabase
      .from('pickup_records')
      .select('*')
      .eq('is_scanned', true)
      .order('scanned_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      console.error('Get recent scanned pickup records error:', error);
      if (isPickupScanSchemaError(error)) {
        return { success: false, error: '掃描欄位尚未建立，請先套用 migration：013_pickup_records_scan_status.sql' };
      }
      return { success: false, error: `載入掃描記錄失敗: ${error.message}` };
    }

    return { success: true, data: (data as PickupRecord[]) || [] };
  } catch (error) {
    console.error('Get recent scanned pickup records error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `載入掃描記錄失敗: ${msg}` };
  }
}

/**
 * Scan pickup barcode and mark matched record as scanned.
 */
export async function scanPickupRecord(
  scannedCode: string
): Promise<ApiResponse<{
  matched: PickupRecord;
  alreadyScanned: boolean;
  matchedCount: number;
  scanStatus: PickupScanStatus;
}>> {
  try {
    const cleanCode = scannedCode.trim();
    if (!cleanCode) {
      return { success: false, error: '請輸入條碼內容' };
    }

    const candidates = extractPickupScanCandidates(cleanCode);
    if (candidates.length === 0) {
      return { success: false, error: '找不到可辨識的條碼格式，請確認後再掃描一次' };
    }

    const supabase = createUntypedAdminClient();
    const { data, error } = await supabase
      .from('pickup_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Scan pickup fetch records error:', error);
      if (isPickupScanSchemaError(error)) {
        return { success: false, error: '掃描欄位尚未建立，請先套用 migration：013_pickup_records_scan_status.sql' };
      }
      return { success: false, error: `掃描失敗: ${error.message}` };
    }

    const rows = (data as PickupRecord[]) || [];
    if (rows.length === 0) {
      return { success: false, error: '目前沒有可比對的派車收件資料' };
    }

    const scored = rows
      .map((record) => ({
        record,
        score: calculatePickupMatchScore(record, candidates),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return { success: false, error: `找不到對應單號，掃描值：${cleanCode}` };
    }

    const matchedCount = scored.length;
    const bestScore = scored[0].score;
    const topMatches = scored
      .filter((item) => item.score === bestScore)
      .map((item) => item.record);
    const matched = topMatches.find((item) => !item.is_scanned) || topMatches[0];

    if (matched.is_scanned) {
      return {
        success: true,
        data: {
          matched,
          alreadyScanned: true,
          matchedCount,
          scanStatus: 'duplicate',
        },
      };
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('pickup_records')
      .update({
        is_scanned: true,
        scanned_at: now,
        updated_at: now,
      } as never)
      .eq('id', matched.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      console.error('Scan pickup update error:', updateError);
      if (isPickupScanSchemaError(updateError)) {
        return { success: false, error: '掃描欄位尚未建立，請先套用 migration：013_pickup_records_scan_status.sql' };
      }
      return { success: false, error: `更新掃描狀態失敗: ${updateError?.message || 'Unknown error'}` };
    }

    return {
      success: true,
      data: {
        matched: updated as PickupRecord,
        alreadyScanned: false,
        matchedCount,
        scanStatus: 'matched',
      },
    };
  } catch (error) {
    console.error('Scan pickup unexpected error:', error);
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return { success: false, error: `掃描失敗: ${msg}` };
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
