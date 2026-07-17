'use server';

import { createUntypedAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/saas/org-context';
import type { ApiResponse } from '@/types';
import {
  assertSelfServiceTrialReturnCapacity,
  SelfServiceTrialReturnLimitError,
} from '@/lib/saas/self-service-trial-return-limits';

export interface BackupRecord {
  id: string;
  org_id?: string | null;
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
    org_id: string;
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

interface BackupActionOptions {
  orgId?: string;
  source?: 'tenant' | 'cron';
}

interface QueryError {
  code?: string;
  message?: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: QueryError | null;
}

async function getBackupReadOrgId(options?: BackupActionOptions): Promise<string> {
  if (options?.source === 'cron' && options.orgId) {
    return options.orgId;
  }

  const context = await getOrgContext({
    requirements: {
      roles: ['owner', 'admin'],
      exportable: true,
    },
  });

  return context.orgId;
}

async function getBackupWritableOrgId(options?: BackupActionOptions): Promise<string> {
  if (options?.source === 'cron' && options.orgId) {
    return options.orgId;
  }

  const context = await getOrgContext({
    requirements: {
      roles: ['owner', 'admin'],
      writable: true,
      exportable: true,
    },
  });

  return context.orgId;
}

function isMissingBackupSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as QueryError;
  const message = String(record.message || '').toLowerCase();
  return (
    record.code === '42P01'
    || record.code === 'PGRST205'
    || (message.includes('backup_records') && message.includes('schema cache'))
    || (message.includes('org_id') && (message.includes('schema cache') || message.includes('column')))
  );
}

function getOrgBackupPrefix(orgId: string): string {
  return `backups/${orgId}/`;
}

function isOrgBackupPath(filePath: string, orgId: string): boolean {
  return filePath.startsWith(getOrgBackupPrefix(orgId));
}

function scopeRowsToOrg(rows: unknown[] | undefined, orgId: string): never[] {
  return (rows || []).map((row) => ({
    ...(typeof row === 'object' && row !== null ? row : {}),
    org_id: orgId,
  })) as never[];
}

function getRowId(row: unknown): string | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const id = (row as Record<string, unknown>).id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function assertTrialRestoreCapacity(
  supabase: ReturnType<typeof createUntypedAdminClient>,
  orgId: string,
  rows: unknown[]
): Promise<void> {
  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('status')
    .eq('id', orgId)
    .single();
  if (organizationError || !organization) {
    throw new SelfServiceTrialReturnLimitError(
      'trial_return_limit_unavailable',
      503,
      'Unable to verify the trial return limit.'
    );
  }

  const incomingIds = [...new Set(rows.map(getRowId).filter((id): id is string => Boolean(id)))];
  let existingIds = new Set<string>();
  if (incomingIds.length > 0) {
    const { data: existingRows, error: existingError } = await supabase
      .from('return_requests')
      .select('id')
      .eq('org_id', orgId)
      .in('id', incomingIds);
    if (existingError) {
      throw new SelfServiceTrialReturnLimitError(
        'trial_return_limit_unavailable',
        503,
        'Unable to verify the trial return limit.'
      );
    }
    existingIds = new Set(
      (existingRows || [])
        .map((row) => getRowId(row))
        .filter((id): id is string => Boolean(id))
    );
  }

  const rowsWithoutId = rows.filter((row) => !getRowId(row)).length;
  const newIds = incomingIds.filter((id) => !existingIds.has(id)).length;
  await assertSelfServiceTrialReturnCapacity({
    orgId,
    orgStatus: String((organization as { status?: unknown }).status || ''),
    additionalReturns: rowsWithoutId + newIds,
    repository: {
      async hasSelfServiceTrialClaim(scopedOrgId) {
        const { data, error } = await supabase
          .from('saas_self_service_trial_claims')
          .select('org_id')
          .eq('org_id', scopedOrgId)
          .maybeSingle();
        if (error) throw new Error(error.message || 'Failed to load trial claim.');
        return Boolean(data);
      },
      async countReturns(scopedOrgId) {
        const { count, error } = await supabase
          .from('return_requests')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', scopedOrgId);
        if (error) throw new Error(error.message || 'Failed to count trial returns.');
        return count ?? 0;
      },
    },
  });
}

function formatBackupTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

async function loadOrgRows<T>(
  supabase: ReturnType<typeof createUntypedAdminClient>,
  table: string,
  orgId: string,
  order?: { column: string; ascending: boolean }
): Promise<ApiResponse<T[]>> {
  let query = supabase
    .from(table)
    .select('*')
    .eq('org_id', orgId);

  if (order) {
    query = query.order(order.column, { ascending: order.ascending });
  }

  const result = (await query) as QueryResult<T>;
  if (result.error) {
    return { success: false, error: result.error.message || `${table} backup query failed` };
  }

  return { success: true, data: result.data || [] };
}

export async function getBackupHistory(): Promise<ApiResponse<BackupRecord[]>> {
  try {
    const orgId = await getBackupReadOrgId();
    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase
      .from('backup_records')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (isMissingBackupSchemaError(error)) {
        return { success: true, data: [] };
      }
      return { success: false, error: error.message || 'Backup history failed' };
    }

    return { success: true, data: (data as BackupRecord[]) || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backup history failed',
    };
  }
}

export async function createBackup(
  selectedTables: string[],
  backupType: 'manual' | 'auto' = 'manual',
  _pickupRecords?: unknown[],
  options?: BackupActionOptions
): Promise<ApiResponse<{ data: BackupData; downloadUrl?: string }>> {
  void _pickupRecords;

  try {
    const orgId = await getBackupWritableOrgId(options);
    const supabase = createUntypedAdminClient();
    const backupData: BackupData = {
      metadata: {
        created_at: new Date().toISOString(),
        org_id: orgId,
        backup_type: backupType,
        tables: selectedTables,
        record_counts: {},
      },
      data: {},
    };

    if (selectedTables.includes('return_management')) {
      const requests = await loadOrgRows<Record<string, unknown>>(
        supabase,
        'return_requests',
        orgId,
        { column: 'created_at', ascending: false }
      );
      if (!requests.success) return { success: false, error: requests.error };
      backupData.data.return_requests = requests.data || [];
      backupData.metadata.record_counts.return_requests = requests.data?.length || 0;

      const items = await loadOrgRows<Record<string, unknown>>(supabase, 'return_items', orgId);
      if (!items.success) return { success: false, error: items.error };
      backupData.data.return_items = items.data || [];
      backupData.metadata.record_counts.return_items = items.data?.length || 0;

      const images = await loadOrgRows<Record<string, unknown>>(supabase, 'return_images', orgId);
      if (!images.success) return { success: false, error: images.error };
      backupData.data.return_images = images.data || [];
      backupData.metadata.record_counts.return_images = images.data?.length || 0;
    }

    if (selectedTables.includes('shopee_returns')) {
      const shopeeReturns = await loadOrgRows<Record<string, unknown>>(
        supabase,
        'shopee_returns',
        orgId,
        { column: 'created_at', ascending: false }
      );
      if (!shopeeReturns.success) return { success: false, error: shopeeReturns.error };
      backupData.data.shopee_returns = shopeeReturns.data || [];
      backupData.metadata.record_counts.shopee_returns = shopeeReturns.data?.length || 0;
    }

    if (selectedTables.includes('pickup')) {
      const pickupRecords = await loadOrgRows<Record<string, unknown>>(
        supabase,
        'pickup_records',
        orgId,
        { column: 'created_at', ascending: false }
      );
      if (!pickupRecords.success) return { success: false, error: pickupRecords.error };
      backupData.data.pickup_records = pickupRecords.data || [];
      backupData.metadata.record_counts.pickup_records = pickupRecords.data?.length || 0;
    }

    if (backupType === 'auto') {
      const fileName = `backup_${formatBackupTimestamp(new Date())}.json`;
      const filePath = `${getOrgBackupPrefix(orgId)}${fileName}`;
      const jsonString = JSON.stringify(backupData, null, 2);
      const fileSize = Buffer.byteLength(jsonString, 'utf8');

      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(filePath, jsonString, {
          contentType: 'application/json',
          upsert: false,
        });

      if (uploadError) {
        if (String(uploadError.message || '').includes('not found')) {
          return { success: false, error: 'Backups storage bucket is not ready' };
        }
        return { success: false, error: uploadError.message || 'Backup upload failed' };
      }

      const { error: recordError } = await supabase.from('backup_records').insert({
        org_id: orgId,
        backup_name: fileName,
        backup_type: backupType,
        file_path: filePath,
        file_size: fileSize,
        tables_included: selectedTables,
      });

      if (recordError) {
        return { success: false, error: recordError.message || 'Backup record failed' };
      }

      await cleanupOldBackups(orgId);
    }

    return { success: true, data: { data: backupData } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backup failed',
    };
  }
}

export async function downloadBackup(filePath: string): Promise<ApiResponse<{ url: string }>> {
  try {
    const orgId = await getBackupReadOrgId();
    if (!isOrgBackupPath(filePath, orgId)) {
      return { success: false, error: 'Backup file is outside this workspace' };
    }

    const supabase = createUntypedAdminClient();

    const { data, error } = await supabase.storage
      .from('backups')
      .createSignedUrl(filePath, 3600);

    if (error) {
      return { success: false, error: error.message || 'Backup download failed' };
    }

    return { success: true, data: { url: data.signedUrl } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backup download failed',
    };
  }
}

export async function deleteBackup(id: string, filePath: string): Promise<ApiResponse<void>> {
  try {
    const orgId = await getBackupWritableOrgId();
    if (!isOrgBackupPath(filePath, orgId)) {
      return { success: false, error: 'Backup file is outside this workspace' };
    }

    const supabase = createUntypedAdminClient();

    await supabase.storage.from('backups').remove([filePath]);

    const { error } = await supabase
      .from('backup_records')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message || 'Backup delete failed' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backup delete failed',
    };
  }
}

async function cleanupOldBackups(orgId: string): Promise<void> {
  try {
    const supabase = createUntypedAdminClient();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: oldBackups, error } = await supabase
      .from('backup_records')
      .select('id, file_path')
      .eq('org_id', orgId)
      .lt('created_at', sixtyDaysAgo.toISOString());

    if (error || !oldBackups || oldBackups.length === 0) {
      return;
    }

    const scopedBackups = (oldBackups as { id: string; file_path: string }[]).filter((backup) =>
      isOrgBackupPath(backup.file_path, orgId)
    );
    if (scopedBackups.length === 0) {
      return;
    }

    const filePaths = scopedBackups.map((backup) => backup.file_path);
    await supabase.storage.from('backups').remove(filePaths);

    const ids = scopedBackups.map((backup) => backup.id);
    await supabase.from('backup_records').delete().eq('org_id', orgId).in('id', ids);
  } catch {
    // Retention cleanup is best-effort and must not fail the backup itself.
  }
}

export async function restoreBackup(
  backupData: BackupData,
  selectedTables: string[]
): Promise<ApiResponse<{ restored: Record<string, number> }>> {
  try {
    const orgId = await getBackupWritableOrgId();
    if (backupData.metadata.org_id && backupData.metadata.org_id !== orgId) {
      return { success: false, error: 'Backup belongs to another workspace' };
    }

    const supabase = createUntypedAdminClient();
    const restored: Record<string, number> = {};

    if (selectedTables.includes('return_management')) {
      const sourceReturnRequests = backupData.data.return_requests || [];
      await assertTrialRestoreCapacity(supabase, orgId, sourceReturnRequests);
      const returnRequests = scopeRowsToOrg(sourceReturnRequests, orgId);
      if (returnRequests.length > 0) {
        const { error } = await supabase
          .from('return_requests')
          .upsert(returnRequests, { onConflict: 'id' });
        if (error) return { success: false, error: error.message || 'Return restore failed' };
        restored.return_requests = returnRequests.length;
      }

      const returnItems = scopeRowsToOrg(backupData.data.return_items, orgId);
      if (returnItems.length > 0) {
        const { error } = await supabase
          .from('return_items')
          .upsert(returnItems, { onConflict: 'id' });
        if (error) return { success: false, error: error.message || 'Return item restore failed' };
        restored.return_items = returnItems.length;
      }

      const returnImages = scopeRowsToOrg(backupData.data.return_images, orgId);
      if (returnImages.length > 0) {
        const { error } = await supabase
          .from('return_images')
          .upsert(returnImages, { onConflict: 'id' });
        if (error) return { success: false, error: error.message || 'Return image restore failed' };
        restored.return_images = returnImages.length;
      }
    }

    if (selectedTables.includes('shopee_returns')) {
      const shopeeReturns = scopeRowsToOrg(backupData.data.shopee_returns, orgId);
      if (shopeeReturns.length > 0) {
        const { error } = await supabase
          .from('shopee_returns')
          .upsert(shopeeReturns, { onConflict: 'id' });
        if (error) return { success: false, error: error.message || 'Shopee restore failed' };
        restored.shopee_returns = shopeeReturns.length;
      }
    }

    if (selectedTables.includes('pickup')) {
      const pickupRecords = scopeRowsToOrg(backupData.data.pickup_records, orgId);
      if (pickupRecords.length > 0) {
        const { error } = await supabase
          .from('pickup_records')
          .upsert(pickupRecords, { onConflict: 'id' });
        if (error) return { success: false, error: error.message || 'Pickup restore failed' };
        restored.pickup_records = pickupRecords.length;
      }
    }

    return { success: true, data: { restored } };
  } catch (error) {
    if (error instanceof SelfServiceTrialReturnLimitError) {
      return {
        success: false,
        error: error.code === 'trial_return_limit_reached'
          ? '試用工作區最多可保留 50 筆退貨，無法還原超過上限的備份。'
          : '目前無法確認試用額度，已暫停備份還原，請稍後再試。',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Backup restore failed',
    };
  }
}
